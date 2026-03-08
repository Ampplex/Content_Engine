"""
Competitor Analysis — LinkedIn Niche Intelligence.

Searches for top-performing posts in a given niche/topic, extracts patterns
(hooks, tone, structure, hashtags), and produces actionable insights via LLM.

Used as:
  1. A standalone module:  from competitor_analysis import analyze_competitors
  2. A LangGraph node injected into agent_graph.py

Pipeline:
  topic → generate targeted search queries → web search → LLM pattern extraction
       → structured CompetitorInsights output → injected into drafting prompt
"""

import json
import logging
from typing import Optional, Any
from dataclasses import dataclass, field, asdict

from web_search import search_multiple, search_web
from bedrock_llm import ChatBedrockAPIKey
from config import BEDROCK_API_KEY, BEDROCK_MODEL_ID, AWS_REGION, LLM_TEMPERATURE, LLM_MAX_TOKENS

logger = logging.getLogger("competitor_analysis")

llm = ChatBedrockAPIKey(
    api_key=BEDROCK_API_KEY,
    model_id=BEDROCK_MODEL_ID,
    region=AWS_REGION,
    temperature=LLM_TEMPERATURE,
    max_tokens=LLM_MAX_TOKENS,
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


# ── Data Structures ────────────────────────────────────────────────────────────

@dataclass
class CompetitorInsights:
    """Structured output of the competitor analysis."""
    topic:                str        = ""
    top_hooks:            list       = field(default_factory=list)   # 3-5 high-impact opening lines
    common_tones:         list       = field(default_factory=list)   # ["Educational", "Story", ...]
    popular_hashtags:     list       = field(default_factory=list)   # top hashtags in this niche
    structural_patterns:  list       = field(default_factory=list)   # e.g. "Numbered list", "Problem-solution"
    content_gaps:         list       = field(default_factory=list)   # angles not yet covered
    winning_angles:       list       = field(default_factory=list)   # what consistently gets engagement
    recommended_approach: str        = ""                            # LLM's overall recommendation
    raw_sources:          list       = field(default_factory=list)   # web search result URLs

    def to_dict(self) -> dict:
        return asdict(self)

    def to_prompt_context(self) -> str:
        """Format insights as a clear context block for injection into draft prompts."""
        lines = [
            f"=== COMPETITOR INTELLIGENCE FOR: {self.topic} ===",
            "",
            "TOP-PERFORMING HOOKS IN THIS NICHE:",
        ]
        for h in self.top_hooks[:5]:
            lines.append(f"  • {h}")

        lines += ["", "WINNING CONTENT ANGLES:"]
        for a in self.winning_angles[:4]:
            lines.append(f"  • {a}")

        lines += ["", "CONTENT GAPS (underexplored angles you can own):"]
        for g in self.content_gaps[:4]:
            lines.append(f"  • {g}")

        lines += ["", "POPULAR HASHTAGS IN NICHE:"]
        lines.append("  " + "  ".join(self.popular_hashtags[:8]))

        lines += ["", "RECOMMENDED APPROACH:"]
        lines.append(f"  {self.recommended_approach}")

        lines.append("")
        lines.append("=== END COMPETITOR INTELLIGENCE ===")
        return "\n".join(lines)


# ── Search Query Generation ────────────────────────────────────────────────────

def _generate_competitor_queries(topic: str) -> list[str]:
    """
    Use LLM to generate targeted search queries to find top LinkedIn posts in niche.
    Returns 5 focused queries.
    """
    prompt = f"""You are a LinkedIn content intelligence researcher.

Generate exactly 5 web search queries to find high-performing LinkedIn posts
and content about this topic: "{topic}"

Your queries should find:
  1. Top viral LinkedIn posts about {topic} in India 2025-2026
  2. Best-performing LinkedIn content format for {topic}
  3. Trending angles/perspectives on {topic} for professionals
  4. Thought leaders writing about {topic} on LinkedIn
  5. Statistics or data points about {topic} that would resonate on LinkedIn

Output ONLY a valid JSON array of 5 strings. No markdown, no explanation, no preamble."""

    try:
        response = llm.invoke(prompt)
        queries = json.loads(_msg_text(response.content).strip().strip("```json").strip("```"))
        if isinstance(queries, list) and len(queries) >= 3:
            logger.info(f"[Competitor] Generated {len(queries)} queries for '{topic[:40]}'")
            return [str(q) for q in queries[:5]]
    except Exception as e:
        logger.warning(f"[Competitor] Query generation failed: {e}, using fallback queries")

    # Fallback queries
    return [
        f"viral LinkedIn posts about {topic} India 2026",
        f"top LinkedIn content {topic} professionals engagement",
        f"{topic} LinkedIn thought leaders best posts",
        f"trending {topic} content LinkedIn B2B India",
        f"{topic} statistics data LinkedIn post 2025 2026",
    ]


# ── Pattern Extraction ─────────────────────────────────────────────────────────

def _extract_patterns_with_llm(topic: str, search_results: list[dict]) -> CompetitorInsights:
    """
    Feed web search results to LLM to extract structured competitor patterns.
    Returns a CompetitorInsights object.
    """
    if not search_results:
        logger.warning("[Competitor] No search results to analyze. Returning minimal insights.")
        return CompetitorInsights(
            topic=topic,
            recommended_approach=f"No competitor data found. Focus on being authentic and data-driven about {topic}.",
        )

    # Format search results for the LLM
    results_text = "\n".join(
        f"[{i+1}] Title: {r.get('title','')}\n    Snippet: {r.get('snippet','')[:200]}\n    URL: {r.get('url','')}"
        for i, r in enumerate(search_results[:15])
    )

    analysis_prompt = f"""You are a LinkedIn content intelligence analyst.

I searched for top-performing LinkedIn content about "{topic}" and found these results:

{results_text}

Based on these findings, analyze the competitive landscape and extract structured insights.

Return a valid JSON object with EXACTLY these keys:
{{
  "top_hooks": ["hook 1", "hook 2", "hook 3", "hook 4", "hook 5"],
  "common_tones": ["Educational", "Story"],
  "popular_hashtags": ["#AI", "#Leadership", "..."],
  "structural_patterns": ["Numbered list (1-5 lessons)", "Problem → Solution → CTA", "..."],
  "content_gaps": ["angle not covered yet 1", "angle not covered yet 2", "..."],
  "winning_angles": ["angle that consistently gets engagement 1", "..."],
  "recommended_approach": "One paragraph: the single best strategy to stand out in this niche based on the data."
}}

Rules:
- top_hooks: Write 5 ACTUAL example opening lines (1-2 sentences) that would work for "{topic}"
- content_gaps: Focus on underexplored angles YOU spotted in the search results
- winning_angles: Based on what the top-performing content has in common
- recommended_approach: Be specific to "{topic}" for Indian B2B professionals
- Output ONLY the JSON object. No markdown, no preamble, no explanation."""

    try:
        response = llm.invoke(analysis_prompt)
        content = _msg_text(response.content).strip().strip("```json").strip("```").strip()
        data = json.loads(content)

        raw_urls = [r.get("url", "") for r in search_results[:10] if r.get("url")]

        return CompetitorInsights(
            topic=topic,
            top_hooks=data.get("top_hooks", []),
            common_tones=data.get("common_tones", []),
            popular_hashtags=data.get("popular_hashtags", []),
            structural_patterns=data.get("structural_patterns", []),
            content_gaps=data.get("content_gaps", []),
            winning_angles=data.get("winning_angles", []),
            recommended_approach=data.get("recommended_approach", ""),
            raw_sources=raw_urls,
        )

    except Exception as e:
        logger.error(f"[Competitor] LLM pattern extraction failed: {e}")
        return CompetitorInsights(
            topic=topic,
            recommended_approach=f"Focus on data-driven, story-based content about {topic} for Indian professionals.",
            raw_sources=[r.get("url", "") for r in search_results[:5]],
        )


# ── Hashtag Intelligence ───────────────────────────────────────────────────────

def _enrich_hashtags(topic: str, existing_hashtags: list[str]) -> list[str]:
    """
    Use LLM to suggest additional high-reach hashtags for the topic,
    beyond what the search results surfaced.
    Returns a deduplicated merged list.
    """
    prompt = f"""Suggest 10 high-reach LinkedIn hashtags for content about "{topic}" targeting Indian B2B professionals.

Focus on hashtags that are:
- Actively monitored by professionals in this space
- A mix of broad (#AI, #Leadership) and niche (#{topic.replace(' ', '')}India)
- Relevant to 2025-2026 trends

Output ONLY a valid JSON array of strings (with # prefix). No markdown."""

    try:
        response = llm.invoke(prompt)
        new_tags = json.loads(_msg_text(response.content).strip().strip("```json").strip("```"))
        merged = list(dict.fromkeys(existing_hashtags + new_tags))  # dedupe, preserve order
        return merged[:12]
    except Exception:
        return existing_hashtags


# ── Main Public Function ───────────────────────────────────────────────────────

def analyze_competitors(topic: str, enrich_hashtags: bool = True) -> CompetitorInsights:
    """
    Full competitor analysis pipeline for a given topic.

    1. Generates 5 targeted search queries
    2. Fetches web results (Google News RSS + DuckDuckGo)
    3. LLM extracts structured patterns
    4. Optionally enriches hashtag list

    Args:
        topic:             The topic/niche to analyze (e.g. "AI in Indian hiring")
        enrich_hashtags:   Whether to run an extra LLM pass to boost hashtag list

    Returns:
        CompetitorInsights dataclass with all extracted patterns
    """
    logger.info(f"[Competitor] Starting analysis for: '{topic}'")

    # Step 1: Generate queries
    queries = _generate_competitor_queries(topic)
    logger.info(f"[Competitor] Queries: {queries}")

    # Step 2: Execute searches
    search_results = search_multiple(queries, max_results_per_query=4)
    logger.info(f"[Competitor] Retrieved {len(search_results)} unique results")

    # Step 3: LLM pattern extraction
    insights = _extract_patterns_with_llm(topic, search_results)

    # Step 4: Hashtag enrichment
    if enrich_hashtags and insights.popular_hashtags:
        insights.popular_hashtags = _enrich_hashtags(topic, insights.popular_hashtags)

    logger.info(
        f"[Competitor] Done. Gaps: {len(insights.content_gaps)}, "
        f"Hooks: {len(insights.top_hooks)}, "
        f"Hashtags: {len(insights.popular_hashtags)}"
    )
    return insights


# ── LangGraph Node Function ────────────────────────────────────────────────────

def competitor_analysis_node(state: Any) -> dict:
    """
    LangGraph node wrapper. Reads 'topic' from state, runs full analysis,
    writes 'competitor_insights' (dict) and 'competitor_context' (str) to state.

    Uses Any for state type to avoid circular import with agent_graph.PostState.
    The typed wrapper _competitor_node(state: PostState) in agent_graph.py
    satisfies LangGraph's StateNode type check at registration time.
    """
    topic = state.get("topic", "")
    iteration = state.get("iteration", 0)
    logger.info(f"===== [NODE: competitor_analysis] Topic: '{topic[:50]}' | Iter: {iteration}")

    try:
        insights = analyze_competitors(topic)
        return {
            "competitor_insights": insights.to_dict(),
            "competitor_context":  insights.to_prompt_context(),
        }
    except Exception as e:
        logger.error(f"[NODE: competitor_analysis] Failed: {e}")
        return {
            "competitor_insights": {},
            "competitor_context":  f"Competitor analysis unavailable for '{topic}'.",
        }


# ── CLI Quick Test ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import sys
    topic = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else "AI transforming hiring in India"
    print(f"\nAnalyzing competitors for: '{topic}'\n")
    result = analyze_competitors(topic)
    print(result.to_prompt_context())
    print(f"\nRaw sources: {result.raw_sources[:3]}")
