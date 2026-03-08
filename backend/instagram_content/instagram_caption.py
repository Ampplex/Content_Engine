"""
Instagram Caption Drafter.

Generates punchy, engagement-optimized Instagram captions.
Different rules apply per format: Reel captions are short & punchy,
Carousel captions tease the swipe, Static captions tell a mini-story.

Standalone: from instagram_caption import draft_caption
LangGraph node: caption_node(state)
"""

import re
import json
import logging
from typing import Any

from bedrock_llm import ChatBedrockAPIKey
from config import BEDROCK_API_KEY, BEDROCK_MODEL_ID, AWS_REGION, LLM_TEMPERATURE, LLM_MAX_TOKENS

logger = logging.getLogger("instagram_caption")

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

FORMAT_RULES = {
    "Reel": {
        "visible_chars": 125,
        "style": "Hook in first line (under 8 words). Then 2-3 short punchy sentences. End with a question or CTA.",
        "length": "Short (100-200 chars visible)",
    },
    "Carousel": {
        "visible_chars": 125,
        "style": "Tease what's inside: 'Slide 3 will surprise you' or 'Save before it gets too real'. Hook + intrigue.",
        "length": "Medium (150-300 chars visible)",
    },
    "Static": {
        "visible_chars": 125,
        "style": "Tell a mini-story or share a specific insight. More text is okay — make every sentence count.",
        "length": "Medium-long (200-400 chars visible)",
    },
    "Story": {
        "visible_chars": 125,
        "style": "Short and direct. Stories are temporary, caption should complement the visual.",
        "length": "Very short (under 100 chars)",
    },
}

AB_VARIANT_STYLES = [
    {
        "label": "Emotional Hook",
        "guide": "Start with a personal/vulnerable statement. Make them feel something before reading.",
    },
    {
        "label": "Controversial Take",
        "guide": "Start with a bold or slightly controversial opinion. Provoke a response.",
    },
    {
        "label": "Data-Led",
        "guide": "Start with a specific number or surprising statistic. Build authority.",
    },
]


def draft_caption(
    topic: str,
    format_type: str = "Reel",
    tone: str = "Educational",
    language: str = "English",
    hook: str = "",
    competitor_context: str = "",
    trend_insights: str = "",
) -> dict:
    """
    Generate an Instagram caption + 2 A/B variant captions.

    Returns:
        {
            "main_caption": str,
            "first_line":   str,    # the all-important first line
            "ab_variants": [{"label": str, "caption": str}, ...],
            "char_count":   int,
            "word_count":   int,
        }
    """
    rules    = FORMAT_RULES.get(format_type, FORMAT_RULES["Reel"])
    lang_note = (
        f"Write the caption in {language}."
        if language != "English"
        else "Write in English with Hinglish flavour for Indian relatability."
    )
    hook_note = f'\nUse this as the opening hook: "{hook}"' if hook else ""
    ctx_block = f"\nCompetitor context:\n{competitor_context[:500]}\n" if competitor_context else ""
    trend_block = f"\nTrend insights: {trend_insights[:300]}\n" if trend_insights else ""

    prompt = f"""You are an expert Instagram caption writer for Indian millennials and Gen Z.

Write a {format_type} caption about: "{topic}"
Tone: {tone}
Style: {rules['style']}
Length: {rules['length']} (first {rules['visible_chars']} chars shown before "more")
{lang_note}
{hook_note}
{ctx_block}{trend_block}

Rules:
- First line = the hook (shown before "more" button) — MUST stop the scroll
- Use line breaks for readability
- 1-2 emojis max in the caption body (hashtags added separately)
- End with a question, CTA, or emotional close
- NO hashtags in the caption (they go below the caption_block separator)
- Write ONLY the caption text, no meta-labels

Also generate 2 A/B variant captions using these styles:
  Variant A — {AB_VARIANT_STYLES[0]['guide']}
  Variant B — {AB_VARIANT_STYLES[1]['guide']}

Output ONLY valid JSON:
{{
  "main_caption": "full caption text",
  "first_line":   "just the first line/hook",
  "variant_a":    "A/B variant A caption",
  "variant_b":    "A/B variant B caption"
}}"""

    try:
        r    = llm.invoke(prompt)
        data = json.loads(_msg_text(r.content).strip().strip("```json").strip("```").strip())

        main = data.get("main_caption", f"Here's everything about {topic} 🔥")
        # Strip any accidental hashtags from caption body
        main = re.sub(r'#\w+', '', main).strip()

        return {
            "main_caption": main,
            "first_line":   data.get("first_line", main.split("\n")[0]),
            "ab_variants": [
                {"label": AB_VARIANT_STYLES[0]["label"], "caption": re.sub(r'#\w+', '', data.get("variant_a", main)).strip()},
                {"label": AB_VARIANT_STYLES[1]["label"], "caption": re.sub(r'#\w+', '', data.get("variant_b", main)).strip()},
            ],
            "char_count": len(main),
            "word_count":  len(main.split()),
        }

    except Exception as e:
        logger.error(f"[Caption] Failed: {e}")
        fallback = f"Here's what you need to know about {topic} 🔥\n\nSave this for later!"
        return {
            "main_caption": fallback,
            "first_line":   fallback.split("\n")[0],
            "ab_variants": [
                {"label": AB_VARIANT_STYLES[0]["label"], "caption": fallback},
                {"label": AB_VARIANT_STYLES[1]["label"], "caption": fallback},
            ],
            "char_count": len(fallback),
            "word_count":  len(fallback.split()),
        }


# ── LangGraph Node ─────────────────────────────────────────────────────────────

def caption_node(state: Any) -> dict:
    topic   = state.get("topic", "")
    fmt     = state.get("selected_format", "Reel")
    tone    = state.get("selected_tone", "Educational")
    lang    = state.get("target_language", "English")
    hook    = state.get("hook", "")
    ctx     = state.get("competitor_context", "")
    trends  = state.get("trend_insights", "")
    logger.info(f"===== [NODE: caption] Topic: '{topic[:50]}' | Format: {fmt} | Tone: {tone}")
    try:
        result = draft_caption(topic, fmt, tone, lang, hook, ctx, trends)
        return {
            "caption":     result["main_caption"],
            "first_line":  result["first_line"],
            "ab_captions": result["ab_variants"],
        }
    except Exception as e:
        logger.error(f"[NODE: caption] Failed: {e}")
        return {"caption": "", "first_line": "", "ab_captions": []}


if __name__ == "__main__":
    import sys
    t = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else "5 money habits every Indian 20-something needs"
    for fmt in ["Reel", "Carousel", "Static"]:
        result = draft_caption(t, format_type=fmt)
        print(f"\n{'='*40} {fmt}")
        print(f"First line: {result['first_line']}")
        print(f"Main ({result['char_count']} chars):\n{result['main_caption']}")
