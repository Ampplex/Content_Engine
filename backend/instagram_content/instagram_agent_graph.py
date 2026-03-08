"""
Instagram Multi-Agent LangGraph Pipeline.

9-node pipeline:
  competitor_analysis → format_selector → trend_search → caption_drafter
  → hook_generator → hashtag_engine → critique → scoring
  → visual_strategy → ab_variants → END

Reflexion loop: if score < 0.75 and iteration < 2 → loop back to caption_drafter.

All nodes are NEW — zero modifications to existing LinkedIn pipeline files.
Reuses: bedrock_llm, config, web_search, image_gen (read-only imports).
"""

import json
import logging
import re
from typing import TypedDict, List, Any

from langgraph.graph import StateGraph, END

from bedrock_llm import ChatBedrockAPIKey          # ✅ reused
from config import (                               # ✅ reused
    BEDROCK_API_KEY, BEDROCK_MODEL_ID,
    AWS_REGION, LLM_TEMPERATURE, LLM_MAX_TOKENS,
)
from web_search import search_multiple             # ✅ reused
from image_gen import generate_post_image, get_fallback_image_url  # ✅ reused

from instagram_ml_model import ig_caption_predictor  # new
from instagram_competitor import ig_competitor_node  # new
from hashtag_engine import hashtag_node              # new
from reel_script import reel_script_node             # new
from carousel_writer import carousel_node            # new
from instagram_caption import caption_node           # new

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("instagram_agent_graph")

llm = ChatBedrockAPIKey(
    api_key=BEDROCK_API_KEY, model_id=BEDROCK_MODEL_ID,
    region=AWS_REGION, temperature=LLM_TEMPERATURE, max_tokens=LLM_MAX_TOKENS,
)

def _msg_text(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            if isinstance(item, str):
                parts.append(item)
            elif isinstance(item, dict):
                text = item.get("text")
                if isinstance(text, str):
                    parts.append(text)
        return "\n".join(p for p in parts if p)
    return str(content) if content is not None else ""

IG_FORMATS = ["Reel", "Carousel", "Static", "Story"]
IG_TONES   = ["Educational", "Motivational", "Funny", "Emotional", "Promotional"]


# ── State ──────────────────────────────────────────────────────────────────────

class IGPostState(TypedDict):
    # Input
    topic:               str
    target_language:     str

    # Format selection
    selected_format:     str         # Reel / Carousel / Static / Story
    selected_tone:       str         # Educational / Motivational / Funny / Emotional
    reel_duration:       int         # 15 / 30 / 60
    carousel_structure:  str         # Educational / Listicle / Story / Tutorial

    # Competitor
    competitor_insights: dict
    competitor_context:  str

    # Web research
    search_queries:      List[str]
    search_results:      List[dict]
    trend_insights:      str

    # Content
    caption:             str
    first_line:          str
    hook:                str
    ab_captions:         List[dict]

    # Format-specific content
    reel_script:         dict
    carousel:            dict

    # Hashtags
    hashtags:            dict

    # Critique
    agent_critiques:     List[str]

    # Scoring
    hybrid_score:        dict

    # Visuals
    image_prompt:        str
    image_url:           str

    # Reflexion
    iteration:           int
    previous_caption:    str
    previous_critiques:  List[str]


# ── Node 1: Format Selector ────────────────────────────────────────────────────

def format_selector(state: IGPostState) -> dict:
    topic = state["topic"]
    iter_ = state.get("iteration", 0) + 1
    logger.info(f"===== [NODE: format_selector] Topic: '{topic[:50]}' | Iter: {iter_}")

    # If competitor intel already suggests a format, use it
    comp_formats = state.get("competitor_insights", {}).get("winning_formats", [])
    comp_hint    = ""
    if comp_formats:
        comp_hint = f"Competitor intel suggests these formats work well: {comp_formats[:3]}"

    prompt = f"""You are an Instagram content strategist for the Indian market.

Given this topic, select the BEST content format and tone for Instagram.

Topic: "{topic}"
{comp_hint}

Format options: {IG_FORMATS}
Tone options:   {IG_TONES}

Rules:
- Reel: best for tutorials, quick tips, entertainment, trending topics
- Carousel: best for educational deep-dives, listicles, step-by-step guides
- Static: best for quotes, announcements, single-stat posts
- Story: best for polls, behind-the-scenes, Q&As

Also select:
- reel_duration: 15, 30, or 60 (only if format is Reel)
- carousel_structure: Educational / Listicle / Story / Tutorial / Comparison (only if Carousel)

Output ONLY valid JSON:
{{
  "format":              "Reel",
  "tone":                "Educational",
  "reel_duration":       30,
  "carousel_structure":  "Listicle",
  "reasoning":           "one sentence why"
}}"""

    try:
        r    = llm.invoke(prompt)
        data = json.loads(_msg_text(r.content).strip().strip("```json").strip("```").strip())
        fmt  = data.get("format", "Reel")
        tone = data.get("tone", "Educational")
        if fmt not in IG_FORMATS: fmt = "Reel"
        if tone not in IG_TONES:  tone = "Educational"
        logger.info(f"  → Format: {fmt} | Tone: {tone} | Reason: {data.get('reasoning','')[:60]}")
        return {
            "selected_format":    fmt,
            "selected_tone":      tone,
            "reel_duration":      int(data.get("reel_duration", 30)),
            "carousel_structure": str(data.get("carousel_structure", "Educational")),
            "iteration":          iter_,
        }
    except Exception as e:
        logger.warning(f"  Format selection failed ({e}), defaulting to Reel/Educational")
        return {
            "selected_format": "Reel", "selected_tone": "Educational",
            "reel_duration": 30, "carousel_structure": "Educational", "iteration": iter_,
        }


# ── Node 2: Trend Search (adapted for Instagram) ───────────────────────────────

def ig_trend_search(state: IGPostState) -> dict:
    topic  = state["topic"]
    fmt    = state.get("selected_format", "Reel")
    draft  = state.get("caption", "")
    logger.info(f"===== [NODE: ig_trend_search] Topic: '{topic[:50]}' | Format: {fmt}")

    query_prompt = f"""Generate exactly 3 search queries for Instagram content research about "{topic}".

Queries should find:
1. Latest trending angle on {topic} for Indian Instagram audience (2026)
2. Viral {fmt} content about {topic} — what format and hooks are working
3. Key statistics or facts about {topic} that would resonate on Instagram

Output ONLY a JSON array of 3 strings."""

    try:
        qr      = llm.invoke(query_prompt)
        queries = json.loads(_msg_text(qr.content).strip().strip("```json").strip("```"))
        if not isinstance(queries, list): raise ValueError
        queries = [str(q) for q in queries[:3]]
    except Exception:
        queries = [
            f"{topic} trending Instagram India 2026",
            f"viral {fmt} content {topic} Indian creator",
            f"{topic} statistics facts Instagram post",
        ]

    results = search_multiple(queries, max_results_per_query=3)

    if results:
        results_text = "\n".join(
            f"- {r['title']}: {r['snippet'][:150]}"
            for r in results[:8]
        )
        synthesis = llm.invoke(
            f"""Summarize the top 2-3 trending angles from these Instagram search results for "{topic}".
Keep it under 150 words. Focus on what will resonate with Indian Instagram audience.

Results:
{results_text}

Output: 2-3 bullet points of key trends/facts. No preamble."""
        )
        synthesis = _msg_text(synthesis.content).strip()
    else:
        synthesis = ""

    logger.info(f"  → {len(results)} results, insights: {len(synthesis)} chars")
    return {
        "search_queries":  queries,
        "search_results":  results,
        "trend_insights":  synthesis,
    }


# ── Node 3: Hook Generator ─────────────────────────────────────────────────────

def ig_hook_generator(state: IGPostState) -> dict:
    topic   = state["topic"]
    fmt     = state.get("selected_format", "Reel")
    tone    = state.get("selected_tone", "Educational")
    caption = state.get("caption", "")
    lang    = state.get("target_language", "English")
    logger.info(f"===== [NODE: ig_hook] Format: {fmt} | Tone: {tone}")

    lang_note = f"Write in {lang}." if lang != "English" else "Hinglish phrases welcome."

    hook_styles = {
        "Reel":     "First on-screen text (under 6 words). Makes them stop scrolling in 0.5 seconds.",
        "Carousel": "First slide headline. Creates FOMO or curiosity gap to make them swipe.",
        "Static":   "Bold caption opener. First 125 chars before 'more' button.",
        "Story":    "Story text overlay. Short, personal, real.",
    }

    prompt = f"""Write a single scroll-stopping Instagram hook for a {fmt} about "{topic}".
Style: {hook_styles.get(fmt, hook_styles["Reel"])}
Tone: {tone}
{lang_note}

Options to try: provocative question, bold claim, surprising stat, relatable pain point, curiosity gap.
Under 8 words. No emojis in the hook itself.

Output ONLY the hook text. Nothing else."""

    try:
        hook = _msg_text(llm.invoke(prompt).content).strip().strip('"').strip("'")
        logger.info(f"  → Hook: {hook[:80]}")
        return {"hook": hook}
    except Exception as e:
        logger.warning(f"  Hook failed ({e})")
        return {"hook": f"You need to know this about {topic[:25]}"}


# ── Node 4: Instagram-specific critique agents ─────────────────────────────────

def _virality_agent(caption: str, fmt: str, topic: str) -> dict:
    prompt = f"""You are a Virality Agent for Instagram content.

Review this {fmt} caption and REWRITE it for maximum Instagram engagement.

Caption:
{caption}

Topic: {topic}

Do BOTH:
1. VIRALITY CRITIQUE: One paragraph — what kills engagement? (hook, CTA, relatability issues)
2. REVISED CAPTION: Rewrite with fixes:
   - Stronger hook in first line
   - More conversational / relatable to Indian youth
   - Better CTA ("save this", "tag a friend", "comment your answer")
   - Keep length appropriate for {fmt}
   - Remove any corporate/stiff language

Format:
VIRALITY_CRITIQUE:
<critique>

REVISED_CAPTION:
<rewritten caption>"""
    try:
        r = _msg_text(llm.invoke(prompt).content).strip()
        critique, revised = caption, caption
        if "REVISED_CAPTION:" in r:
            p = r.split("REVISED_CAPTION:", 1)
            critique = p[0].replace("VIRALITY_CRITIQUE:", "").strip()
            revised  = re.sub(r'#\w+', '', p[1]).strip()
        return {"critique": critique, "revised": revised}
    except Exception:
        return {"critique": "Virality check skipped.", "revised": caption}


def _brand_tone_agent(caption: str, topic: str) -> dict:
    prompt = f"""You are a Brand Tone Agent for Instagram.

Review this caption for brand voice consistency and professionalism.

Caption: {caption}
Topic: {topic}

Do BOTH:
1. BRAND_CRITIQUE: One paragraph — tone issues, inauthenticity, or trust problems.
2. REVISED_CAPTION: Rewrite fixing tone — authentic, relatable, trustworthy.

Format:
BRAND_CRITIQUE:
<critique>

REVISED_CAPTION:
<rewritten>"""
    try:
        r = _msg_text(llm.invoke(prompt).content).strip()
        critique, revised = caption, caption
        if "REVISED_CAPTION:" in r:
            p = r.split("REVISED_CAPTION:", 1)
            critique = p[0].replace("BRAND_CRITIQUE:", "").strip()
            revised  = re.sub(r'#\w+', '', p[1]).strip()
        return {"critique": critique, "revised": revised}
    except Exception:
        return {"critique": "Brand check skipped.", "revised": caption}


def _ethics_agent(caption: str, topic: str) -> dict:
    prompt = f"""You are an Ethics & Safety Agent for Instagram content.

Review this caption for harmful stereotypes, misinformation, or harmful content.

Caption: {caption}
Topic: {topic}

Do BOTH:
1. ETHICS_CRITIQUE: One paragraph — flag any issues (cultural insensitivity, misinformation, harmful claims).
2. REVISED_CAPTION: Rewrite fixing any issues. If no issues found, return unchanged.

Format:
ETHICS_CRITIQUE:
<assessment>

REVISED_CAPTION:
<caption>"""
    try:
        r = _msg_text(llm.invoke(prompt).content).strip()
        critique, revised = "No issues found.", caption
        if "REVISED_CAPTION:" in r:
            p = r.split("REVISED_CAPTION:", 1)
            critique = p[0].replace("ETHICS_CRITIQUE:", "").strip()
            revised  = re.sub(r'#\w+', '', p[1]).strip()
        return {"critique": critique, "revised": revised}
    except Exception:
        return {"critique": "Ethics check skipped.", "revised": caption}


def ig_critique(state: IGPostState) -> dict:
    caption = state.get("caption", "")
    topic   = state["topic"]
    fmt     = state.get("selected_format", "Reel")
    logger.info(f"===== [NODE: ig_critique] Format: {fmt} | Caption: {len(caption)} chars")

    v_result = _virality_agent(caption, fmt, topic)
    caption  = v_result["revised"]

    b_result = _brand_tone_agent(caption, topic)
    caption  = b_result["revised"]

    e_result = _ethics_agent(caption, topic)
    caption  = e_result["revised"]

    logger.info("===== [NODE: ig_critique] Done.")
    return {
        "agent_critiques": [v_result["critique"], b_result["critique"], e_result["critique"]],
        "caption": caption,
    }


# ── Node 5: Hybrid Scoring ─────────────────────────────────────────────────────

def ig_scoring(state: IGPostState) -> dict:
    caption = state.get("caption", "")
    fmt     = state.get("selected_format", "Reel")
    logger.info(f"===== [NODE: ig_scoring] Caption: {len(caption)} chars")

    # Heuristic
    heuristic = 0.7
    if len(caption) > 50 and ("?" in caption or "!" in caption):
        heuristic = 0.85

    # LLM score
    try:
        r = llm.invoke(
            f"Rate the Instagram engagement potential of this {fmt} caption from 0.0 to 1.0. "
            f"Consider hook strength, CTA, relatability for Indian audience. "
            f"Output ONLY a float: {caption[:400]}"
        )
        llm_score = float(_msg_text(r.content).strip())
    except Exception:
        llm_score = 0.72

    # ML score
    ml_result = ig_caption_predictor.predict_with_details(caption)
    ml_score  = ml_result["score"]

    final = round(0.5 * ml_score + 0.3 * llm_score + 0.2 * heuristic, 4)
    logger.info(f"  ML={ml_score:.3f} LLM={llm_score:.3f} H={heuristic} Final={final:.4f}")

    return {"hybrid_score": {
        "ml": ml_score, "llm": llm_score, "heuristic": heuristic, "final": final,
        "ml_features": ml_result.get("features", {}),
        "ml_top_importances": ml_result.get("top_importances", {}),
    }}


# ── Node 6: Visual Strategy ────────────────────────────────────────────────────

def ig_visual_strategy(state: IGPostState) -> dict:
    caption = state.get("caption", "")
    hook    = state.get("hook", "")
    fmt     = state.get("selected_format", "Reel")
    topic   = state["topic"]
    tone    = state.get("selected_tone", "Educational")
    logger.info(f"===== [NODE: ig_visuals] Format: {fmt}")

    format_visual_notes = {
        "Reel":     "Vertical 9:16 frame. Eye-catching thumbnail. Bold text overlay in center.",
        "Carousel": "Square 1:1. Slide 1 is the cover — must be irresistible. Cohesive color palette across all slides.",
        "Static":   "Square 1:1 or portrait 4:5. Single powerful visual with text overlay.",
        "Story":    "Vertical 9:16. Casual, authentic aesthetic. Polls/interaction elements.",
    }

    prompt = f"""Create an Instagram image generation prompt for a {fmt} cover/thumbnail.

Topic: {topic}
Tone: {tone}
Hook: {hook}
Format note: {format_visual_notes.get(fmt, '')}

The image should:
- Be visually arresting and thumb-stopping
- Match the {tone} tone (Funny=vibrant/playful, Educational=clean/minimal, Emotional=warm/moody)
- Look authentic and relatable to Indian millennials/Gen Z (no stock-photo feel)
- Include: subject, setting, color palette, lighting, mood
- Under 100 words

Output ONLY the image generation prompt."""

    try:
        prompt_text = _msg_text(llm.invoke(prompt).content).strip().strip('"').strip("'")
    except Exception:
        prompt_text = f"Vibrant Instagram {fmt} thumbnail about {topic}, modern Indian aesthetic"

    gen = generate_post_image(prompt_text)
    if "error" in gen:
        image_url = get_fallback_image_url(prompt_text)
    else:
        image_url = f"/generated_images/{gen['filename']}"

    logger.info(f"  → Image: {image_url[:60]}")
    return {"image_prompt": prompt_text, "image_url": image_url}


# ── Compile Graph ──────────────────────────────────────────────────────────────

workflow = StateGraph(IGPostState)

# Register all nodes
workflow.add_node("competitor_analysis", ig_competitor_node)
workflow.add_node("format_selector",     format_selector)
workflow.add_node("trend_search",        ig_trend_search)
workflow.add_node("caption_drafter",     caption_node)
workflow.add_node("hook_gen",            ig_hook_generator)
workflow.add_node("hashtags",            hashtag_node)
workflow.add_node("reel_script",         reel_script_node)
workflow.add_node("carousel",            carousel_node)
workflow.add_node("critique",            ig_critique)
workflow.add_node("scoring",             ig_scoring)
workflow.add_node("visuals",             ig_visual_strategy)

# Entry
workflow.set_entry_point("competitor_analysis")

# Edges
workflow.add_edge("competitor_analysis", "format_selector")
workflow.add_edge("format_selector",     "trend_search")
workflow.add_edge("trend_search",        "caption_drafter")
workflow.add_edge("caption_drafter",     "hook_gen")
workflow.add_edge("hook_gen",            "hashtags")
workflow.add_edge("hashtags",            "reel_script")   # runs for all formats (skips if not Reel)
workflow.add_edge("reel_script",         "carousel")      # same — skips if not Carousel
workflow.add_edge("carousel",            "critique")
workflow.add_edge("critique",            "scoring")

# Reflexion router
def reflexion_router(state: IGPostState) -> str:
    score = state["hybrid_score"]["final"]
    iter_ = state["iteration"]
    if score < 0.75 and iter_ < 2:
        logger.warning(f"===== [ROUTER] Score {score:.4f} < 0.75 at iter {iter_} → REFLEXION")
        return "caption_drafter"
    logger.info(f"===== [ROUTER] Score {score:.4f} at iter {iter_} → VISUALS")
    return "visuals"

workflow.add_conditional_edges("scoring", reflexion_router)
workflow.add_edge("visuals", END)

ig_app_graph = workflow.compile()
