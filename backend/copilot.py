import pandas as pd
import json
from bedrock_llm import ChatBedrockAPIKey
from config import BEDROCK_API_KEY, BEDROCK_MODEL_ID, AWS_REGION, LLM_TEMPERATURE, LLM_MAX_TOKENS
from ml_model import trend_predictor

llm = ChatBedrockAPIKey(
    api_key=BEDROCK_API_KEY,
    model_id=BEDROCK_MODEL_ID,
    region=AWS_REGION,
    temperature=LLM_TEMPERATURE,
    max_tokens=LLM_MAX_TOKENS,
)


def _generate_realistic_trend_data() -> pd.DataFrame:
    """Use LLM to generate realistic LinkedIn engagement trend data for 14 days."""
    prompt = """You are a LinkedIn analytics data generator. Generate a realistic 14-day engagement history
for a B2B content creator in India. Each day should have:
- date: in YYYY-MM-DD format, ending today (2026-03-01)
- tone: one of "Educational", "Promotional", "Story", "Opinion"
- engagement_rate: a float between 1.0 and 8.0 representing percentage

Make it realistic: show a pattern where over-posting Promotional content in the
most recent 4-5 days led to declining engagement compared to earlier mixed-tone days.

Output ONLY a valid JSON array of 14 objects with keys "date", "tone", "engagement_rate".
No markdown, no explanation."""

    response = llm.invoke(prompt)
    try:
        data = json.loads(response.content.strip().strip("```json").strip("```"))
        return pd.DataFrame(data)
    except (json.JSONDecodeError, Exception):
        # Fallback: minimal structured data if LLM output is malformed
        dates = pd.date_range(end=pd.Timestamp("2026-03-01"), periods=14)
        return pd.DataFrame([
            {"date": d.strftime("%Y-%m-%d"), "tone": "Educational", "engagement_rate": 4.0}
            for d in dates
        ])


def _generate_strategy(df: pd.DataFrame, ml_predictions: list = None) -> str:
    """Use LLM to analyze the trend data and produce a real strategic recommendation."""
    recent_data = df.to_dict(orient="records")

    ml_section = ""
    if ml_predictions:
        ml_section = f"""\n\nLightGBM ML Model Predictions (next 7 days):
{json.dumps(ml_predictions, indent=2)}

These are data-driven predictions from our trained LightGBM model. Incorporate them into your
recommendation and note where ML predictions align with or diverge from your qualitative analysis."""

    prompt = f"""You are a LinkedIn Growth Strategist AI. Analyze the following 14-day engagement data
for a B2B content creator targeting Indian professionals and provide a specific, actionable
content strategy recommendation for the upcoming week.

Data (last 14 days):
{json.dumps(recent_data, indent=2)}{ml_section}

Your analysis should include:
1. What pattern you observe in the data (tone mix vs engagement)
2. The quantified engagement change (percentage drop/rise)
3. A specific 7-day content plan with exact tone recommendations
4. Which topics or formats would help recover or boost engagement

Provide your recommendation in 2-3 concise paragraphs. Be specific with numbers."""

    response = llm.invoke(prompt)
    return response.content.strip()


def analyze_growth_data():
    df = _generate_realistic_trend_data()
    
    # Ensure engagement_rate is numeric
    df['engagement_rate'] = pd.to_numeric(df['engagement_rate'], errors='coerce').fillna(3.0)
    
    # LightGBM: predict optimal content plan for the next 7 days
    ml_predictions = trend_predictor.predict_week(df)
    
    # Feed ML predictions into the LLM strategy so it's ML-informed
    strategy = _generate_strategy(df, ml_predictions)
    
    return {
        "strategy": strategy,
        "recent_trend": df.to_dict(orient="records"),
        "ml_predictions": ml_predictions,
    }
