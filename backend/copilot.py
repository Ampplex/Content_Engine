import pandas as pd
import json
from langchain_google_genai import ChatGoogleGenerativeAI
from config import GOOGLE_API_KEY, LLM_MODEL, LLM_TEMPERATURE, LLM_MAX_TOKENS

llm = ChatGoogleGenerativeAI(
    model=LLM_MODEL,
    temperature=LLM_TEMPERATURE,
    max_tokens=LLM_MAX_TOKENS,
    google_api_key=GOOGLE_API_KEY,
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


def _generate_strategy(df: pd.DataFrame) -> str:
    """Use LLM to analyze the trend data and produce a real strategic recommendation."""
    recent_data = df.to_dict(orient="records")
    
    prompt = f"""You are a LinkedIn Growth Strategist AI. Analyze the following 14-day engagement data
for a B2B content creator targeting Indian professionals and provide a specific, actionable
content strategy recommendation for the upcoming week.

Data (last 14 days):
{json.dumps(recent_data, indent=2)}

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
    
    strategy = _generate_strategy(df)
    
    return {
        "strategy": strategy,
        "recent_trend": df.to_dict(orient="records")
    }
