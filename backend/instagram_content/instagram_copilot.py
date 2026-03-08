"""
Instagram Growth Copilot.

Analyzes engagement patterns, generates AI strategy recommendation,
and predicts optimal content format + tone for the next 7 days.

Mirrors copilot.py but tuned for Instagram metrics.
"""

import json
import logging
import pandas as pd
import numpy as np
from typing import Any
from bedrock_llm import ChatBedrockAPIKey
from config import BEDROCK_API_KEY, BEDROCK_MODEL_ID, AWS_REGION, LLM_TEMPERATURE, LLM_MAX_TOKENS
from instagram_ml_model import ig_trend_predictor

logger = logging.getLogger("instagram_copilot")

llm = ChatBedrockAPIKey(
    api_key=BEDROCK_API_KEY, model_id=BEDROCK_MODEL_ID,
    region=AWS_REGION, temperature=LLM_TEMPERATURE, max_tokens=LLM_MAX_TOKENS,
)

def _msg_text(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            if isinstance(item, str):
                parts.append(item)
            elif isinstance(item, dict):
                text = item.get("text")
                if isinstance(text, str):
                    parts.append(text)
        return "\n".join(p for p in parts if p)
    return str(content) if content is not None else ""

IG_FORMATS = ["Reel", "Carousel", "Static", "Story"]
IG_TONES   = ["Educational", "Motivational", "Funny", "Emotional", "Promotional"]


def _generate_ig_trend_data() -> pd.DataFrame:
    """LLM generates realistic 14-day Instagram engagement history."""
    prompt = """Generate a realistic 14-day Instagram engagement history for an Indian content creator.
Each day: date (YYYY-MM-DD, ending today 2026-03-06), format (Reel/Carousel/Static/Story),
tone (Educational/Motivational/Funny/Emotional/Promotional), engagement_rate (1.0-10.0).

Show a realistic pattern: Reels outperform, Funny/Emotional tones spike on weekends,
over-posting Promotional content causes recent decline.

Output ONLY a valid JSON array of 14 objects with keys: date, format, tone, engagement_rate.
No markdown, no explanation."""
    try:
        r    = llm.invoke(prompt)
        data = json.loads(_msg_text(r.content).strip().strip("```json").strip("```"))
        return pd.DataFrame(data)
    except Exception:
        dates = pd.date_range(end="2026-03-06", periods=14)
        return pd.DataFrame([
            {
                "date": d.strftime("%Y-%m-%d"),
                "format": np.random.choice(IG_FORMATS),
                "tone": np.random.choice(IG_TONES),
                "engagement_rate": round(float(np.random.uniform(2.0, 8.0)), 1),
            }
            for d in dates
        ])


def _generate_ig_strategy(df: pd.DataFrame, ml_predictions: list) -> str:
    recent = df.to_dict(orient="records")
    prompt = f"""You are an Instagram Growth Strategist for Indian creators.

Analyze this 14-day engagement history and ML predictions. Write a specific, actionable strategy.

14-Day History:
{json.dumps(recent, indent=2)}

ML Predictions (next 7 days — best format + tone per day):
{json.dumps(ml_predictions, indent=2)}

Write a 3-4 paragraph strategy covering:
1. What's working and what's not (based on format + tone patterns)
2. Specific content recommendations for the next week
3. Posting frequency and format mix advice
4. One "quick win" the creator can implement today

Be specific to the Indian Instagram audience. Use bold (**text**) for key points.
No generic advice — every sentence must be actionable."""
    try:
        return _msg_text(llm.invoke(prompt).content).strip()
    except Exception:
        return "**Strategy unavailable.** Please check your Bedrock connection and try again."


def analyze_ig_growth() -> dict:
    """
    Full Instagram Growth Copilot analysis.
    Returns strategy + 14-day history + 7-day ML predictions.
    """
    logger.info("[IG Copilot] Generating growth analysis...")

    df         = _generate_ig_trend_data()
    ml_preds   = ig_trend_predictor.predict_week(df)
    strategy   = _generate_ig_strategy(df, ml_preds)

    # Best format from last 14 days
    if "format" in df.columns and not df.empty:
        best_fmt = df.groupby("format")["engagement_rate"].mean().idxmax()
    else:
        best_fmt = "Reel"

    # Best tone
    if "tone" in df.columns and not df.empty:
        best_tone = df.groupby("tone")["engagement_rate"].mean().idxmax()
    else:
        best_tone = "Educational"

    logger.info("[IG Copilot] Done.")
    return {
        "strategy":       strategy,
        "recent_trend":   df.to_dict(orient="records"),
        "ml_predictions": ml_preds,
        "best_format":    best_fmt,
        "best_tone":      best_tone,
        "avg_engagement": round(float(df["engagement_rate"].mean()), 2) if not df.empty else 0.0,
    }
