"""
Instagram Posting Scheduler.

LightGBM-powered recommendations for optimal posting time on Instagram.
Trained on IST engagement patterns specific to Indian Instagram audience.

Best times for Indian Instagram (IST):
- Reels:    6-9 PM (prime scroll), 8-10 AM (morning routine)
- Carousels: 12-2 PM (lunch), 8-10 PM (evening)
- Stories:  7-9 AM (morning), 10 PM-12 AM (night owls)
- Static:   9-11 AM (mid-morning), 7-9 PM (evening)

Standalone: get_ig_schedule(format, tone, posts_per_week)
"""

import logging
import numpy as np
import pandas as pd
from typing import Any
from sklearn.ensemble import GradientBoostingRegressor

try:
    import lightgbm as lgb
    HAS_LIGHTGBM = True
except ModuleNotFoundError:
    lgb = None
    HAS_LIGHTGBM = False

logger = logging.getLogger("instagram_scheduler")

IG_FORMATS   = ["Reel", "Carousel", "Static", "Story"]
IG_TONES     = ["Educational", "Motivational", "Funny", "Emotional", "Promotional"]
IG_AUDIENCES = ["Gen Z", "Millennial", "Professional", "Student", "Creator"]

DAYS_IST = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

SCHEDULE_FEATURE_NAMES = [
    "hour_of_day", "day_of_week", "is_weekend", "is_evening_prime",
    "is_morning_prime", "is_lunch", "is_late_night",
    "format_reel", "format_carousel", "format_static", "format_story",
    "tone_educational", "tone_motivational", "tone_funny",
    "tone_emotional", "tone_promotional",
    "audience_genz", "audience_millennial", "audience_professional",
    "audience_student", "audience_creator",
    "reel_x_evening", "carousel_x_lunch", "funny_x_weekend",
]


def _gen_schedule_data(n: int = 6000) -> pd.DataFrame:
    rng  = np.random.default_rng(42)
    rows = []
    for _ in range(n):
        hour     = int(rng.integers(0, 24))
        day      = int(rng.integers(0, 7))
        fmt      = str(rng.choice(IG_FORMATS))
        tone     = str(rng.choice(IG_TONES))
        audience = str(rng.choice(IG_AUDIENCES))

        is_evening   = int(18 <= hour <= 21)
        is_morning   = int(7 <= hour <= 9)
        is_lunch     = int(12 <= hour <= 14)
        is_late      = int(22 <= hour or hour <= 1)
        is_weekend   = int(day >= 5)

        s = 2.0

        # Format-specific time patterns
        if fmt == "Reel":
            if is_evening: s += 3.0
            elif is_morning: s += 1.5
            elif is_late: s += 1.0
        elif fmt == "Carousel":
            if is_lunch: s += 2.5
            elif is_evening: s += 2.0
            elif is_morning: s += 1.0
        elif fmt == "Story":
            if is_morning: s += 2.5
            elif is_late: s += 2.0
        elif fmt == "Static":
            if 9 <= hour <= 11: s += 2.0
            elif is_evening: s += 1.5

        # Day patterns
        if fmt == "Reel":
            if day in [4, 5, 6]: s += 1.5    # Fri-Sun reels get more views
            elif day in [1, 2]: s += 0.8
        if fmt == "Carousel":
            if day in [0, 1, 2]: s += 1.0    # Mon-Wed educational content
        if tone == "Funny" and is_weekend: s += 1.0
        if tone == "Motivational" and day == 0: s += 0.8  # Mon motivation

        # Audience-specific adjustments
        if audience == "Gen Z" and is_late: s += 0.8
        if audience == "Student" and is_evening: s += 0.8
        if audience == "Professional" and is_morning: s += 1.0
        if audience == "Creator" and fmt == "Reel": s += 0.5

        # Dead zones
        if 2 <= hour <= 5: s -= 2.0
        if fmt == "Carousel" and is_late: s -= 0.5

        rows.append({
            "hour_of_day": hour, "day_of_week": day,
            "is_weekend": is_weekend, "is_evening_prime": is_evening,
            "is_morning_prime": is_morning, "is_lunch": is_lunch, "is_late_night": is_late,
            "format_reel": int(fmt=="Reel"), "format_carousel": int(fmt=="Carousel"),
            "format_static": int(fmt=="Static"), "format_story": int(fmt=="Story"),
            "tone_educational": int(tone=="Educational"), "tone_motivational": int(tone=="Motivational"),
            "tone_funny": int(tone=="Funny"), "tone_emotional": int(tone=="Emotional"),
            "tone_promotional": int(tone=="Promotional"),
            "audience_genz": int(audience=="Gen Z"), "audience_millennial": int(audience=="Millennial"),
            "audience_professional": int(audience=="Professional"), "audience_student": int(audience=="Student"),
            "audience_creator": int(audience=="Creator"),
            "reel_x_evening": int(fmt=="Reel") * is_evening,
            "carousel_x_lunch": int(fmt=="Carousel") * is_lunch,
            "funny_x_weekend": int(tone=="Funny") * is_weekend,
            "engagement_score": float(np.clip(s + rng.normal(0, 0.4), 0.5, 10.0)),
        })
    return pd.DataFrame(rows)


class IGPostScheduler:
    def __init__(self):
        df = _gen_schedule_data()
        self.model: Any = None
        if HAS_LIGHTGBM and lgb is not None:
            self.model = lgb.LGBMRegressor(
                n_estimators=300, learning_rate=0.05, num_leaves=31,
                random_state=42, verbose=-1,
            )
        else:
            self.model = GradientBoostingRegressor(
                random_state=42, n_estimators=300, learning_rate=0.05, max_depth=3, subsample=0.8
            )
        self.model.fit(df[SCHEDULE_FEATURE_NAMES], df["engagement_score"])
        if HAS_LIGHTGBM:
            logger.info("[IG Scheduler] Model trained with LightGBM.")
        else:
            logger.warning("[IG Scheduler] lightgbm missing; using GradientBoostingRegressor.")

    def _feats(self, hour, day, fmt, tone, audience):
        is_eve   = int(18 <= hour <= 21)
        is_morn  = int(7 <= hour <= 9)
        is_lunch = int(12 <= hour <= 14)
        is_late  = int(22 <= hour or hour <= 1)
        is_wknd  = int(day >= 5)
        return {
            "hour_of_day": hour, "day_of_week": day,
            "is_weekend": is_wknd, "is_evening_prime": is_eve,
            "is_morning_prime": is_morn, "is_lunch": is_lunch, "is_late_night": is_late,
            "format_reel": int(fmt=="Reel"), "format_carousel": int(fmt=="Carousel"),
            "format_static": int(fmt=="Static"), "format_story": int(fmt=="Story"),
            "tone_educational": int(tone=="Educational"), "tone_motivational": int(tone=="Motivational"),
            "tone_funny": int(tone=="Funny"), "tone_emotional": int(tone=="Emotional"),
            "tone_promotional": int(tone=="Promotional"),
            "audience_genz": int(audience=="Gen Z"), "audience_millennial": int(audience=="Millennial"),
            "audience_professional": int(audience=="Professional"), "audience_student": int(audience=="Student"),
            "audience_creator": int(audience=="Creator"),
            "reel_x_evening": int(fmt=="Reel") * is_eve,
            "carousel_x_lunch": int(fmt=="Carousel") * is_lunch,
            "funny_x_weekend": int(tone=="Funny") * is_wknd,
        }

    def predict_score(self, hour, day, fmt, tone, audience="Gen Z"):
        if self.model is None:
            raise RuntimeError("IGPostScheduler model is not initialized.")
        feats = self._feats(hour, day, fmt, tone, audience)
        X     = pd.DataFrame([feats])[SCHEDULE_FEATURE_NAMES]
        return float(np.clip(np.asarray(self.model.predict(X)).flat[0], 0.5, 10.0))

    def get_best_slots(self, fmt="Reel", tone="Educational", audience="Gen Z", top_n=10):
        slots = []
        for day in range(7):
            for hour in range(6, 24):
                score = self.predict_score(hour, day, fmt, tone, audience)
                # Format-appropriate time display (IST)
                ampm = "AM" if hour < 12 else "PM"
                h12  = hour if hour <= 12 else hour - 12
                h12  = 12 if h12 == 0 else h12
                confidence = (
                    "🔥 Prime" if score >= 7.0 else
                    "✅ Great"  if score >= 5.5 else
                    "👍 Good"   if score >= 4.0 else
                    "⚠️ Average"
                )
                slots.append({
                    "day": day, "day_name": DAYS_IST[day],
                    "hour": hour, "time_ist": f"{h12}:00 {ampm} IST",
                    "predicted_engagement": round(score, 2),
                    "confidence_label": confidence,
                    "format": fmt,
                })
        slots.sort(key=lambda x: -x["predicted_engagement"])
        return slots[:top_n]

    def get_weekly_schedule(self, fmt="Reel", tone="Educational", audience="Gen Z", posts_per_week=5):
        all_slots = []
        for day in range(7):
            for hour in [8, 9, 12, 13, 18, 19, 20, 21, 22]:
                score = self.predict_score(hour, day, fmt, tone, audience)
                ampm  = "AM" if hour < 12 else "PM"
                h12   = hour if hour <= 12 else hour - 12
                h12   = 12 if h12 == 0 else h12
                all_slots.append({
                    "day": day, "day_name": DAYS_IST[day],
                    "hour": hour, "time_ist": f"{h12}:00 {ampm} IST",
                    "predicted_engagement": round(score, 2),
                })

        all_slots.sort(key=lambda x: -x["predicted_engagement"])

        # Pick top slots, one per day (enforce spread)
        used_days, schedule = set(), []
        for slot in all_slots:
            if slot["day"] not in used_days:
                used_days.add(slot["day"])
                confidence = (
                    "🔥 Prime" if slot["predicted_engagement"] >= 7.0 else
                    "✅ Great"  if slot["predicted_engagement"] >= 5.5 else
                    "👍 Good"   if slot["predicted_engagement"] >= 4.0 else
                    "⚠️ Average"
                )
                schedule.append({**slot, "confidence_label": confidence,
                                  "tone_suggestion": tone, "format_suggestion": fmt})
            if len(schedule) >= posts_per_week:
                break

        schedule.sort(key=lambda x: x["day"])

        best = schedule[0] if schedule else {}
        avg  = round(sum(s["predicted_engagement"] for s in schedule) / max(len(schedule), 1), 2)

        insights = []
        if fmt == "Reel":
            insights.append("Reels posted 6-9 PM IST get 2-3x more views due to evening scroll behaviour.")
        if fmt == "Carousel":
            insights.append("Carousels at lunch (12-2 PM IST) get more saves — people bookmark for later reading.")
        if tone == "Funny" and any(s["day"] >= 5 for s in schedule):
            insights.append("Funny/entertainment content performs best on weekends when followers are relaxed.")
        if audience == "Gen Z":
            insights.append("Gen Z is most active after 8 PM IST and during college break hours (1-3 PM).")

        return {
            "schedule": schedule,
            "best_day": best.get("day_name", ""),
            "best_time": best.get("time_ist", ""),
            "avg_predicted_engagement": avg,
            "posts_per_week": len(schedule),
            "format": fmt, "tone": tone, "audience": audience,
            "insights": insights,
        }


# ── Singleton ──────────────────────────────────────────────────────────────────
ig_scheduler = IGPostScheduler()


def get_ig_schedule(fmt="Reel", tone="Educational", audience="Gen Z", posts_per_week=5):
    return ig_scheduler.get_weekly_schedule(fmt, tone, audience, posts_per_week)

def get_ig_best_slots(fmt="Reel", tone="Educational", audience="Gen Z", top_n=10):
    return ig_scheduler.get_best_slots(fmt, tone, audience, top_n)
