"""
End-to-end demo of the Hybrid OS Content Engine.
Runs all components and prints results step by step.
"""
import sys, json, time, textwrap
from ml_model import post_predictor, trend_predictor, extract_post_features
from agent_graph import app_graph
from copilot import analyze_growth_data

LINE = "=" * 70

def section(title):
    print(f"\n{LINE}")
    print(f"  {title}")
    print(LINE)

def wrap(text, width=72):
    return "\n".join(textwrap.wrap(text, width))

# ── 1. ML Model: Post Engagement Predictor ─────────────────────────────
section("STEP 1 — LightGBM Post Engagement Predictor (standalone)")

sample_post = """🚀 5 Lessons I Learned Building AI Products in India

After 3 years of building ML-powered tools for Indian enterprises, here's what I wish someone told me:

• Data quality > model complexity — always.
• Localization isn't translation. It's cultural adaptation.
• Start with rule-based MVPs before going full ML.
• Your users don't care about F1 scores. They care about outcomes.
• Build for 2G networks. Not everyone has 5G.

What's your #1 lesson from building tech products in emerging markets?

#AI #India #ProductManagement #StartupLife #MachineLearning"""

print(f"\n📝 Sample Post:\n{wrap(sample_post)}\n")

result = post_predictor.predict_with_details(sample_post)
print(f"📊 LightGBM Engagement Score: {result['score']:.4f} (0=low, 1=high)")
print(f"\n📐 Extracted Features:")
for k, v in result["features"].items():
    print(f"   {k:30s} = {v}")
print(f"\n🔑 Top 5 Feature Importances (LightGBM gain):")
sorted_imp = sorted(result["feature_importances"].items(), key=lambda x: -x[1])[:5]
for k, v in sorted_imp:
    print(f"   {k:30s} = {v:.1f}")


# ── 2. ML Model: Trend Engagement Predictor ────────────────────────────
section("STEP 2 — LightGBM Trend Engagement Predictor (standalone)")

import pandas as pd
# Simulate recent 14 days of data
dates = pd.date_range(end="2026-03-01", periods=14)
tones = ["Educational","Story","Educational","Opinion","Educational","Story","Opinion",
         "Promotional","Promotional","Promotional","Promotional","Promotional","Promotional","Promotional"]
rates = [5.2, 4.8, 5.5, 4.1, 5.0, 5.3, 4.6, 3.8, 3.2, 2.9, 2.7, 2.5, 2.3, 2.1]
recent_df = pd.DataFrame({"date": [d.strftime("%Y-%m-%d") for d in dates],
                           "tone": tones, "engagement_rate": rates})

print("\n📈 Recent 14-day engagement data:")
print(recent_df.to_string(index=False))

predictions = trend_predictor.predict_week(recent_df)
print(f"\n🔮 LightGBM 7-day predictions (best tone per day):")
days = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]
for p in predictions:
    print(f"   Day +{p['day_offset']} ({days[p['day_of_week']]:>3s}):  "
          f"Tone={p['recommended_tone']:<14s}  Predicted Rate={p['predicted_engagement']:.2f}%")


# ── 3. Full LangGraph Pipeline ─────────────────────────────────────────
section("STEP 3 — Full LangGraph Agent Pipeline (6 nodes)")

topic = "How AI is transforming hiring in India's IT sector"
lang  = "Hindi"
print(f"\n🎯 Topic  : {topic}")
print(f"🌐 Language: {lang}")
print(f"\n⏳ Running pipeline (drafting → localization → critique → scoring → [reflexion loop?] → visuals)...\n")

initial_state = {"topic": topic, "target_language": lang, "iteration": 0}
final_state = {}
node_order = []

for step_output in app_graph.stream(initial_state):
    for node_name, node_state in step_output.items():
        final_state.update(node_state)
        node_order.append(node_name)
        print(f"   ✅ Node '{node_name}' completed")

print(f"\n📋 Node execution order: {' → '.join(node_order)}")
print(f"🔄 Total iterations: {final_state.get('iteration', 0)}")

# Show draft
section("RESULT — English Draft")
print(wrap(final_state.get("english_draft", "N/A")[:500]))

section("RESULT — Localized Draft (Hindi)")
print(final_state.get("localized_draft", "N/A")[:600])

section("RESULT — Agent Critiques")
for i, c in enumerate(final_state.get("agent_critiques", []), 1):
    agent_names = ["SEO Agent", "Brand Guardian", "Ethics Agent"]
    print(f"\n🔹 {agent_names[i-1]}:")
    print(wrap(c[:300]))

section("RESULT — Hybrid Scores")
scores = final_state.get("hybrid_score", {})
print(f"   LightGBM ML Score : {scores.get('ml', 0):.4f}")
print(f"   LLM Score         : {scores.get('llm', 0):.4f}")
print(f"   Heuristic Score   : {scores.get('heuristic', 0):.4f}")
print(f"   Final Blend (0.5×ML + 0.3×LLM + 0.2×Heur): {scores.get('final', 0):.4f}")
if scores.get("ml_top_importances"):
    print(f"\n   Top ML feature importances:")
    for k, v in scores["ml_top_importances"].items():
        print(f"      {k:30s} = {v}")

section("RESULT — Image Prompt")
print(wrap(final_state.get("image_prompt", "N/A")[:300]))
img_prompt = final_state.get("image_prompt", "")
img_url = f"https://image.pollinations.ai/prompt/{img_prompt.replace(' ', '%20')[:200]}?width=600&height=400&nologo=true"
print(f"\n🖼️  Image URL: {img_url[:120]}...")


# ── 4. Copilot Growth Analysis ─────────────────────────────────────────
section("STEP 4 — Copilot Growth Strategist (LLM + LightGBM)")
print("\n⏳ Generating trend data via LLM + running ML predictions + strategy...\n")
copilot = analyze_growth_data()

print("📈 Recent Trend (LLM-generated):")
for row in copilot["recent_trend"][:5]:
    print(f"   {row['date']}  {row['tone']:<14s}  {row['engagement_rate']:.1f}%")
print(f"   ... ({len(copilot['recent_trend'])} days total)")

print(f"\n🔮 ML Predictions (next 7 days):")
for p in copilot.get("ml_predictions", []):
    print(f"   Day +{p['day_offset']} ({days[p['day_of_week']]:>3s}):  "
          f"Tone={p['recommended_tone']:<14s}  Rate={p['predicted_engagement']:.2f}%")

print(f"\n📋 Strategy Recommendation:")
print(wrap(copilot["strategy"][:600]))

section("DEMO COMPLETE ✅")
print("All 4 stages executed successfully:")
print("  1. LightGBM PostEngagementPredictor  (standalone)")
print("  2. LightGBM TrendEngagementPredictor (standalone)")
print("  3. Full LangGraph pipeline (multi-agent + hybrid scoring + reflexion)")
print("  4. Copilot growth strategist (LLM + ML combined)")
print()
