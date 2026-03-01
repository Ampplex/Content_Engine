from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from agent_graph import app_graph
from copilot import analyze_growth_data
import traceback

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

@app.post("/api/generate")
async def generate_post(req: PostRequest):
    try:
        initial_state = {"topic": req.topic, "target_language": req.target_language, "iteration": 0}
        final_state = app_graph.invoke(initial_state)
        
        # Generate image via Pollinations AI (free API)
        image_url = f"https://image.pollinations.ai/prompt/{final_state['image_prompt'].replace(' ', '%20')}?width=600&height=400&nologo=true"
        
        return {
            "final_post": final_state["localized_draft"],
            "critiques": final_state["agent_critiques"],
            "scores": final_state["hybrid_score"],
            "image_prompt": final_state["image_prompt"],
            "image_url": image_url,
            "iterations": final_state["iteration"]
        }
    except Exception as e:
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.get("/api/copilot")
async def get_copilot_data():
    try:
        return analyze_growth_data()
    except Exception as e:
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": str(e)})
