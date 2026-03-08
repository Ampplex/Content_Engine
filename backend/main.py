from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from starlette.responses import StreamingResponse
from pydantic import BaseModel
from agent_graph import app_graph, PostState
from typing import Optional
from copilot import analyze_growth_data
from linkedin_api import (
    get_authorization_url, exchange_code_for_token,
    fetch_real_engagement_data, get_profile_summary,
)
from competitor_analysis import analyze_competitors
from scheduler import get_optimal_schedule, get_best_posting_slots
import traceback
import json
import logging
import secrets
import sys
from pathlib import Path

logger = logging.getLogger("api")

app = FastAPI()

# Serve generated images as static files
images_dir = Path(__file__).parent / "generated_images"
images_dir.mkdir(exist_ok=True)
app.mount("/generated_images", StaticFiles(directory=str(images_dir)), name="generated_images")

# Mount Instagram content engine under the same API server.
# This avoids running a second uvicorn process for instagram_content.
ig_dir = Path(__file__).parent / "instagram_content"
if ig_dir.exists():
    if str(ig_dir) not in sys.path:
        sys.path.insert(0, str(ig_dir))
    try:
        from instagram_main import app as instagram_app
        app.mount("/instagram", instagram_app)
        logger.info("Mounted instagram_content app at /instagram")
    except Exception as e:
        logger.warning(f"instagram_content app mount failed: {e}")

# Enable CORS for React Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Change to localhost in prod
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class PostRequest(BaseModel):
    topic: str
    target_language: str

class RefineRequest(BaseModel):
    topic: str
    target_language: str
    previous_draft: str
    previous_critiques: list[str] = []

# Map LangGraph node names to frontend pipeline step indices
NODE_TO_STEP = {
    "drafting":            0,
    "competitor_analysis": 1,   # ← NEW
    "trend_search":        2,
    "hook_gen":            3,
    "localization":        4,
    "critique":            5,   # covers steps 5,6,7 (SEO, Brand, Ethics)
    "scoring":             8,
    "visuals":             9,
    "ab_variants":         10,  # ← NEW
}

class ScheduleRequest(BaseModel):
    tone:           str = "Educational"
    audience:       str = "General"
    posts_per_week: int = 5

class CompetitorRequest(BaseModel):
    topic: str
    enrich_hashtags: bool = True

def _sse_event(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"

@app.post("/api/generate")
async def generate_post(req: PostRequest):
    def stream_pipeline():
        try:
            initial_state: PostState = {"topic": req.topic, "target_language": req.target_language, "iteration": 0}
            final_state = {}
            current_iteration = 0

            # stream() yields {node_name: state_update} after each node completes
            for step_output in app_graph.stream(initial_state):
                for node_name, node_state in step_output.items():
                    final_state.update(node_state)
                    step_index = NODE_TO_STEP.get(node_name, -1)
                    iteration = final_state.get("iteration", 0)

                    # Detect reflexion loop: drafting node fires again with a higher iteration
                    if node_name == "drafting" and iteration > current_iteration:
                        prev_score = final_state.get("hybrid_score", {}).get("final", 0)
                        logger.info(f"[SSE] REFLEXION triggered! Iteration {current_iteration} -> {iteration} (score was {prev_score:.4f})")
                        current_iteration = iteration
                        yield _sse_event("reflexion", {
                            "iteration": iteration,
                            "previous_score": round(prev_score, 4),
                            "reason": f"Score {prev_score:.2%} < 75% threshold — refining draft (attempt {iteration})"
                        })

                    logger.info(f"[SSE] Node '{node_name}' completed -> step {step_index} (iter {iteration})")

                    # For critique node, emit 3 sub-steps (SEO=5, Brand=6, Ethics=7)
                    if node_name == "critique":
                        yield _sse_event("node_done", {"step": 5, "node": "seo", "iteration": iteration})
                        yield _sse_event("node_done", {"step": 6, "node": "brand", "iteration": iteration})
                        yield _sse_event("node_done", {"step": 7, "node": "ethics", "iteration": iteration})
                    else:
                        yield _sse_event("node_done", {"step": step_index, "node": node_name, "iteration": iteration})

                    # Send partial data as it becomes available
                    if node_name == "scoring" and "hybrid_score" in node_state:
                        yield _sse_event("scores", {**node_state["hybrid_score"], "iteration": iteration})
                    if node_name == "critique" and "agent_critiques" in node_state:
                        yield _sse_event("critiques", {"critiques": node_state["agent_critiques"], "iteration": iteration})
                    if node_name == "trend_search":
                        yield _sse_event("search_results", {
                            "queries": node_state.get("search_queries", []),
                            "results": node_state.get("search_results", [])[:8],
                            "insights": node_state.get("trend_insights", ""),
                            "iteration": iteration,
                        })
                    if node_name == "hook_gen":
                        yield _sse_event("hook", {
                            "hook": node_state.get("hook", ""),
                            "iteration": iteration,
                        })

            # Final result
            image_url = final_state.get('image_url', '')
            if not image_url:
                # Fallback if image_url not set
                image_url = f"https://image.pollinations.ai/prompt/{final_state.get('image_prompt', '').replace(' ', '%20')}?width=600&height=400&nologo=true"

            yield _sse_event("complete", {
                "final_post": final_state.get("localized_draft", ""),
                "hook": final_state.get("hook", ""),
                "critiques": final_state.get("agent_critiques", []),
                "scores": final_state.get("hybrid_score", {}),
                "image_prompt": final_state.get("image_prompt", ""),
                "image_url": image_url,
                "iterations": final_state.get("iteration", 0),
                "search_queries": final_state.get("search_queries", []),
                "search_results": final_state.get("search_results", [])[:8],
                "trend_insights": final_state.get("trend_insights", ""),
                "ab_variants": final_state.get("ab_variants", []),          # ← NEW
                "competitor_insights": final_state.get("competitor_insights", {}),  # ← NEW
            })

        except Exception as e:
            traceback.print_exc()
            yield _sse_event("error", {"error": str(e)})

    return StreamingResponse(stream_pipeline(), media_type="text/event-stream")

@app.post("/api/refine")
async def refine_post(req: RefineRequest):
    def stream_pipeline():
        try:
            initial_state: PostState = {
                "topic": req.topic,
                "target_language": req.target_language,
                "iteration": 0,
                "previous_draft": req.previous_draft,
                "previous_critiques": req.previous_critiques,
            }
            final_state = {}
            current_iteration = 0

            for step_output in app_graph.stream(initial_state):
                for node_name, node_state in step_output.items():
                    final_state.update(node_state)
                    step_index = NODE_TO_STEP.get(node_name, -1)
                    iteration = final_state.get("iteration", 0)

                    if node_name == "drafting" and iteration > current_iteration:
                        prev_score = final_state.get("hybrid_score", {}).get("final", 0)
                        current_iteration = iteration
                        yield _sse_event("reflexion", {
                            "iteration": iteration,
                            "previous_score": round(prev_score, 4),
                            "reason": f"Score {prev_score:.2%} < 75% threshold — refining draft (attempt {iteration})"
                        })

                    logger.info(f"[SSE] Node '{node_name}' completed -> step {step_index} (iter {iteration})")

                    if node_name == "critique":
                        yield _sse_event("node_done", {"step": 4, "node": "seo", "iteration": iteration})
                        yield _sse_event("node_done", {"step": 5, "node": "brand", "iteration": iteration})
                        yield _sse_event("node_done", {"step": 6, "node": "ethics", "iteration": iteration})
                    else:
                        yield _sse_event("node_done", {"step": step_index, "node": node_name, "iteration": iteration})

                    if node_name == "scoring" and "hybrid_score" in node_state:
                        yield _sse_event("scores", {**node_state["hybrid_score"], "iteration": iteration})
                    if node_name == "critique" and "agent_critiques" in node_state:
                        yield _sse_event("critiques", {"critiques": node_state["agent_critiques"], "iteration": iteration})
                    if node_name == "trend_search":
                        yield _sse_event("search_results", {
                            "queries": node_state.get("search_queries", []),
                            "results": node_state.get("search_results", [])[:8],
                            "insights": node_state.get("trend_insights", ""),
                            "iteration": iteration,
                        })
                    if node_name == "hook_gen":
                        yield _sse_event("hook", {
                            "hook": node_state.get("hook", ""),
                            "iteration": iteration,
                        })

            image_url = final_state.get('image_url', '')
            if not image_url:
                image_url = f"https://image.pollinations.ai/prompt/{final_state.get('image_prompt', '').replace(' ', '%20')}?width=600&height=400&nologo=true"

            yield _sse_event("complete", {
                "final_post": final_state.get("localized_draft", ""),
                "hook": final_state.get("hook", ""),
                "critiques": final_state.get("agent_critiques", []),
                "scores": final_state.get("hybrid_score", {}),
                "image_prompt": final_state.get("image_prompt", ""),
                "image_url": image_url,
                "iterations": final_state.get("iteration", 0),
                "search_queries": final_state.get("search_queries", []),
                "search_results": final_state.get("search_results", [])[:8],
                "trend_insights": final_state.get("trend_insights", ""),
                "is_refinement": True,
            })

        except Exception as e:
            traceback.print_exc()
            yield _sse_event("error", {"error": str(e)})

    return StreamingResponse(stream_pipeline(), media_type="text/event-stream")

@app.get("/api/copilot")
async def get_copilot_data():
    try:
        return analyze_growth_data()
    except Exception as e:
        traceback.print_exc()
        logger.error(f"Copilot error: {e}")
        return JSONResponse(status_code=500, content={"error": f"Copilot analysis failed: {str(e)}"})


# ── LinkedIn OAuth Endpoints ───────────────────────────────────────────────────

_oauth_states: dict = {}  # in-memory state store (use Redis in production)

@app.get("/api/linkedin/auth")
async def linkedin_auth():
    """
    Step 1: Redirect user to LinkedIn for OAuth login.
    Frontend calls this URL directly or opens it in a popup.
    """
    state = secrets.token_urlsafe(16)
    _oauth_states[state] = True
    auth_url = get_authorization_url(state=state)
    return {"auth_url": auth_url}


@app.get("/api/linkedin/callback")
async def linkedin_callback(
    code:              Optional[str] = Query(default=None),
    state:             Optional[str] = Query(default=None),
    error:             Optional[str] = Query(default=None),
    error_description: Optional[str] = Query(default=None),
):
    # ── LinkedIn returned an error (user denied, scope not approved, etc.) ──
    if error:
        msg = error_description or error
        return HTMLResponse(content=f"""
        <html><body style="font-family:sans-serif;padding:40px;background:#fff1f2">
          <h2 style="color:#e11d48">⚠️ LinkedIn Auth Error</h2>
          <p><b>{error}</b>: {msg}</p>
          <p style="font-size:13px;color:#9f1239">
            Common causes:<br>
            • You clicked Cancel on the consent screen<br>
            • App scopes not approved yet on LinkedIn Developer Portal<br>
            • Redirect URI mismatch
          </p>
        </body></html>
        """, status_code=400)

    # ── No code received ────────────────────────────────────────────────────
    if not code:
        return HTMLResponse(content="""
        <html><body style="font-family:sans-serif;padding:40px">
          <h2>⚠️ Missing Authorization Code</h2>
          <p>This URL should only be visited via LinkedIn's OAuth redirect.</p>
        </body></html>
        """, status_code=400)

    # ── State validation ────────────────────────────────────────────────────
    if state and state in _oauth_states:
        del _oauth_states[state]

    # ── Exchange code for token  (code is str here — Pylance happy ✅) ─────
    try:
        token_data   = exchange_code_for_token(code)
        access_token = token_data.get("access_token", "")

        return HTMLResponse(content=f"""
        <html><body style="font-family:sans-serif;padding:40px;background:#f0fdf4">
          <h2 style="color:#16a34a">✅ LinkedIn Connected!</h2>
          <p>Copy the token below and paste it into the app.</p>
          <div style="background:#dcfce7;border:1px solid #86efac;border-radius:8px;padding:16px;margin:16px 0">
            <p style="font-size:11px;color:#166534;font-weight:600;margin:0 0 8px">ACCESS TOKEN:</p>
            <code id="token" style="font-size:11px;word-break:break-all;color:#14532d">{access_token}</code>
          </div>
          <button onclick="navigator.clipboard.writeText(document.getElementById('token').innerText)"
            style="background:#16a34a;color:white;border:none;padding:10px 20px;border-radius:8px;cursor:pointer">
            📋 Copy Token
          </button>
          <script>
            if (window.opener) {{
              window.opener.postMessage({{
                type: 'linkedin_token',
                access_token: '{access_token}',
                expires_in: {token_data.get('expires_in', 0)}
              }}, '*');
            }}
          </script>
        </body></html>
        """)

    except Exception as e:
        traceback.print_exc()
        return HTMLResponse(content=f"""
        <html><body style="font-family:sans-serif;padding:40px;background:#fff1f2">
          <h2 style="color:#e11d48">❌ Token Exchange Failed</h2>
          <p>{str(e)}</p>
          <p style="font-size:13px;color:#6b7280">Check LINKEDIN_CLIENT_SECRET in your .env</p>
        </body></html>
        """, status_code=500)
    

@app.get("/api/linkedin/profile")
async def linkedin_profile(access_token: str = Query(...)):
    """
    Fetch the authenticated user's LinkedIn profile + engagement summary.
    Pass access_token as a query param (or move to Authorization header in production).
    """
    try:
        summary = get_profile_summary(access_token)
        return summary
    except Exception as e:
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": str(e)})


@app.get("/api/linkedin/data")
async def linkedin_real_data(access_token: str = Query(...), days: int = 14):
    """
    Fetch real LinkedIn post + engagement data for the copilot.
    Returns the same DataFrame format as copilot.py (date, tone, engagement_rate, ...).
    """
    try:
        df = fetch_real_engagement_data(access_token, days=days)
        return {
            "posts":       df.to_dict(orient="records"),
            "total":       len(df),
            "avg_engagement": round(df["engagement_rate"].mean(), 2) if not df.empty else 0,
        }
    except Exception as e:
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": str(e)})


# ── Scheduler Endpoints ────────────────────────────────────────────────────────

@app.post("/api/schedule")
async def get_schedule(req: ScheduleRequest):
    """
    Get ML-powered weekly posting schedule recommendations.

    Returns:
      - Optimal day + hour for each post
      - Predicted engagement rate per slot
      - Confidence labels (🔥 Excellent, ✅ Great, etc.)
      - Actionable insights
    """
    try:
        result = get_optimal_schedule(
            tone=req.tone,
            audience=req.audience,
            posts_per_week=max(1, min(req.posts_per_week, 7)),
        )
        return result
    except Exception as e:
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": str(e)})


@app.get("/api/schedule/best-slots")
async def best_slots(
    tone:     str = Query("Educational"),
    audience: str = Query("General"),
    top_n:    int = Query(7),
):
    """Return top N (day, hour) posting slots ranked by predicted engagement."""
    try:
        slots = get_best_posting_slots(tone=tone, audience=audience, top_n=top_n)
        return {"slots": slots, "tone": tone, "audience": audience}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


# ── Competitor Analysis Endpoints ──────────────────────────────────────────────

@app.post("/api/competitor")
async def competitor_analysis(req: CompetitorRequest):
    """
    Run full competitor analysis for a topic/niche.

    Returns:
      - top_hooks: 5 high-impact opening lines used in this niche
      - winning_angles: what consistently gets engagement
      - content_gaps: underexplored angles you can own
      - popular_hashtags: top hashtags in the niche
      - recommended_approach: LLM's strategic recommendation
    """
    try:
        insights = analyze_competitors(
            topic=req.topic,
            enrich_hashtags=req.enrich_hashtags,
        )
        return insights.to_dict()
    except Exception as e:
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": str(e)})


@app.get("/api/competitor/quick")
async def competitor_quick(topic: str = Query(...)):
    """Quick GET endpoint for competitor analysis (no hashtag enrichment for speed)."""
    try:
        insights = analyze_competitors(topic=topic, enrich_hashtags=False)
        return insights.to_dict()
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})
