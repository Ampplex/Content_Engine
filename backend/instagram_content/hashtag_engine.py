"""
Instagram Hashtag Engine.

Generates an optimal 20-30 hashtag set for any topic/niche using
a tiered strategy: mega + mid + niche hashtags in the right ratio.

Standalone: from hashtag_engine import generate_hashtags
LangGraph node: hashtag_node(state)
"""

import json
import logging
import re
from typing import Any, Optional

from bedrock_llm import ChatBedrockAPIKey
from config import BEDROCK_API_KEY, BEDROCK_MODEL_ID, AWS_REGION, LLM_TEMPERATURE, LLM_MAX_TOKENS

logger = logging.getLogger("hashtag_engine")

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

# ── Tier Strategy ──────────────────────────────────────────────────────────────
# Mega (>1M posts):   3-5 — discovery reach
# Mid  (100K-1M):     8-12 — targeted reach
# Niche (<100K):      8-12 — ranking reach (most important for engagement)
# Location:           2-3  — Indian audience targeting

BANNED_HASHTAGS = {
    "#follow4follow", "#like4like", "#likeforlike", "#followforfollow",
    "#spamforspam", "#instadaily", "#photooftheday", "#instagood",
}

MEGA_BASE = [
    "#India", "#Indian", "#Motivation", "#Inspiration", "#Success",
    "#Entrepreneurship", "#Business", "#Growth", "#Learning", "#Life",
]

LOCATION_TAGS = [
    "#IndiaInsta", "#IndianCreator", "#IndiaContent", "#BharatCreator",
    "#MumbaiCreator", "#DelhiCreator", "#BangaloreCreator", "#HyderabadCreator",
]


def _clean_tag(tag: str) -> str:
    tag = tag.strip()
    if not tag.startswith("#"):
        tag = "#" + tag
    tag = re.sub(r"[^\w#]", "", tag)
    return tag if len(tag) > 1 else ""


def generate_hashtags(
    topic: str,
    format_type: str = "Reel",
    tone: str = "Educational",
    count: int = 25,
    existing: Optional[list[str]] = None,
) -> dict:
    """
    Generate a tiered hashtag set for a given topic.

    Returns:
        {
            "mega":     [...],   # 3-5 broad hashtags
            "mid":      [...],   # 8-10 medium hashtags
            "niche":    [...],   # 8-10 niche hashtags
            "location": [...],   # 2-3 India-specific
            "all":      [...],   # full ordered list (25-30)
            "caption_block": str # ready-to-paste hashtag block
        }
    """
    existing_ctx = ""
    if existing:
        existing_ctx = f"\nAlready suggested (avoid duplicates): {', '.join(existing[:10])}"

    prompt = f"""You are an Instagram hashtag strategist for the Indian market.

Generate an optimal Instagram hashtag set for:
- Topic: "{topic}"
- Format: {format_type}
- Tone: {tone}
- Target: Indian millennials and Gen Z
{existing_ctx}

Strategy:
- MEGA (>1M posts): 4 hashtags — broad discoverability
- MID (100K-1M posts): 10 hashtags — targeted reach  
- NICHE (<100K posts): 10 hashtags — highest chance of ranking
- LOCATION: 3 hashtags — India-specific audience

Rules:
- All hashtags must be relevant to "{topic}"
- Mix English + Hinglish hashtags (e.g. #IndianEntrepreneur, #DesiHustle)
- No banned/shadowbanned tags
- Total: exactly 27 unique hashtags

Output ONLY valid JSON:
{{
  "mega":     ["#tag1", "#tag2", "#tag3", "#tag4"],
  "mid":      ["#tag1", ... 10 tags],
  "niche":    ["#tag1", ... 10 tags],
  "location": ["#IndiaInsta", "#IndianCreator", "#tag3"]
}}"""

    try:
        r    = llm.invoke(prompt)
        data = json.loads(_msg_text(r.content).strip().strip("```json").strip("```").strip())

        mega     = [_clean_tag(t) for t in data.get("mega", []) if _clean_tag(t) not in BANNED_HASHTAGS][:5]
        mid      = [_clean_tag(t) for t in data.get("mid", [])  if _clean_tag(t) not in BANNED_HASHTAGS][:12]
        niche    = [_clean_tag(t) for t in data.get("niche", []) if _clean_tag(t) not in BANNED_HASHTAGS][:12]
        location = [_clean_tag(t) for t in data.get("location", []) if _clean_tag(t) not in BANNED_HASHTAGS][:3]

        # deduplicate while preserving order
        seen, all_tags = set(), []
        for tag in mega + mid + niche + location:
            if tag and tag not in seen:
                seen.add(tag)
                all_tags.append(tag)

        all_tags = all_tags[:30]

        return {
            "mega":          mega,
            "mid":           mid,
            "niche":         niche,
            "location":      location,
            "all":           all_tags,
            "total":         len(all_tags),
            "caption_block": "\n\n" + " ".join(all_tags),
        }

    except Exception as e:
        logger.error(f"[Hashtag] Generation failed: {e}")
        # Fallback — generic Indian content hashtags
        fallback = [f"#{w.replace(' ','')}" for w in topic.split()[:3]]
        fallback += MEGA_BASE[:5] + LOCATION_TAGS[:3]
        fallback = list(dict.fromkeys(fallback))[:25]
        return {
            "mega": fallback[:4], "mid": fallback[4:14],
            "niche": fallback[14:24], "location": fallback[24:27],
            "all": fallback, "total": len(fallback),
            "caption_block": "\n\n" + " ".join(fallback),
        }


# ── LangGraph Node ─────────────────────────────────────────────────────────────

def hashtag_node(state: Any) -> dict:
    topic  = state.get("topic", "")
        
    fmt    = state.get("selected_format", "Reel")
    tone   = state.get("selected_tone", "Educational")
    logger.info(f"===== [NODE: hashtags] Topic: '{topic[:50]}' | Format: {fmt} | Tone: {tone}")
    try:
        result = generate_hashtags(topic, format_type=fmt, tone=tone)
        return {"hashtags": result}
    except Exception as e:
        logger.error(f"[NODE: hashtags] Failed: {e}")
        return {"hashtags": {"all": [], "caption_block": ""}}


if __name__ == "__main__":
    import sys
    t = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else "fitness tips for college students India"
    result = generate_hashtags(t)
    print(f"Total: {result['total']} hashtags")
    print(f"Mega: {result['mega']}")
    print(f"Caption block:\n{result['caption_block']}")
