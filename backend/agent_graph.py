import os
from typing import TypedDict, List
from langgraph.graph import StateGraph, END
from langchain_aws import ChatBedrock

# Requires AWS credentials configured (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, or IAM role)
llm = ChatBedrock(
    model_id="anthropic.claude-3-5-sonnet-20241022-v2:0",
    region_name="ap-south-1",
    model_kwargs={"temperature": 0.7, "max_tokens": 4096},
) 

class PostState(TypedDict):
    topic: str
    target_language: str
    english_draft: str
    localized_draft: str
    agent_critiques: List[str]
    hybrid_score: dict
    iteration: int
    image_prompt: str

def generate_base_draft(state: PostState):
    prompt = f"Write an engaging, insightful LinkedIn post about: {state['topic']}."
    response = llm.invoke(prompt)
    return {"english_draft": response.content, "iteration": state.get("iteration", 0) + 1}

def indic_localization_agent(state: PostState):
    prompt = f"""Translate and culturally adapt this post into {state['target_language']}. 
    Make it natural for an Indian professional audience.
    Post: {state['english_draft']}"""
    response = llm.invoke(prompt)
    return {"localized_draft": response.content}

def _run_seo_agent(text: str, topic: str) -> str:
    prompt = f"""You are an SEO optimization agent for LinkedIn content targeting Indian professionals.
Analyze the following post and provide specific, actionable SEO feedback.
Include: recommended hashtags, keyword suggestions, and discoverability improvements.

Topic: {topic}
Post:
{text}

Provide your critique in one concise paragraph starting with 'SEO Agent:'."""
    response = llm.invoke(prompt)
    return response.content.strip()

def _run_brand_guardian(text: str) -> str:
    prompt = f"""You are a Brand Guardian agent. Your role is to review content for professional tone,
brand consistency, and enterprise-readiness.
Analyze the following LinkedIn post and provide specific feedback on tone, professionalism,
and any adjustments needed to align with enterprise standards.

Post:
{text}

Provide your critique in one concise paragraph starting with 'Brand Guardian:'."""
    response = llm.invoke(prompt)
    return response.content.strip()

def _run_ethics_agent(text: str) -> str:
    prompt = f"""You are an Ethics & Safety agent. Your role is to review content for:
- Potential biases (gender, cultural, regional, socioeconomic)
- Misinformation or unverified claims
- Harmful stereotypes
- Regulatory or compliance issues

Analyze the following post and provide your safety assessment.

Post:
{text}

Provide your assessment in one concise paragraph starting with 'Ethics Agent:'."""
    response = llm.invoke(prompt)
    return response.content.strip()

def multi_agent_critique(state: PostState):
    text = state['localized_draft']
    topic = state['topic']
    
    seo_critique = _run_seo_agent(text, topic)
    brand_critique = _run_brand_guardian(text)
    ethics_critique = _run_ethics_agent(text)
    
    return {"agent_critiques": [seo_critique, brand_critique, ethics_critique]}

def hybrid_scoring_engine(state: PostState):
    text = state['localized_draft']
    
    # Heuristic (Rule-based)
    heuristic = 0.8 if len(text) > 150 and ("?" in text or "!" in text) else 0.5
    
    # LLM Score Eval
    try:
        eval_prompt = f"Rate the engagement potential of this text from 0.0 to 1.0. Output ONLY the float number: {text}"
        llm_eval = llm.invoke(eval_prompt)
        llm_score = float(llm_eval.content.strip())
    except:
        llm_score = 0.75
        
    # ML-style scoring via feature extraction + LLM evaluation
    try:
        ml_prompt = f"""You are a machine-learning engagement predictor. Score this LinkedIn post from 0.0 to 1.0
based on these features:
- Hook strength (does the opening grab attention?)
- Readability and structure (short paragraphs, bullet points, emojis)
- Call to action presence
- Emotional resonance
- Hashtag and keyword relevance

Post:
{text}

Output ONLY a single float between 0.0 and 1.0."""
        ml_eval = llm.invoke(ml_prompt)
        ml_score = float(ml_eval.content.strip())
        ml_score = max(0.0, min(1.0, ml_score))
    except Exception:
        ml_score = 0.75
    
    # Formula: final_text_score = 0.5 * ml_score + 0.3 * llm_score + 0.2 * heuristic_score
    final_score = (0.5 * ml_score) + (0.3 * llm_score) + (0.2 * heuristic)
    
    return {"hybrid_score": {"ml": ml_score, "llm": llm_score, "heuristic": heuristic, "final": final_score}}

def visual_strategy_agent(state: PostState):
    prompt = f"Create a short, descriptive image generation prompt based on this text: {state['localized_draft']}"
    response = llm.invoke(prompt)
    return {"image_prompt": response.content}

# Compile Graph
workflow = StateGraph(PostState)
workflow.add_node("drafting", generate_base_draft)
workflow.add_node("localization", indic_localization_agent)
workflow.add_node("critique", multi_agent_critique)
workflow.add_node("scoring", hybrid_scoring_engine)
workflow.add_node("visuals", visual_strategy_agent)

workflow.set_entry_point("drafting")
workflow.add_edge("drafting", "localization")
workflow.add_edge("localization", "critique")
workflow.add_edge("critique", "scoring")

def reflexion_router(state: PostState):
    if state["hybrid_score"]["final"] < 0.75 and state["iteration"] < 2:
        return "drafting"
    return "visuals"

workflow.add_conditional_edges("scoring", reflexion_router)
workflow.add_edge("visuals", END)

app_graph = workflow.compile()
