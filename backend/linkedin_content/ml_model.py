"""
LightGBM-based engagement prediction for LinkedIn posts.

Provides two models:
1. PostEngagementPredictor  – scores a single post's engagement potential (used in agent_graph scoring)
2. TrendEngagementPredictor – predicts daily engagement rate from content features (used in copilot)

Both models are trained on synthetic data bootstrapped at startup, so no external dataset is needed.
"""

import re
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

logger = logging.getLogger("ml_model")

# ═══════════════════════════════════════════════════════════════════════════════
# Feature extraction helpers
# ═══════════════════════════════════════════════════════════════════════════════

EMOJI_PATTERN = re.compile(
    "[\U0001F600-\U0001F64F"  # emoticons
    "\U0001F300-\U0001F5FF"   # symbols & pictographs
    "\U0001F680-\U0001F6FF"   # transport & map
    "\U0001F1E0-\U0001F1FF"   # flags
    "\U00002702-\U000027B0"
    "\U0001F900-\U0001F9FF"
    "\U0001FA00-\U0001FA6F"
    "\U00002600-\U000026FF"
    "]+", flags=re.UNICODE,
)

CTA_KEYWORDS = [
    "comment", "share", "follow", "like", "subscribe", "tag", "repost",
    "agree", "thoughts", "what do you think", "let me know", "dm me",
    "check out", "link in", "click", "join", "register", "sign up",
]

HASHTAG_PATTERN = re.compile(r"#\w+")


def extract_post_features(text: str) -> dict[str, float]:
    """Extract engagement-predictive features from a LinkedIn post."""
    words = text.split()
    sentences = [s.strip() for s in re.split(r'[.!?]+', text) if s.strip()]
    paragraphs = [p.strip() for p in text.split('\n\n') if p.strip()]
    lines = [l.strip() for l in text.split('\n') if l.strip()]

    word_count = len(words)
    sentence_count = max(len(sentences), 1)
    avg_sentence_len = word_count / sentence_count

    # Readability (Flesch-like approximation)
    syllable_count = sum(max(1, len(re.findall(r'[aeiouy]+', w, re.I))) for w in words) if words else 1
    avg_syllables = syllable_count / max(word_count, 1)

    hashtags = HASHTAG_PATTERN.findall(text)
    emojis = EMOJI_PATTERN.findall(text)
    bullet_lines = sum(1 for l in lines if l.startswith(('•', '-', '→', '✅', '✔', '*', '▶')))
    has_question = int('?' in text)
    has_exclamation = int('!' in text)
    has_url = int(bool(re.search(r'https?://', text)))
    cta_count = sum(1 for kw in CTA_KEYWORDS if kw.lower() in text.lower())
    uppercase_ratio = sum(1 for c in text if c.isupper()) / max(len(text), 1)
    unique_word_ratio = len(set(w.lower() for w in words)) / max(word_count, 1)

    return {
        "word_count": word_count,
        "sentence_count": sentence_count,
        "paragraph_count": len(paragraphs),
        "avg_sentence_len": avg_sentence_len,
        "avg_syllables_per_word": avg_syllables,
        "hashtag_count": len(hashtags),
        "emoji_count": len(emojis),
        "bullet_line_count": bullet_lines,
        "has_question": has_question,
        "has_exclamation": has_exclamation,
        "has_url": has_url,
        "cta_count": cta_count,
        "uppercase_ratio": uppercase_ratio,
        "unique_word_ratio": unique_word_ratio,
        "line_count": len(lines),
    }


POST_FEATURE_NAMES = list(extract_post_features("dummy").keys())


# ═══════════════════════════════════════════════════════════════════════════════
# 1.  Post Engagement Predictor (for agent_graph hybrid scoring)
# ═══════════════════════════════════════════════════════════════════════════════

def _generate_synthetic_post_data(n: int = 2000, seed: int = 42) -> pd.DataFrame:
    """
    Generate synthetic training data for post engagement prediction.
    Encodes domain knowledge about what makes a good LinkedIn post.
    """
    rng = np.random.default_rng(seed)
    rows = []

    for _ in range(n):
        word_count = rng.integers(20, 500)
        sentence_count = max(1, word_count // rng.integers(8, 25))
        paragraph_count = max(1, sentence_count // rng.integers(2, 6))
        avg_sentence_len = word_count / sentence_count
        avg_syllables = rng.uniform(1.2, 2.5)
        hashtag_count = rng.integers(0, 12)
        emoji_count = rng.integers(0, 10)
        bullet_line_count = rng.integers(0, 8)
        has_question = rng.integers(0, 2)
        has_exclamation = rng.integers(0, 2)
        has_url = rng.integers(0, 2)
        cta_count = rng.integers(0, 5)
        uppercase_ratio = rng.uniform(0.0, 0.15)
        unique_word_ratio = rng.uniform(0.3, 0.95)
        line_count = max(paragraph_count, rng.integers(1, 20))

        # Engagement score based on domain heuristics (with noise)
        score = 0.35  # base

        # Optimal word count: 100-300
        if 100 <= word_count <= 300:
            score += 0.12
        elif word_count < 50:
            score -= 0.10

        # Short sentences are better
        if avg_sentence_len < 15:
            score += 0.08

        # Structure signals
        if bullet_line_count >= 2:
            score += 0.08
        if paragraph_count >= 3:
            score += 0.05

        # Engagement hooks
        if has_question:
            score += 0.10
        if has_exclamation:
            score += 0.03
        if cta_count >= 1:
            score += 0.10
        if cta_count >= 3:
            score += 0.05

        # Emoji sweet spot: 1-4
        if 1 <= emoji_count <= 4:
            score += 0.06
        elif emoji_count > 7:
            score -= 0.05

        # Hashtag sweet spot: 3-5
        if 3 <= hashtag_count <= 5:
            score += 0.06
        elif hashtag_count > 8:
            score -= 0.05

        # URLs slightly reduce engagement on LinkedIn
        if has_url:
            score -= 0.05

        # Readability
        if avg_syllables < 1.8:
            score += 0.04

        # Vocabulary richness
        if unique_word_ratio > 0.6:
            score += 0.04

        # Add noise
        score += rng.normal(0, 0.06)
        score = float(np.clip(score, 0.05, 0.98))

        rows.append({
            "word_count": word_count,
            "sentence_count": sentence_count,
            "paragraph_count": paragraph_count,
            "avg_sentence_len": avg_sentence_len,
            "avg_syllables_per_word": avg_syllables,
            "hashtag_count": hashtag_count,
            "emoji_count": emoji_count,
            "bullet_line_count": bullet_line_count,
            "has_question": has_question,
            "has_exclamation": has_exclamation,
            "has_url": has_url,
            "cta_count": cta_count,
            "uppercase_ratio": uppercase_ratio,
            "unique_word_ratio": unique_word_ratio,
            "line_count": line_count,
            "engagement_score": score,
        })

    return pd.DataFrame(rows)


class PostEngagementPredictor:
    """LightGBM regressor that predicts post engagement score (0-1)."""

    def __init__(self):
        self.model: Any = None
        self._train()

    def _train(self):
        logger.info("Training PostEngagementPredictor on synthetic data...")
        df = _generate_synthetic_post_data()
        X = df[POST_FEATURE_NAMES]
        y = df["engagement_score"]

        if HAS_LIGHTGBM and lgb is not None:
            train_data = lgb.Dataset(X, label=y)

            params = {
                "objective": "regression",
                "metric": "rmse",
                "learning_rate": 0.05,
                "num_leaves": 31,
                "max_depth": 6,
                "min_child_samples": 20,
                "subsample": 0.8,
                "colsample_bytree": 0.8,
                "verbose": -1,
                "seed": 42,
            }

            self.model = lgb.train(
                params,
                train_data,
                num_boost_round=200,
                valid_sets=[train_data],
                callbacks=[lgb.log_evaluation(period=0)],  # suppress per-round logs
            )
            logger.info("PostEngagementPredictor trained with LightGBM.")
        else:
            logger.warning("lightgbm is not installed; falling back to GradientBoostingRegressor.")
            self.model = GradientBoostingRegressor(
                random_state=42,
                n_estimators=300,
                max_depth=3,
                learning_rate=0.05,
                subsample=0.8,
            )
            self.model.fit(X, y)
            logger.info("PostEngagementPredictor trained with GradientBoostingRegressor.")

    def predict(self, text: str) -> float:
        """Return engagement score (0-1) for a post."""
        if self.model is None:
            raise RuntimeError("PostEngagementPredictor model is not initialized.")
        features = extract_post_features(text)
        X = pd.DataFrame([features], columns=POST_FEATURE_NAMES)
        score = float(self.model.predict(X)[0])
        return max(0.0, min(1.0, score))

    def predict_with_details(self, text: str) -> dict[str, Any]:
        """Return score plus feature breakdown for explainability."""
        if self.model is None:
            raise RuntimeError("PostEngagementPredictor model is not initialized.")
        features = extract_post_features(text)
        X = pd.DataFrame([features], columns=POST_FEATURE_NAMES)
        score = float(np.clip(self.model.predict(X)[0], 0.0, 1.0))
        if HAS_LIGHTGBM and lgb is not None:
            importance_values = self.model.feature_importance(importance_type="gain")
        else:
            importance_values = getattr(self.model, "feature_importances_", np.zeros(len(POST_FEATURE_NAMES)))
        importances = dict(zip(POST_FEATURE_NAMES, importance_values))
        return {"score": score, "features": features, "feature_importances": importances}


# ═══════════════════════════════════════════════════════════════════════════════
# 2.  Trend Engagement Predictor  (for copilot growth analysis)
# ═══════════════════════════════════════════════════════════════════════════════

TONE_MAP = {"Educational": 0, "Promotional": 1, "Story": 2, "Opinion": 3}
TREND_FEATURE_NAMES = [
    "day_of_week", "tone_encoded", "is_promotional",
    "rolling_avg_3d", "posts_last_7d", "days_since_last_post",
]


def _generate_synthetic_trend_data(n: int = 500, seed: int = 99) -> pd.DataFrame:
    """Synthetic daily engagement data encoding realistic patterns."""
    rng = np.random.default_rng(seed)
    rows = []

    for i in range(n):
        day_of_week = rng.integers(0, 7)
        tone = rng.choice(["Educational", "Promotional", "Story", "Opinion"],
                          p=[0.35, 0.25, 0.25, 0.15])
        tone_encoded = TONE_MAP[tone]
        is_promotional = int(tone == "Promotional")
        rolling_avg_3d = rng.uniform(2.0, 6.5)
        posts_last_7d = rng.integers(1, 8)
        days_since_last_post = rng.integers(0, 5)

        # Engagement formula
        rate = 4.0  # base

        if tone == "Educational":
            rate += rng.uniform(0.5, 1.5)
        elif tone == "Story":
            rate += rng.uniform(0.3, 1.8)
        elif tone == "Opinion":
            rate += rng.uniform(0.0, 1.2)
        elif tone == "Promotional":
            rate -= rng.uniform(0.3, 1.5)

        # Weekday boost (Tue-Thu)
        if day_of_week in (1, 2, 3):
            rate += 0.5
        elif day_of_week in (5, 6):
            rate -= 0.4

        # Over-posting penalty
        if posts_last_7d > 5:
            rate -= 0.6

        # Consistency reward
        if days_since_last_post <= 1:
            rate += 0.3
        elif days_since_last_post >= 3:
            rate -= 0.4

        # Momentum
        rate += (rolling_avg_3d - 4.0) * 0.15

        rate += rng.normal(0, 0.3)
        rate = float(np.clip(rate, 1.0, 8.0))

        rows.append({
            "day_of_week": day_of_week,
            "tone": tone,
            "tone_encoded": tone_encoded,
            "is_promotional": is_promotional,
            "rolling_avg_3d": rolling_avg_3d,
            "posts_last_7d": posts_last_7d,
            "days_since_last_post": days_since_last_post,
            "engagement_rate": rate,
        })

    return pd.DataFrame(rows)


class TrendEngagementPredictor:
    """LightGBM regressor that predicts daily engagement rate from content features."""

    def __init__(self):
        self.model: Any = None
        self._train()

    def _train(self):
        logger.info("Training TrendEngagementPredictor on synthetic data...")
        df = _generate_synthetic_trend_data()
        X = df[TREND_FEATURE_NAMES]
        y = df["engagement_rate"]

        if HAS_LIGHTGBM and lgb is not None:
            train_data = lgb.Dataset(X, label=y)

            params = {
                "objective": "regression",
                "metric": "rmse",
                "learning_rate": 0.05,
                "num_leaves": 24,
                "max_depth": 5,
                "min_child_samples": 15,
                "subsample": 0.8,
                "colsample_bytree": 0.8,
                "verbose": -1,
                "seed": 99,
            }

            self.model = lgb.train(
                params,
                train_data,
                num_boost_round=150,
                valid_sets=[train_data],
                callbacks=[lgb.log_evaluation(period=0)],
            )
            logger.info("TrendEngagementPredictor trained with LightGBM.")
        else:
            self.model = GradientBoostingRegressor(
                random_state=99,
                n_estimators=250,
                max_depth=3,
                learning_rate=0.05,
                subsample=0.8,
            )
            self.model.fit(X, y)
            logger.info("TrendEngagementPredictor trained with GradientBoostingRegressor.")

    def predict_engagement(self, tone: str, day_of_week: int,
                           rolling_avg_3d: float, posts_last_7d: int,
                           days_since_last_post: int) -> float:
        """Predict engagement rate for a single day."""
        if self.model is None:
            raise RuntimeError("TrendEngagementPredictor model is not initialized.")
        tone_encoded = TONE_MAP.get(tone, 0)
        is_promotional = int(tone == "Promotional")
        X = pd.DataFrame([{
            "day_of_week": day_of_week,
            "tone_encoded": tone_encoded,
            "is_promotional": is_promotional,
            "rolling_avg_3d": rolling_avg_3d,
            "posts_last_7d": posts_last_7d,
            "days_since_last_post": days_since_last_post,
        }], columns=TREND_FEATURE_NAMES)
        return float(np.clip(self.model.predict(X)[0], 1.0, 8.0))

    def predict_week(self, recent_df: pd.DataFrame) -> list[dict[str, int | float | str]]:
        """Predict next 7 days of engagement for each tone to find optimal plan."""
        if recent_df.empty:
            return []

        # Compute context from recent data
        last_3 = float(recent_df.tail(3)["engagement_rate"].mean())
        posts_7d = len(recent_df.tail(7))

        tones = ["Educational", "Promotional", "Story", "Opinion"]
        today_dow = pd.Timestamp.now().dayofweek
        predictions = []

        for day_offset in range(1, 8):
            dow = (today_dow + day_offset) % 7
            best_tone = "Educational"
            best_rate = -1.0

            for tone in tones:
                rate = self.predict_engagement(
                    tone=tone, day_of_week=dow,
                    rolling_avg_3d=last_3, posts_last_7d=posts_7d,
                    days_since_last_post=day_offset if day_offset == 1 else 1,
                )
                if rate > best_rate:
                    best_rate = rate
                    best_tone = tone

            predictions.append({
                "day_offset": day_offset,
                "day_of_week": dow,
                "recommended_tone": best_tone,
                "predicted_engagement": round(best_rate, 2),
            })

        return predictions


# ═══════════════════════════════════════════════════════════════════════════════
# Module-level singletons (trained once at import time)
# ═══════════════════════════════════════════════════════════════════════════════

post_predictor = PostEngagementPredictor()
trend_predictor = TrendEngagementPredictor()
