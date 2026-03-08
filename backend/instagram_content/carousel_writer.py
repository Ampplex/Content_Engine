"""
Instagram Carousel Writer.

Generates slide-by-slide carousel content optimized for saves.
Carousels are the highest-save format on Instagram — each slide
should be independently shareable and form a cohesive story.

Standalone: from carousel_writer import generate_carousel
LangGraph node: carousel_node(state)
"""

import json
import logging
from dataclasses import dataclass, field, asdict
from typing import Any

from bedrock_llm import ChatBedrockAPIKey
from config import BEDROCK_API_KEY, BEDROCK_MODEL_ID, AWS_REGION, LLM_TEMPERATURE, LLM_MAX_TOKENS

logger = logging.getLogger("carousel_writer")

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

CAROUSEL_STRUCTURES = {
    "Educational": {
        "template": "Problem → Why it matters → Solution steps → Key takeaway → CTA",
        "slides": 10,
        "hook_style": "Bold problem statement or surprising statistic",
    },
    "Listicle": {
        "template": "Hook → 7 items (1 per slide) → Summary → CTA",
        "slides": 10,
        "hook_style": "Number + promise (e.g. '7 things 99% of people get wrong about...')",
    },
    "Story": {
        "template": "Setup → Conflict → Rising action → Resolution → Lesson → CTA",
        "slides": 8,
        "hook_style": "Personal story opening or emotional hook",
    },
    "Tutorial": {
        "template": "What you'll learn → Step 1 → Step 2 → ... → Result → CTA",
        "slides": 10,
        "hook_style": "Before/After or outcome-first",
    },
    "Comparison": {
        "template": "Hook → Old way vs New way (3 comparisons) → Verdict → CTA",
        "slides": 8,
        "hook_style": "Controversial comparison or myth-busting",
    },
}


@dataclass
class CarouselSlide:
    slide_number:  int   = 1
    headline:      str   = ""    # main large text (under 8 words)
    body:          str   = ""    # supporting text (1-3 sentences)
    visual_note:   str   = ""    # design/visual direction
    emoji:         str   = ""    # 1-2 relevant emojis
    is_hook:       bool  = False
    is_cta:        bool  = False


@dataclass
class Carousel:
    topic:        str   = ""
    structure:    str   = "Educational"
    total_slides: int   = 10
    cover_text:   str   = ""     # slide 1 — must make them swipe
    slides:       list  = field(default_factory=list)   # list of CarouselSlide dicts
    caption:      str   = ""
    cta_text:     str   = ""
    save_hook:    str   = ""     # why they should save this

    def to_dict(self) -> dict:
        return asdict(self)


def generate_carousel(
    topic: str,
    structure: str = "Educational",
    language: str = "English",
    competitor_context: str = "",
    num_slides: int = 10,
) -> Carousel:
    """
    Generate a complete carousel with slide-by-slide content.

    Args:
        topic:              Post topic
        structure:          Educational / Listicle / Story / Tutorial / Comparison
        language:           English / Hindi / Hinglish
        competitor_context: Injected competitor intel
        num_slides:         Number of slides (8-12)

    Returns:
        Carousel dataclass with all slides
    """
    if structure not in CAROUSEL_STRUCTURES:
        structure = "Educational"

    struct_info = CAROUSEL_STRUCTURES[structure]
    num_slides  = max(6, min(num_slides, 12))

    lang_note = (
        f"Write slide content in {language}."
        if language != "English"
        else "Write in English with Hinglish phrases where it feels natural for Indian audience."
    )
    ctx_block = f"\n\nCompetitor Intel:\n{competitor_context}\n" if competitor_context else ""

    prompt = f"""You are an expert Instagram carousel creator for Indian millennials and Gen Z.

Create a {num_slides}-slide carousel about: "{topic}"
Structure: {structure} — {struct_info['template']}
Hook style: {struct_info['hook_style']}
{lang_note}
{ctx_block}

CAROUSEL RULES:
- Slide 1 (Cover): Must make them WANT to swipe. Strong hook, bold claim or curiosity gap.
- Middle slides: Each slide = ONE clear idea. Headline ≤ 8 words. Body 1-3 sentences.
- Last slide: Strong CTA — "save this", "share with someone who needs this", "follow for more"
- Every slide should work standalone as a shareable quote/tip
- Include design notes (color, layout hint) for each slide
- Caption: 125 visible chars + placeholder for hashtags

Output ONLY valid JSON:
{{
  "cover_text":  "slide 1 headline that makes them swipe",
  "save_hook":   "why they should save this carousel (1 line)",
  "caption":     "full caption (125 chars visible text, then [HASHTAGS])",
  "cta_text":    "final slide CTA text",
  "slides": [
    {{
      "slide_number": 1,
      "headline":     "text (≤8 words)",
      "body":         "supporting explanation (1-3 sentences)",
      "visual_note":  "design direction for this slide",
      "emoji":        "1-2 relevant emojis",
      "is_hook":      true,
      "is_cta":       false
    }}
  ]
}}"""

    try:
        r    = llm.invoke(prompt)
        data = json.loads(_msg_text(r.content).strip().strip("```json").strip("```").strip())

        slides = [
            CarouselSlide(
                slide_number=s.get("slide_number", i+1),
                headline=s.get("headline", ""),
                body=s.get("body", ""),
                visual_note=s.get("visual_note", ""),
                emoji=s.get("emoji", ""),
                is_hook=s.get("is_hook", False),
                is_cta=s.get("is_cta", False),
            ).__dict__
            for i, s in enumerate(data.get("slides", []))
        ]

        return Carousel(
            topic=topic, structure=structure, total_slides=len(slides),
            cover_text=data.get("cover_text", ""),
            slides=slides,
            caption=data.get("caption", ""),
            cta_text=data.get("cta_text", ""),
            save_hook=data.get("save_hook", ""),
        )

    except Exception as e:
        logger.error(f"[Carousel] Failed: {e}")
        return Carousel(
            topic=topic, structure=structure, total_slides=3,
            cover_text=f"Everything about {topic[:30]}",
            slides=[
                {"slide_number": 1, "headline": f"About {topic[:20]}", "body": "Key insights.",
                 "visual_note": "Bold text on colored bg", "emoji": "💡", "is_hook": True, "is_cta": False},
                {"slide_number": 2, "headline": "Key Takeaway", "body": "This is what matters most.",
                 "visual_note": "Clean white bg", "emoji": "✅", "is_hook": False, "is_cta": False},
                {"slide_number": 3, "headline": "Save for later!", "body": "Share with someone who needs this.",
                 "visual_note": "CTA slide", "emoji": "🔖", "is_hook": False, "is_cta": True},
            ],
            caption=f"{topic} — everything you need to know. Save this! [HASHTAGS]",
            cta_text="Save this carousel! 🔖",
            save_hook="You'll want to refer back to this",
        )


# ── LangGraph Node ─────────────────────────────────────────────────────────────

def carousel_node(state: Any) -> dict:
    topic  = state.get("topic", "")
    lang   = state.get("target_language", "English")
    struct = state.get("carousel_structure", "Educational")
    ctx    = state.get("competitor_context", "")
    logger.info(f"===== [NODE: carousel] Topic: '{topic[:50]}' | Structure: {struct}")
    try:
        c = generate_carousel(topic, struct, lang, ctx)
        return {"carousel": c.to_dict()}
    except Exception as e:
        logger.error(f"[NODE: carousel] Failed: {e}")
        return {"carousel": {}}


if __name__ == "__main__":
    import sys
    t = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else "10 habits that changed my life as an Indian startup founder"
    c = generate_carousel(t, structure="Listicle")
    print(f"Cover: {c.cover_text}")
    print(f"Slides: {c.total_slides}")
    for s in c.slides:
        print(f"  Slide {s['slide_number']}: {s['headline']} — {s['emoji']}")
    print(f"CTA: {c.cta_text}")
