"""
Instagram Competitor Intelligence.

Searches for top-performing Instagram content in a niche,
extracts hooks, formats, hashtags, and content gaps via LLM.

Standalone: from instagram_competitor import analyze_ig_competitors
LangGraph node: competitor_node(state)
"""

import json
import logging
from dataclasses import dataclass, field, asdict
from typing import Any

from web_search import search_multiple          # ✅ reused from existing
from bedrock_llm import ChatBedrockAPIKey       # ✅ reused
from config import (                            # ✅ reused
    BEDROCK_API_KEY, BEDROCK_MODEL_ID,
    AWS_REGION, LLM_TEMPERATURE, LLM_MAX_TOKENS,
)

logger = logging.getLogger("instagram_competitor")

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


@dataclass
class IGCompetitorInsights:
    topic:                str  = ""
    top_hooks:            list = field(default_factory=list)   # scroll-stopping first lines
    winning_formats:      list = field(default_factory=list)   # Reel / Carousel / Static
    winning_tones:        list = field(default_factory=list)   # Funny / Educational / etc.
    popular_hashtags:     list = field(default_factory=list)   # 20-30 ranked hashtags
    content_gaps:         list = field(default_factory=list)   # underexplored angles
    reel_ideas:           list = field(default_factory=list)   # 3 specific reel concepts
    carousel_ideas:       list = field(default_factory=list)   # 3 carousel slide concepts
    recommended_approach: str  = ""
    raw_sources:          list = field(default_factory=list)

    def to_dict(self) -> dict:
        return asdict(self)

    def to_prompt_context(self) -> str:
        lines = [
            f"=== INSTAGRAM COMPETITOR INTEL: {self.topic} ===",
            "",
            "TOP HOOKS THAT STOP THE SCROLL:",
        ]
        for h in self.top_hooks[:5]:
            lines.append(f"  • {h}")
        lines += ["", "WINNING FORMATS IN THIS NICHE:"]
        for f in self.winning_formats[:4]:
            lines.append(f"  • {f}")
        lines += ["", "CONTENT GAPS (angles to own):"]
        for g in self.content_gaps[:4]:
            lines.append(f"  • {g}")
        lines += ["", "REEL IDEAS:"]
        for r in self.reel_ideas[:3]:
            lines.append(f"  • {r}")
        lines += ["", "TOP HASHTAGS:"]
        lines.append("  " + "  ".join(self.popular_hashtags[:15]))
        lines += ["", "RECOMMENDED APPROACH:"]
        lines.append(f"  {self.recommended_approach}")
        lines += ["", "=== END INSTAGRAM INTEL ==="]
        return "\n".join(lines)


def _generate_queries(topic: str) -> list[str]:
    prompt = f"""Generate exactly 5 web search queries to find top Instagram content about "{topic}".

Queries should find:
1. Viral Instagram Reels about {topic} India 2025-2026
2. Top Instagram creators posting about {topic}
3. Most shared Instagram carousels {topic} for Indian audience
4. Trending Instagram content formats for {topic}
5. Instagram hashtags strategy for {topic} India

Output ONLY a valid JSON array of 5 strings. No markdown."""
    try:
        r = llm.invoke(prompt)
        q = json.loads(_msg_text(r.content).strip().strip("```json").strip("```"))
        if isinstance(q, list) and len(q) >= 3:
            return [str(x) for x in q[:5]]
    except Exception as e:
        logger.warning(f"[IG Competitor] Query gen failed: {e}")
    return [
        f"viral Instagram reels {topic} India 2026",
        f"top Instagram content creators {topic} Indian audience",
        f"best Instagram carousel ideas {topic}",
        f"trending Instagram hashtags {topic} India",
        f"Instagram reel script ideas {topic} 2026",
    ]


def _extract_insights(topic: str, results: list) -> IGCompetitorInsights:
    if not results:
        return IGCompetitorInsights(
            topic=topic,
            recommended_approach=f"No data found. Create authentic Reel content about {topic} targeting Indian Gen Z.",
        )

    results_text = "\n".join(
        f"[{i+1}] {r.get('title','')} — {r.get('snippet','')[:200]}"
        for i, r in enumerate(results[:15])
    )

    prompt = f"""You are an Instagram content intelligence analyst for the Indian market.

Search results for top Instagram content about "{topic}":
{results_text}

Extract structured Instagram content intelligence. Return ONLY valid JSON:
{{
  "top_hooks": ["5 actual scroll-stopping first lines for Reels/Carousels about {topic}"],
  "winning_formats": ["format: why it works — e.g. 'Reels under 30s: quick tips get saves'"],
  "winning_tones": ["Funny", "Educational"],
  "popular_hashtags": ["#hashtag1", "#hashtag2", ... 20 hashtags for {topic} India],
  "content_gaps": ["underexplored angle 1", "underexplored angle 2", "underexplored angle 3"],
  "reel_ideas": ["specific 30-sec reel concept 1", "concept 2", "concept 3"],
  "carousel_ideas": ["10-slide carousel concept 1", "concept 2", "concept 3"],
  "recommended_approach": "1 paragraph: best Instagram strategy for {topic} targeting Indian millennials/Gen Z in 2026"
}}

Focus on Indian Instagram audience behavior. Be specific and actionable.
Output ONLY the JSON. No markdown, no preamble."""

    try:
        r    = llm.invoke(prompt)
        data = json.loads(_msg_text(r.content).strip().strip("```json").strip("```").strip())
        return IGCompetitorInsights(
            topic=topic,
            top_hooks=data.get("top_hooks", []),
            winning_formats=data.get("winning_formats", []),
            winning_tones=data.get("winning_tones", []),
            popular_hashtags=data.get("popular_hashtags", []),
            content_gaps=data.get("content_gaps", []),
            reel_ideas=data.get("reel_ideas", []),
            carousel_ideas=data.get("carousel_ideas", []),
            recommended_approach=data.get("recommended_approach", ""),
            raw_sources=[x.get("url","") for x in results[:8] if x.get("url")],
        )
    except Exception as e:
        logger.error(f"[IG Competitor] LLM extraction failed: {e}")
        return IGCompetitorInsights(
            topic=topic,
            recommended_approach=f"Use Reels with trending audio, 20-25 hashtags, for {topic} Indian audience.",
            raw_sources=[x.get("url","") for x in results[:5]],
        )


def analyze_ig_competitors(topic: str, enrich_hashtags: bool = True) -> IGCompetitorInsights:
    logger.info(f"[IG Competitor] Analyzing: '{topic}'")
    queries = _generate_queries(topic)
    results = search_multiple(queries, max_results_per_query=4)
    logger.info(f"[IG Competitor] {len(results)} results found")
    insights = _extract_insights(topic, results)

    if enrich_hashtags and len(insights.popular_hashtags) < 20:
        try:
            r = llm.invoke(
                f"""Generate 25 high-reach Instagram hashtags for "{topic}" targeting Indian audience.
Mix: 5 mega (#Motivation), 10 mid (#IndianCreator), 10 niche (#{topic.replace(' ','')}India).
Output ONLY a JSON array of strings with # prefix."""
            )
            extra = json.loads(_msg_text(r.content).strip().strip("```json").strip("```"))
            merged = list(dict.fromkeys(insights.popular_hashtags + extra))
            insights.popular_hashtags = merged[:30]
        except Exception:
            pass

    logger.info(f"[IG Competitor] Done. Hooks: {len(insights.top_hooks)}, Hashtags: {len(insights.popular_hashtags)}")
    return insights


# ── LangGraph Node ─────────────────────────────────────────────────────────────

def ig_competitor_node(state: Any) -> dict:
    topic = state.get("topic", "")
    logger.info(f"===== [NODE: ig_competitor] Topic: '{topic[:50]}'")
    try:
        ins = analyze_ig_competitors(topic)
        return {
            "competitor_insights": ins.to_dict(),
            "competitor_context":  ins.to_prompt_context(),
        }
    except Exception as e:
        logger.error(f"[NODE: ig_competitor] Failed: {e}")
        return {
            "competitor_insights": {},
            "competitor_context":  f"Competitor analysis unavailable for '{topic}'.",
        }


if __name__ == "__main__":
    import sys
    t = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else "fitness tips for Indian college students"
    print(analyze_ig_competitors(t).to_prompt_context())
