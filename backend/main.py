from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.responses import StreamingResponse
from pydantic import BaseModel
from agent_graph import app_graph
from copilot import analyze_growth_data
import traceback
import json
import logging
from pathlib import Path

logger = logging.getLogger("api")

app = FastAPI()

# Serve generated images as static files
images_dir = Path(__file__).parent / "generated_images"
images_dir.mkdir(exist_ok=True)
app.mount("/generated_images", StaticFiles(directory=str(images_dir)), name="generated_images")

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
    "drafting": 0,
    "trend_search": 1,
    "hook_gen": 2,
    "localization": 3,
    "critique": 4,   # covers steps 4,5,6 (SEO, Brand, Ethics)
    "scoring": 7,
    "visuals": 8,
}

def _sse_event(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"

@app.post("/api/generate")
async def generate_post(req: PostRequest):
    def stream_pipeline():
        try:
            initial_state = {"topic": req.topic, "target_language": req.target_language, "iteration": 0}
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

                    # For critique node, emit 3 sub-steps (SEO=4, Brand=5, Ethics=6)
                    if node_name == "critique":
                        yield _sse_event("node_done", {"step": 4, "node": "seo", "iteration": iteration})
                        yield _sse_event("node_done", {"step": 5, "node": "brand", "iteration": iteration})
                        yield _sse_event("node_done", {"step": 6, "node": "ethics", "iteration": iteration})
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
            })

        except Exception as e:
            traceback.print_exc()
            yield _sse_event("error", {"error": str(e)})

    return StreamingResponse(stream_pipeline(), media_type="text/event-stream")

@app.post("/api/refine")
async def refine_post(req: RefineRequest):
    def stream_pipeline():
        try:
            initial_state = {
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
