import os
import json
import logging
from typing import TypedDict, List
from langgraph.graph import StateGraph, END
from bedrock_llm import ChatBedrockAPIKey
from config import BEDROCK_API_KEY, BEDROCK_MODEL_ID, AWS_REGION, LLM_TEMPERATURE, LLM_MAX_TOKENS
from ml_model import post_predictor
from web_search import search_multiple
from image_gen import generate_post_image, get_fallback_image_url

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("agent_graph")

llm = ChatBedrockAPIKey(
    api_key=BEDROCK_API_KEY,
    model_id=BEDROCK_MODEL_ID,
    region=AWS_REGION,
    temperature=LLM_TEMPERATURE,
    max_tokens=LLM_MAX_TOKENS,
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
    image_url: str
    search_queries: List[str]
    search_results: List[dict]
    trend_insights: str
    hook: str
    previous_draft: str
    previous_critiques: List[str]

def generate_base_draft(state: PostState):
    iteration = state.get("iteration", 0) + 1
    lang = state.get('target_language', 'English')
    logger.info(f"===== [NODE: drafting] Starting iteration {iteration} | Topic: {state['topic'][:50]} | Language: {lang}")

    lang_instruction = f"Write the post in {lang}." if lang != "English" else ""

    prev_draft = state.get("previous_draft", "")
    prev_critiques = state.get("previous_critiques", [])

    if prev_draft and prev_critiques:
        # Refinement mode — use previous draft + critiques to improve
        critique_text = "\n".join(f"- {c}" for c in prev_critiques)
        prompt = f"""You previously wrote this LinkedIn post:

{prev_draft}

It received these critiques from review agents:
{critique_text}

Rewrite the post about "{state['topic']}" addressing ALL the critiques above.
{lang_instruction}

Rules:
- TARGET LENGTH: 1,300-2,000 characters (the optimal range for LinkedIn engagement).
- Use **bold** (markdown) for section headings and key terms/stats.
- Each paragraph: 1-3 sentences MAX. Leave a blank line between every paragraph.
- Include a "Key Takeaways" or "Why it matters" section using bullet points (3-5 items).
- Include 2-3 concrete data points, stats, or real examples.
- Fix every issue raised in the critiques.
- End with a one-line call-to-action or thought-provoking question.
- After the CTA, add 3-5 relevant hashtags (e.g. #AI #MachineLearning #Leadership).
- No filler phrases. No meta-labels like "Opening Hook:" or "Post:".
- Write ONLY the post body — do NOT include the hook/headline."""
    else:
        prompt = f"""Write a punchy, well-formatted LinkedIn post about: {state['topic']}.
{lang_instruction}

Rules:
- TARGET LENGTH: 1,300-2,000 characters (the optimal range for LinkedIn engagement).
- Use **bold** (markdown) for section headings and key terms/numbers/stats.
- Each paragraph: 1-3 sentences MAX. Leave a blank line between every paragraph.
- Structure the post with clear sections (e.g. the problem, the insight, key takeaways).
- Include a bullet-point section (3-5 items) for key takeaways, stats, or action items.
- Include 2-3 concrete data points, real-world examples, or case studies.
- Explain the WHY and HOW, not just the WHAT.
- End with a one-line call-to-action or thought-provoking question.
- After the CTA, add 3-5 relevant hashtags (e.g. #AI #MachineLearning #Leadership).
- No filler phrases like "In today's world" or "It's no secret that".
- No meta-labels like "Opening Hook:", "Post:", or "Headline:". Just write the post.
- Write ONLY the post body — do NOT include any headline or hook.
- Make every sentence add value — be specific, not vague."""

    response = llm.invoke(prompt)
    logger.info(f"===== [NODE: drafting] Done. Draft length: {len(response.content)} chars")
    return {"english_draft": response.content, "iteration": iteration}

def trend_search_agent(state: PostState):
    """Generate search queries, perform web searches, fact-check, and enrich the draft."""
    topic = state['topic']
    draft = state['english_draft']
    iteration = state.get('iteration', 1)
    logger.info(f"===== [NODE: trend_search] Generating search queries | Iteration: {iteration}")

    # ── Step 1: LLM generates targeted search queries ──────────────────────
    query_prompt = f"""You are a research assistant. Generate exactly 3 focused web search queries
for fact-checking and trend analysis of this LinkedIn post.

Topic: {topic}
Draft excerpt: {draft[:600]}

Generate:
- 1 fact-check query (verify any claims, statistics, or facts in the draft)
- 1 trend query (find the latest 2025-2026 trends, data, or statistics on this topic)
- 1 audience query (what professionals are currently discussing about this topic)

Output ONLY a valid JSON array of exactly 3 strings. No markdown, no explanation."""

    try:
        qr = llm.invoke(query_prompt)
        queries = json.loads(qr.content.strip().strip("```json").strip("```"))
        if not isinstance(queries, list) or len(queries) == 0:
            raise ValueError("Empty query list")
        queries = [str(q) for q in queries[:5]]  # cap at 5
    except Exception as e:
        logger.warning(f"  Query generation failed ({e}), using fallback queries")
        queries = [
            f"{topic} fact check 2026",
            f"{topic} latest trends statistics 2026",
            f"{topic} LinkedIn professional discussion",
        ]
    logger.info(f"  Generated queries: {queries}")

    # ── Step 2: Execute web searches ───────────────────────────────────────
    search_results = search_multiple(queries, max_results_per_query=3)
    logger.info(f"  Retrieved {len(search_results)} unique results")

    # ── Step 3: LLM synthesizes findings & enriches the draft ─────────────
    if search_results:
        results_text = "\n".join(
            f"- [{r['title']}]({r['url']}): {r['snippet']}"
            for r in search_results[:10]
        )
    else:
        results_text = "No web results were found. Proceed with general knowledge."

    synthesis_prompt = f"""You are a Trend Analyst & Fact-Checker for LinkedIn content.

Original draft:
{draft}

Web search results:
{results_text}

Do TWO things:

1. **Trend Insights** (2-3 bullet points): Summarize the most relevant trends, statistics,
   or facts from the search results that relate to the topic "{topic}".
   Flag any claims in the draft that contradict the search results.

2. **Enriched Draft**: Rewrite the LinkedIn post incorporating:
   - Verified/updated facts and statistics from the search results
   - Trending angles that make the post more timely and relevant
   - Keep the original tone and structure but make it more authoritative
   - TARGET LENGTH: 1,300-2,000 characters (optimal LinkedIn engagement range).
   - Use **bold** (markdown) for section headings and key terms/stats.
   - Each paragraph: 1-3 sentences MAX with blank lines between them.
   - Include a bullet-point section for key takeaways (3-5 items).
   - Do NOT add meta-labels like "Post:" or "Opening Hook:"
   - Write ONLY the post body — no headline or hook
   - End with 3-5 relevant hashtags after the call-to-action
   - IMPORTANT: Write the enriched draft in the SAME language as the original draft

Format your response as:
INSIGHTS:
<bullet points>

ENRICHED_DRAFT:
<the improved post>"""

    response = llm.invoke(synthesis_prompt)
    content = response.content.strip()

    # Parse the structured response
    insights = ""
    enriched_draft = draft  # fallback to original
    if "ENRICHED_DRAFT:" in content:
        parts = content.split("ENRICHED_DRAFT:", 1)
        insights = parts[0].replace("INSIGHTS:", "").strip()
        enriched_draft = parts[1].strip()
    elif "INSIGHTS:" in content:
        insights = content.replace("INSIGHTS:", "").strip()
    else:
        enriched_draft = content

    logger.info(f"===== [NODE: trend_search] Done. Insights: {len(insights)} chars, Enriched draft: {len(enriched_draft)} chars")

    return {
        "search_queries": queries,
        "search_results": search_results,
        "trend_insights": insights,
        "english_draft": enriched_draft,  # overwrite draft with enriched version
    }


def hook_generator(state: PostState):
    """Generate a scroll-stopping opening hook / title for the post."""
    draft = state['english_draft']
    topic = state['topic']
    lang = state.get('target_language', 'English')
    logger.info(f"===== [NODE: hook] Generating opening hook in {lang} | Iteration: {state.get('iteration', 1)}")

    lang_instruction = f"Write the hook in {lang}." if lang != "English" else ""

    prompt = f"""You are a LinkedIn copywriting expert specializing in viral hooks.

Generate a single scroll-stopping opening hook for this LinkedIn post.
The hook should:
- Be 1-2 lines max (under 15 words)
- Create curiosity, urgency, or a bold claim
- Make the reader STOP scrolling and click "see more"
- Can use a provocative question, a surprising stat, a contrarian take, or a bold statement
- No emojis in the hook itself
{lang_instruction}

Topic: {topic}
Post body:
{draft[:500]}

Output ONLY the hook text. Nothing else."""

    response = llm.invoke(prompt)
    hook = response.content.strip().strip('"').strip("'")
    logger.info(f"===== [NODE: hook] Done. Hook: {hook[:80]}")
    return {"hook": hook}


def indic_localization_agent(state: PostState):
    lang = state.get('target_language', 'English')
    logger.info(f"===== [NODE: localization] Adapting for {lang} | Iteration: {state.get('iteration', 0)}")
    hook = state.get('hook', '')

    if lang == 'English':
        # No translation needed — just culturally adapt for Indian professionals
        prompt = f"""Culturally adapt this LinkedIn post for Indian professionals.
    Keep it concise — no extra filler. Preserve the punchy tone.
    Make references relatable to the Indian market where relevant.

    Post to adapt:
    {state['english_draft']}

    CRITICAL OUTPUT RULES:
    - Output ONLY the adapted post body. Nothing else.
    - Do NOT include the hook/headline — it is handled separately.
    - Do NOT add labels like "Opening Hook:", "Post:", "Hook:", or any prefix.
    - Keep 1,300-2,000 characters (optimal LinkedIn engagement range). Each paragraph 1-3 sentences max.
    - Preserve all **bold** formatting and bullet points from the input.
    - Preserve any hashtags at the end of the post. If none exist, add 3-5 relevant ones.
    - Leave blank lines between paragraphs."""
    else:
        prompt = f"""Review and polish this LinkedIn post which is already in {lang}.
    Ensure it sounds natural and culturally appropriate for Indian professionals.
    Keep it concise — no extra filler. Preserve the punchy tone.
    If any parts are still in English, translate them to {lang}.

    Post to polish:
    {state['english_draft']}

    CRITICAL OUTPUT RULES:
    - Output ONLY the polished post body in {lang}. Nothing else.
    - Do NOT include the hook/headline — it is handled separately.
    - Do NOT add labels like "Opening Hook:", "Post:", "Hook:", or any prefix.
    - Keep 1,300-2,000 characters (optimal LinkedIn engagement range). Each paragraph 1-3 sentences max.
    - Preserve all **bold** formatting and bullet points from the input.
    - Preserve any hashtags at the end of the post. If none exist, add 3-5 relevant ones.
    - Leave blank lines between paragraphs."""

    response = llm.invoke(prompt)
    content = response.content.strip()

    # Strip any leaked labels the LLM might still add
    import re
    content = re.sub(r'^(?:Opening Hook|Hook|Post|Headline|Title)\s*:\s*', '', content, flags=re.MULTILINE | re.IGNORECASE)
    content = content.strip()

    logger.info(f"===== [NODE: localization] Done. Localized length: {len(content)} chars")
    return {"localized_draft": content}

def _run_seo_agent(text: str, topic: str, lang: str = 'English') -> dict:
    """Critique + rewrite: returns {'critique': str, 'revised_draft': str}."""
    import re
    lang_instruction = f"Write in {lang}." if lang != 'English' else ""
    prompt = f"""You are an SEO optimization agent for LinkedIn content targeting Indian professionals.

Analyze and REWRITE the following LinkedIn post to maximize discoverability.
{lang_instruction}

Topic: {topic}
Post:
{text}

Do BOTH:
1. SEO CRITIQUE: One concise paragraph of actionable SEO feedback (keyword gaps, discoverability issues).
2. REVISED POST: Rewrite the post incorporating your SEO improvements:
   - Naturally weave in high-value keywords for the topic
   - Improve scannability (bold headings, bullet points)
   - Add 3-5 relevant hashtags at the very end (e.g. #AI #MachineLearning)
   - Keep the same tone, structure, and length (1,300-2,000 chars)
   - Preserve all **bold** formatting and bullet points
   - Do NOT add meta-labels like "Post:" or "Hook:"

Format your response EXACTLY like this:
SEO_CRITIQUE:
<your critique paragraph>

REVISED_POST:
<the improved post with hashtags at the end>"""
    response = llm.invoke(prompt)
    content = response.content.strip()

    # Parse structured response
    critique = content
    revised = text  # fallback to original
    if 'REVISED_POST:' in content:
        parts = content.split('REVISED_POST:', 1)
        critique = parts[0].replace('SEO_CRITIQUE:', '').strip()
        revised = parts[1].strip()
    elif 'SEO_CRITIQUE:' in content:
        critique = content.replace('SEO_CRITIQUE:', '').strip()

    # Ensure hashtags exist in output
    existing_hashtags = re.findall(r'#\w+', revised)
    if not existing_hashtags:
        fallback_tags = [f'#{w}' for w in topic.split()[:2]] + ['#LinkedIn', '#Innovation', '#Leadership']
        revised = revised.rstrip() + '\n\n' + ' '.join(fallback_tags[:5])

    return {'critique': critique, 'revised_draft': revised}

def _run_brand_guardian(text: str, lang: str = 'English') -> dict:
    """Critique + rewrite: returns {'critique': str, 'revised_draft': str}."""
    lang_instruction = f"Write in {lang}." if lang != 'English' else ""
    prompt = f"""You are a Brand Guardian agent. Your role is to review AND improve content for
professional tone, brand consistency, and enterprise-readiness.
{lang_instruction}

Post:
{text}

Do BOTH:
1. BRAND CRITIQUE: One concise paragraph of specific feedback on tone, professionalism,
   and enterprise alignment issues.
2. REVISED POST: Rewrite the post with your improvements applied:
   - Fix any tone/professionalism issues you identified
   - Ensure enterprise-ready language (no slang, clickbait, or unprofessional phrasing)
   - Strengthen authority and credibility signals
   - Keep the same structure, length (1,300-2,000 chars), and key points
   - Preserve all **bold** formatting, bullet points, and hashtags
   - Do NOT add meta-labels like "Post:" or "Hook:"

Format your response EXACTLY like this:
BRAND_CRITIQUE:
<your critique paragraph>

REVISED_POST:
<the improved post>"""
    response = llm.invoke(prompt)
    content = response.content.strip()

    critique = content
    revised = text  # fallback
    if 'REVISED_POST:' in content:
        parts = content.split('REVISED_POST:', 1)
        critique = parts[0].replace('BRAND_CRITIQUE:', '').strip()
        revised = parts[1].strip()
    elif 'BRAND_CRITIQUE:' in content:
        critique = content.replace('BRAND_CRITIQUE:', '').strip()

    return {'critique': critique, 'revised_draft': revised}

def _run_ethics_agent(text: str, lang: str = 'English') -> dict:
    """Critique + rewrite: returns {'critique': str, 'revised_draft': str}."""
    lang_instruction = f"Write in {lang}." if lang != 'English' else ""
    prompt = f"""You are an Ethics & Safety agent. Your role is to review AND fix content for:
- Potential biases (gender, cultural, regional, socioeconomic)
- Misinformation or unverified claims
- Harmful stereotypes
- Regulatory or compliance issues
{lang_instruction}

Post:
{text}

Do BOTH:
1. ETHICS CRITIQUE: One concise paragraph with your safety assessment — flag any issues found.
2. REVISED POST: Rewrite the post with fixes applied:
   - Remove or rephrase any biased, misleading, or unverified claims
   - Add hedging language where claims are uncertain (e.g. "studies suggest" vs asserting facts)
   - Ensure inclusive language
   - Keep the same structure, length (1,300-2,000 chars), and key points
   - Preserve all **bold** formatting, bullet points, and hashtags
   - Do NOT add meta-labels like "Post:" or "Hook:"
   - If no issues found, return the post unchanged

Format your response EXACTLY like this:
ETHICS_CRITIQUE:
<your assessment paragraph>

REVISED_POST:
<the improved or unchanged post>"""
    response = llm.invoke(prompt)
    content = response.content.strip()

    critique = content
    revised = text  # fallback
    if 'REVISED_POST:' in content:
        parts = content.split('REVISED_POST:', 1)
        critique = parts[0].replace('ETHICS_CRITIQUE:', '').strip()
        revised = parts[1].strip()
    elif 'ETHICS_CRITIQUE:' in content:
        critique = content.replace('ETHICS_CRITIQUE:', '').strip()

    return {'critique': critique, 'revised_draft': revised}

def multi_agent_critique(state: PostState):
    """Chain 3 critique agents: each critiques AND rewrites, feeding into the next."""
    logger.info(f"===== [NODE: critique] Running 3 critique agents (chained) | Iteration: {state.get('iteration', 0)}")
    draft = state['localized_draft']
    topic = state['topic']
    lang = state.get('target_language', 'English')

    # ── Agent 1: SEO Agent — optimizes keywords, discoverability, adds hashtags ──
    logger.info("  -> Running SEO Agent (critique + rewrite)...")
    seo_result = _run_seo_agent(draft, topic, lang)
    seo_critique = seo_result['critique']
    draft = seo_result['revised_draft']  # SEO's rewrite becomes input for next agent
    logger.info(f"  -> SEO done. Revised draft: {len(draft)} chars")

    # ── Agent 2: Brand Guardian — fixes tone, professionalism, enterprise-readiness ──
    logger.info("  -> Running Brand Guardian (critique + rewrite)...")
    brand_result = _run_brand_guardian(draft, lang)
    brand_critique = brand_result['critique']
    draft = brand_result['revised_draft']  # Brand's rewrite becomes input for next agent
    logger.info(f"  -> Brand Guardian done. Revised draft: {len(draft)} chars")

    # ── Agent 3: Ethics Agent — removes bias, fixes misinformation, ensures safety ──
    logger.info("  -> Running Ethics Agent (critique + rewrite)...")
    ethics_result = _run_ethics_agent(draft, lang)
    ethics_critique = ethics_result['critique']
    draft = ethics_result['revised_draft']  # Final polished draft
    logger.info(f"  -> Ethics done. Final draft: {len(draft)} chars")

    logger.info(f"===== [NODE: critique] Done. All 3 agents completed (chained rewrite).")

    return {
        "agent_critiques": [seo_critique, brand_critique, ethics_critique],
        "localized_draft": draft,  # fully modified by all 3 agents
    }

def hybrid_scoring_engine(state: PostState):
    logger.info(f"===== [NODE: scoring] Computing hybrid score | Iteration: {state.get('iteration', 0)}")
    text = state['localized_draft']
    
    # Heuristic (Rule-based)
    heuristic = 0.8 if len(text) > 150 and ("?" in text or "!" in text) else 0.5
    logger.info(f"  -> Heuristic score: {heuristic}")
    
    # LLM Score Eval
    try:
        eval_prompt = f"Rate the engagement potential of this text from 0.0 to 1.0. Output ONLY the float number: {text}"
        llm_eval = llm.invoke(eval_prompt)
        llm_score = float(llm_eval.content.strip())
        logger.info(f"  -> LLM score: {llm_score}")
    except:
        llm_score = 0.75
        logger.warning(f"  -> LLM score failed, using fallback: {llm_score}")
        
    # ML scoring via LightGBM (real feature extraction + trained model)
    ml_features = {}
    ml_importances = {}
    try:
        ml_result = post_predictor.predict_with_details(text)
        ml_score = ml_result["score"]
        ml_features = ml_result["features"]
        # Top 5 features by importance for explainability
        ml_importances = {k: round(v, 1) for k, v in sorted(
            ml_result['feature_importances'].items(), key=lambda x: -x[1]
        )[:5]}
        logger.info(f"  -> LightGBM ML score: {ml_score:.4f}")
        logger.info(f"  -> Top features: {ml_importances}")
    except Exception as e:
        ml_score = 0.75
        logger.warning(f"  -> LightGBM ML score failed ({e}), using fallback: {ml_score}")
    
    # Formula: final_text_score = 0.5 * ml_score + 0.3 * llm_score + 0.2 * heuristic_score
    final_score = (0.5 * ml_score) + (0.3 * llm_score) + (0.2 * heuristic)
    logger.info(f"===== [NODE: scoring] Final score: {final_score:.4f} (LightGBM={ml_score:.3f}, LLM={llm_score:.3f}, Heuristic={heuristic})")
    
    return {"hybrid_score": {
        "ml": ml_score, "llm": llm_score, "heuristic": heuristic, "final": final_score,
        "ml_features": ml_features,
        "ml_top_importances": ml_importances,
    }}

def visual_strategy_agent(state: PostState):
    logger.info(f"===== [NODE: visuals] Generating image prompt | Iteration: {state.get('iteration', 0)}")

    draft = state['localized_draft']
    hook = state.get('hook', '')

    prompt = f"""You are an expert visual creative director for LinkedIn content.

Given this LinkedIn post, craft a single, highly descriptive image generation prompt
that will produce a stunning, scroll-stopping visual to accompany the post.

POST HOOK: {hook}
POST BODY: {draft[:600]}

GUIDELINES for the image prompt:
- Describe a SPECIFIC scene, not abstract concepts
- Include: subject, setting, lighting, mood, color palette, camera angle
- Use photographic/cinematic language (e.g. "soft golden hour lighting", "shallow depth of field", "top-down 45° angle")
- Style: professional, modern, aspirational — suitable for LinkedIn
- Aspect ratio should suit a wide LinkedIn banner (16:9)
- NO text overlays in the image
- NO people's faces (to avoid uncanny valley)
- Keep the prompt under 120 words

Return ONLY the image generation prompt, nothing else. No quotes, no explanation."""

    response = llm.invoke(prompt)
    image_prompt = response.content.strip().strip('"').strip("'")
    logger.info(f"===== [NODE: visuals] Image prompt: {image_prompt[:100]}...")

    # Generate image using AWS Bedrock (Titan v2 primary, Stability AI fallback)
    logger.info("  -> Calling AWS Bedrock image generation...")
    gen_result = generate_post_image(image_prompt)

    if "error" in gen_result:
        # Fallback to Pollinations.ai if all Bedrock models fail
        logger.warning(f"  -> Bedrock failed ({gen_result['error']}), falling back to Pollinations.ai")
        image_url = get_fallback_image_url(image_prompt)
    else:
        # Serve from local static path
        image_url = f"/generated_images/{gen_result['filename']}"
        logger.info(f"  -> Image generated: {image_url}")

    logger.info(f"===== [NODE: visuals] Done.")
    return {"image_prompt": image_prompt, "image_url": image_url}

# Compile Graph
workflow = StateGraph(PostState)
workflow.add_node("drafting", generate_base_draft)
workflow.add_node("trend_search", trend_search_agent)
workflow.add_node("hook_gen", hook_generator)
workflow.add_node("localization", indic_localization_agent)
workflow.add_node("critique", multi_agent_critique)
workflow.add_node("scoring", hybrid_scoring_engine)
workflow.add_node("visuals", visual_strategy_agent)

workflow.set_entry_point("drafting")
workflow.add_edge("drafting", "trend_search")
workflow.add_edge("trend_search", "hook_gen")
workflow.add_edge("hook_gen", "localization")
workflow.add_edge("localization", "critique")
workflow.add_edge("critique", "scoring")

def reflexion_router(state: PostState):
    score = state["hybrid_score"]["final"]
    iteration = state["iteration"]
    if score < 0.75 and iteration < 2:
        logger.warning(f"===== [ROUTER] Score {score:.4f} < 0.75 at iteration {iteration} -> LOOPING BACK to drafting")
        return "drafting"
    logger.info(f"===== [ROUTER] Score {score:.4f} at iteration {iteration} -> PASSING to visuals")
    return "visuals"

workflow.add_conditional_edges("scoring", reflexion_router)
workflow.add_edge("visuals", END)

app_graph = workflow.compile()
