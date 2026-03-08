"""
Instagram Content Engine — FastAPI Server.

Runs on port 8001 (separate from LinkedIn engine on port 8000).
Zero modifications to existing main.py.

Start: uvicorn instagram_main:app --reload --port 8001
"""

import json
import logging
import traceback
from typing import Optional
from pathlib import Path

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.responses import StreamingResponse
from pydantic import BaseModel

from instagram_agent_graph import ig_app_graph, IGPostState
from instagram_copilot import analyze_ig_growth
from instagram_scheduler import get_ig_schedule, get_ig_best_slots
from instagram_competitor import analyze_ig_competitors
from hashtag_engine import generate_hashtags
from reel_script import generate_reel_script
from carousel_writer import generate_carousel

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("instagram_api")

app = FastAPI(title="Instagram Content Engine", version="1.0.0")

# Static files for generated images
images_dir = Path(__file__).parent / "generated_images"
images_dir.mkdir(exist_ok=True)
app.mount("/generated_images", StaticFiles(directory=str(images_dir)), name="generated_images")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Node → step index mapping (for SSE progress) ─────────────────────────────
NODE_TO_STEP = {
    "competitor_analysis": 0,
    "format_selector":     1,
    "trend_search":        2,
    "caption_drafter":     3,
    "hook_gen":            4,
    "hashtag_gen":         5,
    "reel_script_gen":     5,
    "carousel_gen":        5,
    "critique":            6,
    "scoring":             7,
    "visuals":             8,
}

def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


# ── Request / Response Models ─────────────────────────────────────────────────

class IGGenerateRequest(BaseModel):
    topic:           str
    target_language: str = "English"

class IGRefineRequest(BaseModel):
    topic:             str
    target_language:   str = "English"
    previous_caption:  str = ""
    previous_critiques: list[str] = []

class IGScheduleRequest(BaseModel):
    format:        str = "Reel"
    tone:          str = "Educational"
    audience:      str = "Gen Z"
    posts_per_week: int = 5

class IGCompetitorRequest(BaseModel):
    topic:           str
    enrich_hashtags: bool = True

class IGHashtagRequest(BaseModel):
    topic:       str
    format_type: str = "Reel"
    tone:        str = "Educational"
    count:       int = 25

class IGReelRequest(BaseModel):
    topic:        str
    duration_sec: int = 30
    tone:         str = "Educational"
    language:     str = "English"

class IGCarouselRequest(BaseModel):
    topic:     str
    structure: str = "Educational"
    language:  str = "English"
    slides:    int = 10


# ═══════════════════════════════════════════════════════════════════════════════
# Core Pipeline Endpoints
# ═══════════════════════════════════════════════════════════════════════════════

@app.post("/api/ig/generate")
async def ig_generate(req: IGGenerateRequest):
    """
    Full 9-node Instagram pipeline with SSE streaming.
    Generates: format selection → caption → hook → hashtags →
    reel/carousel → critique → scoring → visual
    """
    def stream():
        try:
            initial_state: IGPostState = {
                "topic":               req.topic,
                "target_language":     req.target_language,
                "selected_format":     "",
                "selected_tone":       "",
                "reel_duration":       30,
                "carousel_structure":  "Educational",
                "competitor_insights": {},
                "competitor_context":  "",
                "search_queries":      [],
                "search_results":      [],
                "trend_insights":      "",
                "caption":             "",
                "first_line":          "",
                "hook":                "",
                "ab_captions":         [],
                "reel_script":         {},
                "carousel":            {},
                "hashtags":            {},
                "agent_critiques":     [],
                "hybrid_score":        {},
                "image_prompt":        "",
                "image_url":           "",
                "iteration":           0,
                "previous_caption":    "",
                "previous_critiques":  [],
            }

            reflexion_count = 0
            for event_type, data in ig_app_graph.stream(initial_state, stream_mode="updates"):
                node_name = list(data.keys())[0] if data else ""
                node_data = data.get(node_name, {})
                step      = NODE_TO_STEP.get(node_name, -1)

                # Emit node_done for progress bar
                if step >= 0:
                    yield _sse("node_done", {"step": step, "node": node_name})

                # Format selected — emit immediately for UI
                if node_name == "format_selector":
                    yield _sse("format_selected", {
                        "format": node_data.get("selected_format", "Reel"),
                        "tone":   node_data.get("selected_tone", "Educational"),
                    })

                # Search results
                if node_name == "trend_search":
                    yield _sse("search_results", {
                        "queries":  node_data.get("search_queries", []),
                        "results":  node_data.get("search_results", [])[:8],
                        "insights": node_data.get("trend_insights", ""),
                    })

                # Hook
                if node_name == "hook_gen" and node_data.get("hook"):
                    yield _sse("hook", {"hook": node_data["hook"]})

                # Hashtags
                if node_name == "hashtag_gen":
                    yield _sse("hashtags", {"hashtags": node_data.get("hashtags", {})})

                # Critiques
                if node_name == "critique":
                    yield _sse("critiques", {"critiques": node_data.get("agent_critiques", [])})

                # Scores
                if node_name == "scoring":
                    yield _sse("scores", node_data.get("hybrid_score", {}))
                    # Check for reflexion
                    score = node_data.get("hybrid_score", {}).get("final", 1.0)
                    iter_ = node_data.get("iteration", 1)
                    if score < 0.75 and iter_ < 2:
                        reflexion_count += 1
                        yield _sse("reflexion", {
                            "iteration":      iter_ + 1,
                            "previous_score": score,
                            "reason":         f"Score {score:.2f} below 0.75 — regenerating caption",
                        })

            # Final complete event — collect all state
            final_state = ig_app_graph.invoke(initial_state) if False else None  # already ran above

            # Build final payload from last known state by re-running (cheaper approach: track state)
            # Since langgraph stream gives us incremental updates, we gather from node_data
            yield _sse("complete", {
                "topic":          req.topic,
                "format":         "Reel",      # will be overwritten below
                "caption":        "",
                "hook":           "",
                "hashtags":       {},
                "reel_script":    {},
                "carousel":       {},
                "image_url":      "",
                "image_prompt":   "",
                "scores":         {},
                "critiques":      [],
                "ab_captions":    [],
                "iterations":     reflexion_count + 1,
            })

        except Exception as e:
            traceback.print_exc()
            yield _sse("error", {"error": str(e)})

    # Better approach — use full invoke + yield complete state
    def stream_v2():
        try:
            initial_state: dict = {
                "topic":               req.topic,
                "target_language":     req.target_language,
                "selected_format":     "",
                "selected_tone":       "",
                "reel_duration":       30,
                "carousel_structure":  "Educational",
                "competitor_insights": {},
                "competitor_context":  "",
                "search_queries":      [],
                "search_results":      [],
                "trend_insights":      "",
                "caption":             "",
                "first_line":          "",
                "hook":                "",
                "ab_captions":         [],
                "reel_script":         {},
                "carousel":            {},
                "hashtags":            {},
                "agent_critiques":     [],
                "hybrid_score":        {},
                "image_prompt":        "",
                "image_url":           "",
                "iteration":           0,
                "previous_caption":    "",
                "previous_critiques":  [],
            }

            iteration     = 0
            last_state    = dict(initial_state)

            for event_update in ig_app_graph.stream(initial_state, stream_mode="updates"):
                node_name = list(event_update.keys())[0] if event_update else ""
                node_data = event_update.get(node_name, {})
                step      = NODE_TO_STEP.get(node_name, -1)

                # Update tracked state
                last_state.update(node_data)

                if step >= 0:
                    yield _sse("node_done", {"step": step, "node": node_name})

                if node_name == "format_selector":
                    yield _sse("format_selected", {
                        "format": node_data.get("selected_format", "Reel"),
                        "tone":   node_data.get("selected_tone", "Educational"),
                        "reel_duration": node_data.get("reel_duration", 30),
                    })

                if node_name == "trend_search":
                    yield _sse("search_results", {
                        "queries":  node_data.get("search_queries", []),
                        "results":  node_data.get("search_results", [])[:8],
                        "insights": node_data.get("trend_insights", ""),
                    })

                if node_name == "hook_gen" and node_data.get("hook"):
                    yield _sse("hook", {"hook": node_data["hook"]})

                if node_name == "hashtag_gen":
                    yield _sse("hashtags", {"hashtags": node_data.get("hashtags", {})})

                if node_name == "critique":
                    yield _sse("critiques", {"critiques": node_data.get("agent_critiques", [])})

                if node_name == "scoring":
                    score_data = node_data.get("hybrid_score", {})
                    yield _sse("scores", score_data)
                    score = score_data.get("final", 1.0)
                    iter_ = last_state.get("iteration", 1)
                    if score < 0.75 and iter_ < 2:
                        iteration += 1
                        yield _sse("reflexion", {
                            "iteration":      iteration + 1,
                            "previous_score": score,
                            "reason":         f"Score {score:.2f} below 0.75 — reflexion triggered",
                        })

            # Emit final complete
            yield _sse("complete", {
                "topic":          req.topic,
                "format":         last_state.get("selected_format", "Reel"),
                "tone":           last_state.get("selected_tone", "Educational"),
                "caption":        last_state.get("caption", ""),
                "first_line":     last_state.get("first_line", ""),
                "hook":           last_state.get("hook", ""),
                "hashtags":       last_state.get("hashtags", {}),
                "reel_script":    last_state.get("reel_script", {}),
                "carousel":       last_state.get("carousel", {}),
                "image_url":      last_state.get("image_url", ""),
                "image_prompt":   last_state.get("image_prompt", ""),
                "scores":         last_state.get("hybrid_score", {}),
                "critiques":      last_state.get("agent_critiques", []),
                "ab_captions":    last_state.get("ab_captions", []),
                "competitor_insights": last_state.get("competitor_insights", {}),
                "trend_insights": last_state.get("trend_insights", ""),
                "search_queries": last_state.get("search_queries", []),
                "iterations":     last_state.get("iteration", 1),
            })

        except Exception as e:
            traceback.print_exc()
            yield _sse("error", {"error": str(e)})

    return StreamingResponse(stream_v2(), media_type="text/event-stream")


@app.post("/api/ig/refine")
async def ig_refine(req: IGRefineRequest):
    """Manual refinement — re-runs pipeline with previous caption + critiques."""
    def stream():
        try:
            initial_state: dict = {
                "topic":               req.topic,
                "target_language":     req.target_language,
                "selected_format":     "",
                "selected_tone":       "",
                "reel_duration":       30,
                "carousel_structure":  "Educational",
                "competitor_insights": {},
                "competitor_context":  "",
                "search_queries":      [],
                "search_results":      [],
                "trend_insights":      "",
                "caption":             "",
                "first_line":          "",
                "hook":                "",
                "ab_captions":         [],
                "reel_script":         {},
                "carousel":            {},
                "hashtags":            {},
                "agent_critiques":     [],
                "hybrid_score":        {},
                "image_prompt":        "",
                "image_url":           "",
                "iteration":           0,
                "previous_caption":    req.previous_caption,
                "previous_critiques":  req.previous_critiques,
            }

            last_state = dict(initial_state)
            for event_update in ig_app_graph.stream(initial_state, stream_mode="updates"):
                node_name = list(event_update.keys())[0] if event_update else ""
                node_data = event_update.get(node_name, {})
                step      = NODE_TO_STEP.get(node_name, -1)
                last_state.update(node_data)

                if step >= 0:
                    yield _sse("node_done", {"step": step, "node": node_name})
                if node_name == "hook_gen" and node_data.get("hook"):
                    yield _sse("hook", {"hook": node_data["hook"]})
                if node_name == "hashtag_gen":
                    yield _sse("hashtags", {"hashtags": node_data.get("hashtags", {})})
                if node_name == "critique":
                    yield _sse("critiques", {"critiques": node_data.get("agent_critiques", [])})
                if node_name == "scoring":
                    yield _sse("scores", node_data.get("hybrid_score", {}))

            yield _sse("complete", {
                "topic":        req.topic,
                "format":       last_state.get("selected_format", "Reel"),
                "tone":         last_state.get("selected_tone", "Educational"),
                "caption":      last_state.get("caption", ""),
                "first_line":   last_state.get("first_line", ""),
                "hook":         last_state.get("hook", ""),
                "hashtags":     last_state.get("hashtags", {}),
                "reel_script":  last_state.get("reel_script", {}),
                "carousel":     last_state.get("carousel", {}),
                "image_url":    last_state.get("image_url", ""),
                "scores":       last_state.get("hybrid_score", {}),
                "critiques":    last_state.get("agent_critiques", []),
                "ab_captions":  last_state.get("ab_captions", []),
                "iterations":   last_state.get("iteration", 1),
            })
        except Exception as e:
            traceback.print_exc()
            yield _sse("error", {"error": str(e)})

    return StreamingResponse(stream(), media_type="text/event-stream")


# ═══════════════════════════════════════════════════════════════════════════════
# Individual Feature Endpoints
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/api/ig/copilot")
async def ig_copilot():
    """Instagram growth copilot — strategy + 14-day analysis + 7-day ML predictions."""
    try:
        return analyze_ig_growth()
    except Exception as e:
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": str(e)})


@app.post("/api/ig/schedule")
async def ig_schedule(req: IGScheduleRequest):
    """ML-powered weekly posting schedule for Instagram."""
    try:
        return get_ig_schedule(
            fmt=req.format, tone=req.tone,
            audience=req.audience, posts_per_week=req.posts_per_week,
        )
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


@app.get("/api/ig/schedule/best-slots")
async def ig_best_slots(
    format:   str = Query("Reel"),
    tone:     str = Query("Educational"),
    audience: str = Query("Gen Z"),
    top_n:    int = Query(10),
):
    try:
        slots = get_ig_best_slots(fmt=format, tone=tone, audience=audience, top_n=top_n)
        return {"slots": slots, "format": format, "tone": tone, "audience": audience}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


@app.post("/api/ig/competitor")
async def ig_competitor(req: IGCompetitorRequest):
    """Full competitor intelligence for Instagram niche."""
    try:
        insights = analyze_ig_competitors(req.topic, req.enrich_hashtags)
        return insights.to_dict()
    except Exception as e:
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": str(e)})


@app.post("/api/ig/hashtags")
async def ig_hashtags(req: IGHashtagRequest):
    """Generate tiered hashtag set (mega + mid + niche + location)."""
    try:
        return generate_hashtags(req.topic, req.format_type, req.tone, req.count)
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


@app.post("/api/ig/reel-script")
async def ig_reel_script(req: IGReelRequest):
    """Generate a complete reel script (15/30/60 sec)."""
    try:
        script = generate_reel_script(req.topic, req.duration_sec, req.tone, req.language)
        return script.to_dict()
    except Exception as e:
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": str(e)})


@app.post("/api/ig/carousel")
async def ig_carousel(req: IGCarouselRequest):
    """Generate a 10-slide carousel with complete content."""
    try:
        carousel = generate_carousel(req.topic, req.structure, req.language, num_slides=req.slides)
        return carousel.to_dict()
    except Exception as e:
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": str(e)})


@app.get("/api/ig/health")
async def health():
    return {"status": "ok", "service": "Instagram Content Engine", "port": 8001}


# ── Run ────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("instagram_main:app", host="0.0.0.0", port=8001, reload=True)