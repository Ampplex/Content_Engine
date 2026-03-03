"""
Test suite for ml_model.py — LightGBM engagement prediction models.

Run:  python test_ml_model.py
"""

import sys
import time
import numpy as np
import pandas as pd

# ── Import the module under test ──────────────────────────────────────────────
from ml_model import (
    extract_post_features,
    PostEngagementPredictor,
    TrendEngagementPredictor,
    POST_FEATURE_NAMES,
    TREND_FEATURE_NAMES,
    _generate_synthetic_post_data,
    _generate_synthetic_trend_data,
)

PASS = 0
FAIL = 0


def ok(name):
    global PASS
    PASS += 1
    print(f"  ✅  {name}")


def fail(name, detail=""):
    global FAIL
    FAIL += 1
    print(f"  ❌  {name}  — {detail}")


# ═══════════════════════════════════════════════════════════════════════════════
# 1. Feature Extraction Tests
# ═══════════════════════════════════════════════════════════════════════════════
print("\n━━━ 1. Feature Extraction ━━━")

sample_post = """🚀 AI is transforming Indian agriculture!

Here's how:
• Precision weather forecasting
• Soil health analysis via drones
• Market price prediction for farmers

What do you think? Share your thoughts below! 👇

#AI #Agriculture #India #FarmTech #Innovation"""

features = extract_post_features(sample_post)

# Check all expected feature keys are present
if set(features.keys()) == set(POST_FEATURE_NAMES):
    ok("All 15 feature keys present")
else:
    fail("Feature keys mismatch", f"got {set(features.keys())}")

# Check types
if all(isinstance(v, (int, float)) for v in features.values()):
    ok("All feature values are numeric")
else:
    fail("Non-numeric feature values found")

# Sanity checks on specific features
if features["has_question"] == 1:
    ok("has_question detected '?'")
else:
    fail("has_question", f"expected 1, got {features['has_question']}")

if features["has_exclamation"] == 1:
    ok("has_exclamation detected '!'")
else:
    fail("has_exclamation", f"expected 1, got {features['has_exclamation']}")

if features["hashtag_count"] == 5:
    ok(f"hashtag_count = {features['hashtag_count']}")
else:
    fail("hashtag_count", f"expected 5, got {features['hashtag_count']}")

if features["bullet_line_count"] >= 3:
    ok(f"bullet_line_count = {features['bullet_line_count']}")
else:
    fail("bullet_line_count", f"expected >= 3, got {features['bullet_line_count']}")

if features["cta_count"] >= 2:
    ok(f"cta_count = {features['cta_count']} (share, thoughts, what do you think)")
else:
    fail("cta_count", f"expected >= 2, got {features['cta_count']}")

if features["word_count"] > 20:
    ok(f"word_count = {features['word_count']}")
else:
    fail("word_count", f"expected > 20, got {features['word_count']}")

# Edge case: empty string
empty_features = extract_post_features("")
if empty_features["word_count"] == 0 and empty_features["has_question"] == 0:
    ok("Empty string handled gracefully")
else:
    fail("Empty string handling")


# ═══════════════════════════════════════════════════════════════════════════════
# 2. Synthetic Data Generation
# ═══════════════════════════════════════════════════════════════════════════════
print("\n━━━ 2. Synthetic Data Generation ━━━")

post_df = _generate_synthetic_post_data(n=500)
if len(post_df) == 500:
    ok(f"Post dataset: {len(post_df)} rows generated")
else:
    fail("Post dataset size", f"expected 500, got {len(post_df)}")

if set(POST_FEATURE_NAMES + ["engagement_score"]).issubset(set(post_df.columns)):
    ok("Post dataset has all required columns")
else:
    fail("Post dataset columns", f"missing: {set(POST_FEATURE_NAMES + ['engagement_score']) - set(post_df.columns)}")

scores = post_df["engagement_score"]
if scores.min() >= 0.0 and scores.max() <= 1.0:
    ok(f"Post scores in [0, 1]: min={scores.min():.3f}, max={scores.max():.3f}, mean={scores.mean():.3f}")
else:
    fail("Post scores out of range", f"min={scores.min()}, max={scores.max()}")

trend_df = _generate_synthetic_trend_data(n=300)
if len(trend_df) == 300:
    ok(f"Trend dataset: {len(trend_df)} rows generated")
else:
    fail("Trend dataset size", f"expected 300, got {len(trend_df)}")

rates = trend_df["engagement_rate"]
if rates.min() >= 1.0 and rates.max() <= 8.0:
    ok(f"Trend rates in [1, 8]: min={rates.min():.2f}, max={rates.max():.2f}, mean={rates.mean():.2f}")
else:
    fail("Trend rates out of range", f"min={rates.min()}, max={rates.max()}")


# ═══════════════════════════════════════════════════════════════════════════════
# 3. PostEngagementPredictor — Training & Prediction
# ═══════════════════════════════════════════════════════════════════════════════
print("\n━━━ 3. PostEngagementPredictor ━━━")

t0 = time.time()
predictor = PostEngagementPredictor()
train_time = time.time() - t0
ok(f"Trained in {train_time:.2f}s")

# Good post (structured, CTA, hashtags, emoji, question)
good_post = """🔥 5 lessons I learned building AI products for Indian farmers

After 2 years and 50,000+ users, here's what I wish I knew on day 1:

1. Start with the problem, not the tech
2. Speak in the farmer's language — literally
3. Offline-first is non-negotiable in rural India
4. Trust > Features, always
5. Community feedback loops accelerate everything

The biggest surprise? Farmers taught US more about AI than we expected.

What's the most surprising thing you've learned from your users? 👇

#AgriTech #India #AI #Startups #ProductManagement"""

good_score = predictor.predict(good_post)
if 0.0 <= good_score <= 1.0:
    ok(f"Good post score: {good_score:.4f}")
else:
    fail("Good post score out of range", f"{good_score}")

# Bad post (short, no structure, no CTA, no hashtags)
bad_post = "product update link"
bad_score = predictor.predict(bad_post)
if 0.0 <= bad_score <= 1.0:
    ok(f"Bad post score: {bad_score:.4f}")
else:
    fail("Bad post score out of range", f"{bad_score}")

if good_score > bad_score:
    ok(f"Good post ({good_score:.3f}) > Bad post ({bad_score:.3f}) ✓")
else:
    fail("Score ordering", f"Good ({good_score:.3f}) should be > Bad ({bad_score:.3f})")

# Detailed prediction
details = predictor.predict_with_details(good_post)
if "score" in details and "features" in details and "feature_importances" in details:
    ok("predict_with_details returns score, features, importances")
else:
    fail("predict_with_details missing keys")

if len(details["feature_importances"]) == len(POST_FEATURE_NAMES):
    top_3 = sorted(details["feature_importances"].items(), key=lambda x: -x[1])[:3]
    ok(f"Top 3 features by importance: {[(k, round(v, 1)) for k, v in top_3]}")
else:
    fail("Feature importances count mismatch")

# Batch consistency — same input → same output
scores = [predictor.predict(good_post) for _ in range(5)]
if len(set(scores)) == 1:
    ok("Deterministic: 5 identical calls → same score")
else:
    fail("Non-deterministic predictions", f"got {scores}")


# ═══════════════════════════════════════════════════════════════════════════════
# 4. TrendEngagementPredictor — Training & Prediction
# ═══════════════════════════════════════════════════════════════════════════════
print("\n━━━ 4. TrendEngagementPredictor ━━━")

t0 = time.time()
trend_pred = TrendEngagementPredictor()
train_time = time.time() - t0
ok(f"Trained in {train_time:.2f}s")

# Single prediction
rate = trend_pred.predict_engagement(
    tone="Educational", day_of_week=2,  # Wednesday
    rolling_avg_3d=4.5, posts_last_7d=4, days_since_last_post=1
)
if 1.0 <= rate <= 8.0:
    ok(f"Single prediction: {rate:.2f}%")
else:
    fail("Single prediction out of range", f"{rate}")

# Educational vs Promotional on same day
edu_rate = trend_pred.predict_engagement("Educational", 2, 4.5, 4, 1)
promo_rate = trend_pred.predict_engagement("Promotional", 2, 4.5, 4, 1)
if edu_rate > promo_rate:
    ok(f"Educational ({edu_rate:.2f}) > Promotional ({promo_rate:.2f}) ✓")
else:
    fail("Tone ordering", f"Educational ({edu_rate:.2f}) should be > Promotional ({promo_rate:.2f})")

# Weekday vs Weekend
weekday_rate = trend_pred.predict_engagement("Educational", 2, 4.5, 4, 1)  # Wednesday
weekend_rate = trend_pred.predict_engagement("Educational", 6, 4.5, 4, 1)  # Sunday
if weekday_rate > weekend_rate:
    ok(f"Weekday ({weekday_rate:.2f}) > Weekend ({weekend_rate:.2f}) ✓")
else:
    fail("Day ordering", f"Weekday ({weekday_rate:.2f}) should be > Weekend ({weekend_rate:.2f})")


# ═══════════════════════════════════════════════════════════════════════════════
# 5. Weekly Prediction Plan
# ═══════════════════════════════════════════════════════════════════════════════
print("\n━━━ 5. Weekly Prediction Plan ━━━")

# Build a mock recent trend DataFrame
recent = pd.DataFrame([
    {"date": "2026-02-23", "tone": "Educational",  "engagement_rate": 5.2},
    {"date": "2026-02-24", "tone": "Story",         "engagement_rate": 4.8},
    {"date": "2026-02-25", "tone": "Promotional",   "engagement_rate": 3.1},
    {"date": "2026-02-26", "tone": "Promotional",   "engagement_rate": 2.9},
    {"date": "2026-02-27", "tone": "Promotional",   "engagement_rate": 2.5},
    {"date": "2026-02-28", "tone": "Promotional",   "engagement_rate": 2.3},
    {"date": "2026-03-01", "tone": "Educational",   "engagement_rate": 3.8},
])

plan = trend_pred.predict_week(recent)

if len(plan) == 7:
    ok(f"7-day plan generated")
else:
    fail("Plan length", f"expected 7, got {len(plan)}")

if all("recommended_tone" in d and "predicted_engagement" in d for d in plan):
    ok("Each day has recommended_tone & predicted_engagement")
else:
    fail("Plan entries missing keys")

print("\n  📅 Recommended 7-day plan:")
DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
for d in plan:
    day_name = DAYS[d["day_of_week"]]
    print(f"     Day +{d['day_offset']} ({day_name}): {d['recommended_tone']:13s} → {d['predicted_engagement']:.2f}%")

all_valid = all(1.0 <= d["predicted_engagement"] <= 8.0 for d in plan)
if all_valid:
    ok("All predicted rates in valid range [1, 8]")
else:
    fail("Some predicted rates out of range")

# Empty DF edge case
empty_plan = trend_pred.predict_week(pd.DataFrame())
if empty_plan == []:
    ok("Empty DataFrame returns empty plan")
else:
    fail("Empty DataFrame handling", f"got {empty_plan}")


# ═══════════════════════════════════════════════════════════════════════════════
# 6. Model Accuracy on Training Data (sanity check)
# ═══════════════════════════════════════════════════════════════════════════════
print("\n━━━ 6. Training-set Accuracy ━━━")

from sklearn.metrics import mean_absolute_error, r2_score

# PostEngagementPredictor
post_data = _generate_synthetic_post_data()
X_post = post_data[POST_FEATURE_NAMES]
y_post = post_data["engagement_score"]
y_pred_post = predictor.model.predict(X_post)
y_pred_post = np.clip(y_pred_post, 0.0, 1.0)

mae_post = mean_absolute_error(y_post, y_pred_post)
r2_post = r2_score(y_post, y_pred_post)
if mae_post < 0.10:
    ok(f"Post model MAE = {mae_post:.4f} (< 0.10)")
else:
    fail(f"Post model MAE too high: {mae_post:.4f}")
if r2_post > 0.5:
    ok(f"Post model R² = {r2_post:.4f} (> 0.50)")
else:
    fail(f"Post model R² too low: {r2_post:.4f}")

# TrendEngagementPredictor
trend_data = _generate_synthetic_trend_data()
X_trend = trend_data[TREND_FEATURE_NAMES]
y_trend = trend_data["engagement_rate"]
y_pred_trend = trend_pred.model.predict(X_trend)
y_pred_trend = np.clip(y_pred_trend, 1.0, 8.0)

mae_trend = mean_absolute_error(y_trend, y_pred_trend)
r2_trend = r2_score(y_trend, y_pred_trend)
if mae_trend < 0.50:
    ok(f"Trend model MAE = {mae_trend:.4f} (< 0.50)")
else:
    fail(f"Trend model MAE too high: {mae_trend:.4f}")
if r2_trend > 0.5:
    ok(f"Trend model R² = {r2_trend:.4f} (> 0.50)")
else:
    fail(f"Trend model R² too low: {r2_trend:.4f}")


# ═══════════════════════════════════════════════════════════════════════════════
# Summary
# ═══════════════════════════════════════════════════════════════════════════════
print(f"\n{'━' * 50}")
print(f"  Results:  {PASS} passed, {FAIL} failed")
print(f"{'━' * 50}\n")

sys.exit(0 if FAIL == 0 else 1)
