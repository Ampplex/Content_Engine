"""
Instagram LightGBM Engagement Models.

Two models:
  1. InstagramCaptionPredictor  — scores caption engagement potential (0-1)
  2. InstagramTrendPredictor    — predicts best format + reach for next 7 days

Instagram-specific features: emoji density, hashtag sweet spot (20-30),
caption length, reel vs carousel vs static, CTA style, line breaks, etc.
"""

import re
import logging
import datetime
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

logger = logging.getLogger("instagram_ml_model")

EMOJI_PATTERN = re.compile(
    "[\U0001F600-\U0001F64F\U0001F300-\U0001F5FF\U0001F680-\U0001F6FF"
    "\U0001F1E0-\U0001F1FF\U00002702-\U000027B0\U0001F900-\U0001F9FF"
    "\U0001FA00-\U0001FA6F\U00002600-\U000026FF]+", flags=re.UNICODE,
)
HASHTAG_PATTERN = re.compile(r"#\w+")
MENTION_PATTERN = re.compile(r"@\w+")

IG_CTA_KEYWORDS = [
    "save this", "share this", "follow", "comment below", "tag a friend",
    "dm me", "link in bio", "swipe", "double tap", "drop a", "tell me",
    "what do you think", "agree", "which one", "your thoughts", "repost",
]

IG_FORMATS = ["Reel", "Carousel", "Static", "Story"]
IG_TONES   = ["Educational", "Motivational", "Funny", "Emotional", "Promotional"]

CAPTION_FEATURE_NAMES = [
    "char_count", "word_count", "line_count", "emoji_count", "emoji_density",
    "hashtag_count", "hashtag_in_optimal", "mention_count", "has_question",
    "has_cta", "cta_count", "has_line_breaks", "starts_with_emoji",
    "first_line_short", "has_numbers", "exclamation_count",
]

TREND_FEATURE_NAMES = [
    "format_reel", "format_carousel", "format_static", "format_story",
    "tone_educational", "tone_motivational", "tone_funny", "tone_emotional",
    "tone_promotional", "day_of_week", "hour_of_day", "is_evening",
    "is_morning", "is_weekend", "posts_last_7d", "rolling_avg_3d",
]


def extract_caption_features(text: str) -> dict[str, float]:
    if not text:
        return {f: 0.0 for f in CAPTION_FEATURE_NAMES}
    lines    = [l for l in text.split("\n") if l.strip()]
    words    = text.split()
    emojis   = EMOJI_PATTERN.findall(text)
    tags     = HASHTAG_PATTERN.findall(text)
    mentions = MENTION_PATTERN.findall(text)
    lower    = text.lower()
    cta_hits = sum(1 for kw in IG_CTA_KEYWORDS if kw in lower)
    first_w  = len(lines[0].split()) if lines else 0
    return {
        "char_count":        len(text),
        "word_count":        len(words),
        "line_count":        len(lines),
        "emoji_count":       len(emojis),
        "emoji_density":     len(emojis) / max(len(words), 1),
        "hashtag_count":     len(tags),
        "hashtag_in_optimal": int(15 <= len(tags) <= 30),
        "mention_count":     len(mentions),
        "has_question":      int("?" in text),
        "has_cta":           int(cta_hits > 0),
        "cta_count":         cta_hits,
        "has_line_breaks":   int(len(lines) > 2),
        "starts_with_emoji": int(len(emojis) > 0 and text.strip().startswith(emojis[0][:1])),
        "first_line_short":  int(first_w <= 8),
        "has_numbers":       int(bool(re.search(r"\d", text))),
        "exclamation_count": text.count("!"),
    }


def _gen_caption_data(n: int = 2500) -> pd.DataFrame:
    rng  = np.random.default_rng(42)
    rows = []
    for _ in range(n):
        hc = int(rng.integers(0, 36)); ec = int(rng.integers(0, 16))
        wc = int(rng.integers(5, 100)); cta = int(rng.integers(0, 4))
        s  = 0.35
        if 20 <= hc <= 30: s += 0.25
        elif 15 <= hc < 20: s += 0.14
        elif hc < 5: s -= 0.10
        if 3 <= ec <= 8: s += 0.14
        elif ec > 12: s -= 0.10
        if wc < 30: s += 0.14
        elif wc > 100: s -= 0.10
        if cta >= 1: s += 0.10
        se = int(rng.integers(0, 2)); fs = int(rng.integers(0, 2))
        hl = int(rng.integers(0, 2)); hq = int(rng.integers(0, 2))
        if se: s += 0.07
        if fs: s += 0.06
        if hl: s += 0.05
        if hq: s += 0.08
        rows.append({
            "char_count": wc*5, "word_count": wc, "line_count": int(rng.integers(1, 10)),
            "emoji_count": ec, "emoji_density": ec/max(wc,1), "hashtag_count": hc,
            "hashtag_in_optimal": int(15<=hc<=30), "mention_count": int(rng.integers(0,4)),
            "has_question": hq, "has_cta": int(cta>0), "cta_count": cta,
            "has_line_breaks": hl, "starts_with_emoji": se, "first_line_short": fs,
            "has_numbers": int(rng.integers(0,2)), "exclamation_count": int(rng.integers(0,5)),
            "engagement_score": float(np.clip(s + rng.normal(0, 0.05), 0.0, 1.0)),
        })
    return pd.DataFrame(rows)


def _gen_trend_data(n: int = 4000) -> pd.DataFrame:
    rng  = np.random.default_rng(42)
    rows = []
    for _ in range(n):
        fmt  = str(rng.choice(IG_FORMATS)); tone = str(rng.choice(IG_TONES))
        day  = int(rng.integers(0, 7));    hour = int(rng.integers(6, 23))
        p7d  = int(rng.integers(1, 15));   roll = float(rng.uniform(1.0, 10.0))
        s    = 3.0
        if fmt=="Reel": s+=2.5
        elif fmt=="Carousel": s+=1.5
        elif fmt=="Story": s+=0.8
        else: s+=0.3
        if tone=="Funny": s+=1.2
        elif tone=="Emotional": s+=1.0
        elif tone=="Motivational": s+=0.8
        elif tone=="Educational": s+=0.6
        else: s-=0.3
        if 18<=hour<=21: s+=1.5
        elif 7<=hour<=9: s+=0.8
        elif hour<6: s-=1.5
        if day in [4,5,6]: s+=0.5
        elif day in [1,2]: s+=0.3
        if p7d>10: s-=0.8
        elif p7d>7: s-=0.3
        rows.append({
            "format_reel": int(fmt=="Reel"), "format_carousel": int(fmt=="Carousel"),
            "format_static": int(fmt=="Static"), "format_story": int(fmt=="Story"),
            "tone_educational": int(tone=="Educational"), "tone_motivational": int(tone=="Motivational"),
            "tone_funny": int(tone=="Funny"), "tone_emotional": int(tone=="Emotional"),
            "tone_promotional": int(tone=="Promotional"),
            "day_of_week": day, "hour_of_day": hour,
            "is_evening": int(18<=hour<=21), "is_morning": int(7<=hour<=9),
            "is_weekend": int(day>=5), "posts_last_7d": p7d, "rolling_avg_3d": roll,
            "engagement_rate": float(np.clip(s + rng.normal(0, 0.4), 1.0, 10.0)),
        })
    return pd.DataFrame(rows)


class InstagramCaptionPredictor:
    def __init__(self):
        df = _gen_caption_data()
        self.model: Any = None
        if HAS_LIGHTGBM and lgb is not None:
            self.model = lgb.LGBMRegressor(
                n_estimators=250, learning_rate=0.05,
                num_leaves=31, random_state=42, verbose=-1
            )
        else:
            self.model = GradientBoostingRegressor(
                random_state=42, n_estimators=250, learning_rate=0.05, max_depth=3, subsample=0.8
            )
        self.model.fit(df[CAPTION_FEATURE_NAMES], df["engagement_score"])
        if HAS_LIGHTGBM:
            logger.info("[IG] CaptionPredictor trained with LightGBM.")
        else:
            logger.warning("[IG] lightgbm missing; CaptionPredictor using GradientBoostingRegressor.")

    def predict(self, caption: str) -> float:
        X = pd.DataFrame([extract_caption_features(caption)])[CAPTION_FEATURE_NAMES]
        return float(np.clip(np.asarray(self.model.predict(X)).flat[0], 0.0, 1.0))

    def predict_with_details(self, caption: str) -> dict:
        feats = extract_caption_features(caption)
        X     = pd.DataFrame([feats])[CAPTION_FEATURE_NAMES]
        score = float(np.clip(np.asarray(self.model.predict(X)).flat[0], 0.0, 1.0))
        if HAS_LIGHTGBM:
            imp_values = np.asarray(self.model.feature_importances_).tolist()
        else:
            imp_values = np.asarray(getattr(self.model, "feature_importances_", np.zeros(len(CAPTION_FEATURE_NAMES)))).tolist()
        imps  = dict(zip(CAPTION_FEATURE_NAMES, imp_values))
        top5  = {k: round(v,1) for k,v in sorted(imps.items(), key=lambda x:-x[1])[:5]}
        return {"score": score, "features": feats, "feature_importances": imps, "top_importances": top5}


class InstagramTrendPredictor:
    def __init__(self):
        df = _gen_trend_data()
        self.model: Any = None
        if HAS_LIGHTGBM and lgb is not None:
            self.model = lgb.LGBMRegressor(
                n_estimators=300, learning_rate=0.05,
                num_leaves=31, random_state=42, verbose=-1
            )
        else:
            self.model = GradientBoostingRegressor(
                random_state=42, n_estimators=300, learning_rate=0.05, max_depth=3, subsample=0.8
            )
        self.model.fit(df[TREND_FEATURE_NAMES], df["engagement_rate"])
        if HAS_LIGHTGBM:
            logger.info("[IG] TrendPredictor trained with LightGBM.")
        else:
            logger.warning("[IG] lightgbm missing; TrendPredictor using GradientBoostingRegressor.")

    def _feats(self, fmt, tone, day, hour, roll, p7d):
        return {
            "format_reel": int(fmt=="Reel"), "format_carousel": int(fmt=="Carousel"),
            "format_static": int(fmt=="Static"), "format_story": int(fmt=="Story"),
            "tone_educational": int(tone=="Educational"), "tone_motivational": int(tone=="Motivational"),
            "tone_funny": int(tone=="Funny"), "tone_emotional": int(tone=="Emotional"),
            "tone_promotional": int(tone=="Promotional"),
            "day_of_week": day, "hour_of_day": hour,
            "is_evening": int(18<=hour<=21), "is_morning": int(7<=hour<=9),
            "is_weekend": int(day>=5), "posts_last_7d": p7d, "rolling_avg_3d": roll,
        }

    def predict_week(self, recent_df: pd.DataFrame) -> list:
        if recent_df.empty:
            roll, p7d = 4.0, 5
        else:
            recent_df = recent_df.copy()
            recent_df["engagement_rate"] = pd.to_numeric(
                recent_df.get("engagement_rate", 4.0), errors="coerce").fillna(4.0)
            roll = float(recent_df["engagement_rate"].tail(3).mean())
            p7d  = len(recent_df.tail(7))

        today   = datetime.date.today()
        results = []
        for offset in range(1, 8):
            day = (today + datetime.timedelta(days=offset)).weekday()
            best_s, best_fmt, best_tone = -1.0, "Reel", "Educational"
            for fmt in IG_FORMATS:
                for tone in IG_TONES:
                    X = pd.DataFrame([self._feats(fmt, tone, day, 19, roll, p7d)])[TREND_FEATURE_NAMES]
                    s = float(np.clip(np.asarray(self.model.predict(X)).flat[0], 1.0, 10.0))
                    if s > best_s:
                        best_s, best_fmt, best_tone = s, fmt, tone
            results.append({
                "day_offset": offset, "day_of_week": day,
                "recommended_format": best_fmt, "recommended_tone": best_tone,
                "predicted_engagement": round(best_s, 2),
            })
        return results


ig_caption_predictor = InstagramCaptionPredictor()
ig_trend_predictor   = InstagramTrendPredictor()
