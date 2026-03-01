from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.responses import StreamingResponse
from pydantic import BaseModel
from agent_graph import app_graph
from copilot import analyze_growth_data
import traceback
import json
import logging

logger = logging.getLogger("api")

app = FastAPI()

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

# Map LangGraph node names to frontend pipeline step indices
NODE_TO_STEP = {
    "drafting": 0,
    "localization": 1,
    "critique": 2,   # covers steps 2,3,4 (SEO, Brand, Ethics)
    "scoring": 5,
    "visuals": 6,
}

def _sse_event(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"

@app.post("/api/generate")
async def generate_post(req: PostRequest):
    def stream_pipeline():
        try:
            initial_state = {"topic": req.topic, "target_language": req.target_language, "iteration": 0}
            final_state = {}

            # stream() yields {node_name: state_update} after each node completes
            for step_output in app_graph.stream(initial_state):
                for node_name, node_state in step_output.items():
                    final_state.update(node_state)
                    step_index = NODE_TO_STEP.get(node_name, -1)

                    logger.info(f"[SSE] Node '{node_name}' completed -> step {step_index}")

                    # For critique node, emit 3 sub-steps (SEO=2, Brand=3, Ethics=4)
                    if node_name == "critique":
                        yield _sse_event("node_done", {"step": 2, "node": "seo"})
                        yield _sse_event("node_done", {"step": 3, "node": "brand"})
                        yield _sse_event("node_done", {"step": 4, "node": "ethics"})
                    else:
                        yield _sse_event("node_done", {"step": step_index, "node": node_name})

                    # Send partial data as it becomes available
                    if node_name == "scoring" and "hybrid_score" in node_state:
                        yield _sse_event("scores", node_state["hybrid_score"])
                    if node_name == "critique" and "agent_critiques" in node_state:
                        yield _sse_event("critiques", {"critiques": node_state["agent_critiques"]})

            # Final result
            image_url = f"https://image.pollinations.ai/prompt/{final_state.get('image_prompt', '').replace(' ', '%20')}?width=600&height=400&nologo=true"

            yield _sse_event("complete", {
                "final_post": final_state.get("localized_draft", ""),
                "critiques": final_state.get("agent_critiques", []),
                "scores": final_state.get("hybrid_score", {}),
                "image_prompt": final_state.get("image_prompt", ""),
                "image_url": image_url,
                "iterations": final_state.get("iteration", 0),
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
        return JSONResponse(status_code=500, content={"error": str(e)})
