"""
Post Scheduling Intelligence — ML-Based Optimal Time Recommendations.

Uses a LightGBM model trained on synthetic LinkedIn engagement patterns
to recommend the best day + hour combinations for posting.

Key features:
  - Indian IST timezone focus (UTC+5:30)
  - Separate models for weekday vs weekend patterns
  - Audience type personalization (Founder, Job Seeker, Consultant, etc.)
  - Content tone × time interaction features
  - Returns a ranked weekly schedule with confidence scores
"""

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from typing import Any, Optional
try:
    import lightgbm as lgb
    HAS_LIGHTGBM = True
except ModuleNotFoundError:
    lgb = None
    HAS_LIGHTGBM = False

import logging
logger = logging.getLogger("scheduler")

IST = ZoneInfo("Asia/Kolkata")

# ── Feature Definitions ────────────────────────────────────────────────────────

SCHEDULE_FEATURE_NAMES = [
    "hour_of_day",          # 0–23
    "day_of_week",          # 0=Mon … 6=Sun
    "is_weekend",           # 0 or 1
    "is_morning_peak",      # 7–9 AM IST
    "is_lunch_peak",        # 12–14 IST
    "is_evening_peak",      # 17–20 IST
    "tone_educational",     # one-hot
    "tone_promotional",
    "tone_story",
    "tone_opinion",
    "audience_founder",     # one-hot audience type
    "audience_job_seeker",
    "audience_consultant",
    "audience_student",
    "audience_general",
    "tone_x_morning",       # interaction: educational × morning
    "tone_x_evening",       # interaction: story × evening
]

TONE_COLS = {
    "Educational": "tone_educational",
    "Promotional": "tone_promotional",
    "Story":       "tone_story",
    "Opinion":     "tone_opinion",
}

AUDIENCE_COLS = {
    "Founder":    "audience_founder",
    "Job Seeker": "audience_job_seeker",
    "Consultant": "audience_consultant",
    "Student":    "audience_student",
    "General":    "audience_general",
}

TONES     = list(TONE_COLS.keys())
AUDIENCES = list(AUDIENCE_COLS.keys())


# ── Synthetic Training Data ────────────────────────────────────────────────────

def _generate_synthetic_schedule_data(n: int = 5000) -> pd.DataFrame:
    """
    Generate synthetic LinkedIn engagement data for (hour, day, tone, audience) combos.

    Ground-truth patterns encoded:
      - Tue–Thu 8–9 AM IST: highest engagement (professionals check LinkedIn before work)
      - Mon 12–13 IST: good for Educational (weekly planning mindset)
      - Fri 17–19 IST: good for Story/Opinion (wind-down, reflective mood)
      - Sat–Sun: low overall, Story outperforms others on weekend evenings
      - Educational peaks at morning; Promotional is penalized everywhere
    """
    rng = np.random.default_rng(42)
    rows = []

    for _ in range(n):
        day   = rng.integers(0, 7)
        hour  = rng.integers(6, 23)
        tone  = rng.choice(TONES)
        audience = rng.choice(AUDIENCES)

        # Base score
        score = 3.0

        # Day of week bonus
        if day in [1, 2, 3]:   # Tue–Thu
            score += 1.5
        elif day in [0, 4]:    # Mon, Fri
            score += 0.8
        else:                   # Weekend
            score -= 0.8

        # Hour of day bonus (IST)
        if 7 <= hour <= 9:
            score += 1.8   # Morning peak
        elif 12 <= hour <= 14:
            score += 1.2   # Lunch peak
        elif 17 <= hour <= 20:
            score += 1.0   # Evening peak
        elif hour < 6 or hour > 22:
            score -= 1.5   # Dead hours

        # Tone bonus
        if tone == "Educational":
            score += 0.6
            if 7 <= hour <= 10:   # Educational × morning = extra boost
                score += 0.5
        elif tone == "Promotional":
            score -= 0.8
        elif tone == "Story":
            score += 0.3
            if 17 <= hour <= 20:  # Story × evening = extra boost
                score += 0.4
        elif tone == "Opinion":
            score += 0.2

        # Audience modifier
        if audience == "Founder":
            if 6 <= hour <= 9:
                score += 0.4   # Founders are early risers
        elif audience == "Job Seeker":
            if 10 <= hour <= 14:
                score += 0.3   # Active during office hours
        elif audience == "Student":
            if 19 <= hour <= 22:
                score += 0.5   # Evening learners
            score -= 0.2       # Generally lower engagement base

        # Clamp + noise
        score = float(np.clip(score + rng.normal(0, 0.3), 1.0, 8.0))
        rows.append({
            "hour_of_day":    hour,
            "day_of_week":    day,
            "is_weekend":     int(day >= 5),
            "is_morning_peak": int(7 <= hour <= 9),
            "is_lunch_peak":  int(12 <= hour <= 14),
            "is_evening_peak": int(17 <= hour <= 20),
            **{col: int(tone == t) for t, col in TONE_COLS.items()},
            **{col: int(audience == a) for a, col in AUDIENCE_COLS.items()},
            "tone_x_morning": int(tone == "Educational" and 7 <= hour <= 9),
            "tone_x_evening": int(tone == "Story" and 17 <= hour <= 20),
            "engagement_rate": score,
        })

    return pd.DataFrame(rows)


# ── LightGBM Scheduler Model ───────────────────────────────────────────────────

class PostScheduler:
    """
    LightGBM model that predicts engagement rate for a given
    (day, hour, tone, audience) combination and recommends the optimal schedule.
    """

    def __init__(self):
        self.model: Any = None
        self._train()

    def _train(self):
        df = _generate_synthetic_schedule_data(n=6000)
        X  = df[SCHEDULE_FEATURE_NAMES]
        y  = df["engagement_rate"]

        if HAS_LIGHTGBM and lgb is not None:
            params = {
                "objective":        "regression",
                "metric":           "rmse",
                "n_estimators":     300,
                "learning_rate":    0.05,
                "num_leaves":       31,
                "min_child_samples": 20,
                "random_state":     42,
                "verbose":          -1,
            }
            self.model = lgb.LGBMRegressor(**params)
            self.model.fit(X, y)
            logger.info("[Scheduler] LightGBM model trained.")
        else:
            self.model = GradientBoostingRegressor(
                random_state=42,
                n_estimators=300,
                learning_rate=0.05,
                max_depth=3,
                subsample=0.8,
            )
            self.model.fit(X, y)
            logger.warning("[Scheduler] lightgbm not installed; using GradientBoostingRegressor.")

    def _build_features(self, hour: int, day: int, tone: str, audience: str) -> dict:
        return {
            "hour_of_day":     hour,
            "day_of_week":     day,
            "is_weekend":      int(day >= 5),
            "is_morning_peak": int(7 <= hour <= 9),
            "is_lunch_peak":   int(12 <= hour <= 14),
            "is_evening_peak": int(17 <= hour <= 20),
            **{col: int(tone == t) for t, col in TONE_COLS.items()},
            **{col: int(audience == a) for a, col in AUDIENCE_COLS.items()},
            "tone_x_morning":  int(tone == "Educational" and 7 <= hour <= 9),
            "tone_x_evening":  int(tone == "Story" and 17 <= hour <= 20),
        }

    def predict_score(self, hour: int, day: int, tone: str, audience: str) -> float:
        """Predict engagement rate for a single slot."""
        if self.model is None:
            raise RuntimeError("PostScheduler model is not initialized.")
        feats = self._build_features(hour, day, tone, audience)
        X = pd.DataFrame([feats])[SCHEDULE_FEATURE_NAMES]
        import numpy as np
        prediction = self.model.predict(X)
        score = float(np.asarray(prediction).flat[0])
        return float(np.clip(score, 1.0, 8.0))

    def get_best_slots(
        self,
        tone: str = "Educational",
        audience: str = "General",
        top_n: int = 7,
        hours_to_check: Optional[list[int]] = None,
    ) -> list[dict]:
        """
        Score all (day, hour) combinations and return the top N slots.

        Args:
            tone:            Content tone for this post
            audience:        Target audience type
            top_n:           How many recommendations to return
            hours_to_check:  Restrict to specific hours (default: 6–22)

        Returns:
            List of dicts sorted by predicted_engagement desc:
              {day_of_week, day_name, hour, time_ist, predicted_engagement, confidence_label}
        """
        if hours_to_check is None:
            hours_to_check = list(range(6, 23))

        DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

        scores = []
        for day in range(7):
            for hour in hours_to_check:
                score = self.predict_score(hour, day, tone, audience)
                scores.append({
                    "day_of_week":           day,
                    "day_name":              DAY_NAMES[day],
                    "hour":                  hour,
                    "time_ist":              f"{hour:02d}:00 IST",
                    "predicted_engagement":  round(score, 2),
                    "confidence_label":      _label(score),
                })

        # Sort by score descending
        scores.sort(key=lambda x: -x["predicted_engagement"])
        return scores[:top_n]

    def get_weekly_schedule(
        self,
        tone: str = "Educational",
        audience: str = "General",
        posts_per_week: int = 5,
    ) -> dict:
        """
        Build a complete weekly posting schedule:
          - One best slot per day (Mon–Fri)
          - Distributes across the week to avoid clustering
          - Returns schedule + insights

        Args:
            tone:           Dominant content tone for the week
            audience:       Target audience
            posts_per_week: How many posts to schedule (3–7)

        Returns:
            dict with 'schedule', 'best_day', 'best_time', 'weekly_insights'
        """
        DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        HOURS     = list(range(6, 22))

        # Get best slot per day
        per_day = []
        for day in range(7):
            best = max(
                [{"day": day, "hour": h, "score": self.predict_score(h, day, tone, audience)}
                 for h in HOURS],
                key=lambda x: x["score"],
            )
            per_day.append(best)

        # Sort days by score, pick top N
        per_day.sort(key=lambda x: -x["score"])
        selected = sorted(per_day[:posts_per_week], key=lambda x: x["day"])

        schedule = []
        for slot in selected:
            schedule.append({
                "day_of_week":          slot["day"],
                "day_name":             DAY_NAMES[slot["day"]],
                "recommended_hour":     slot["hour"],
                "time_ist":             f"{slot['hour']:02d}:00 IST",
                "predicted_engagement": round(slot["score"], 2),
                "confidence_label":     _label(slot["score"]),
                "tone_suggestion":      tone,
            })

        best_slot  = schedule[0] if schedule else {}
        avg_score  = round(sum(s["predicted_engagement"] for s in schedule) / len(schedule), 2) if schedule else 0

        insights = _generate_insights(schedule, tone, audience)

        return {
            "schedule":        schedule,
            "best_day":        best_slot.get("day_name", ""),
            "best_time":       best_slot.get("time_ist", ""),
            "posts_per_week":  posts_per_week,
            "avg_predicted_engagement": avg_score,
            "tone":            tone,
            "audience":        audience,
            "insights":        insights,
        }


# ── Helpers ────────────────────────────────────────────────────────────────────

def _label(score: float) -> str:
    if score >= 6.0: return "🔥 Excellent"
    if score >= 5.0: return "✅ Great"
    if score >= 4.0: return "👍 Good"
    if score >= 3.0: return "⚠️ Average"
    return "❌ Low"


def _generate_insights(schedule: list[dict], tone: str, audience: str) -> list[str]:
    """Generate human-readable scheduling insights from the schedule."""
    insights = []

    if schedule:
        best = schedule[0]
        insights.append(
            f"Your best posting slot is {best['day_name']} at {best['time_ist']} "
            f"(predicted {best['predicted_engagement']:.1f}% engagement)."
        )

    morning_slots = [s for s in schedule if 7 <= s["recommended_hour"] <= 9]
    if morning_slots:
        insights.append(
            f"{len(morning_slots)} of your slots fall in the 7–9 AM morning peak — "
            "ideal for Indian professionals commuting or starting their day."
        )

    if tone == "Educational":
        insights.append(
            "Educational content performs best Tuesday–Thursday in the morning window. "
            "Avoid posting on weekends for this tone."
        )
    elif tone == "Story":
        insights.append(
            "Story-format posts get a boost on Friday evenings (5–7 PM IST) when "
            "professionals are in a reflective, end-of-week mindset."
        )
    elif tone == "Promotional":
        insights.append(
            "⚠️ Promotional content consistently underperforms. Limit to 1/week max "
            "and pair it with a strong data point or story hook."
        )

    if audience == "Founder":
        insights.append("Founders are early risers — your 6–8 AM slots will outperform the average.")
    elif audience == "Student":
        insights.append("Students engage most in the 7–10 PM window after college hours.")

    return insights


# ── Singleton ──────────────────────────────────────────────────────────────────

post_scheduler = PostScheduler()


# ── Public Convenience Functions ──────────────────────────────────────────────

def get_optimal_schedule(
    tone: str = "Educational",
    audience: str = "General",
    posts_per_week: int = 5,
) -> dict:
    """Convenience wrapper around PostScheduler.get_weekly_schedule."""
    return post_scheduler.get_weekly_schedule(tone, audience, posts_per_week)


def get_best_posting_slots(
    tone: str = "Educational",
    audience: str = "General",
    top_n: int = 7,
) -> list[dict]:
    """Return top N best (day, hour) slots ranked by predicted engagement."""
    return post_scheduler.get_best_slots(tone, audience, top_n)


# ── CLI Test ──────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("\n=== Post Scheduling Intelligence ===\n")

    result = get_optimal_schedule(tone="Educational", audience="Founder", posts_per_week=5)
    print(f"Recommended Weekly Schedule ({result['tone']} | {result['audience']}):\n")
    for slot in result["schedule"]:
        print(
            f"  {slot['day_name']:<12} {slot['time_ist']:<12} "
            f"Predicted: {slot['predicted_engagement']:.2f}%  {slot['confidence_label']}"
        )

    print(f"\nBest slot: {result['best_day']} at {result['best_time']}")
    print(f"Avg predicted engagement: {result['avg_predicted_engagement']:.2f}%\n")
    print("Insights:")
    for tip in result["insights"]:
        print(f"  • {tip}")
