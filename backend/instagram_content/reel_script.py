"""
Instagram Reel Script Generator.

Generates structured reel scripts in 15 / 30 / 60 second formats.
Each script has: hook frame, voiceover sections, on-screen text,
B-roll suggestions, and CTA.

Standalone: from reel_script import generate_reel_script
LangGraph node: reel_script_node(state)
"""

import json
import logging
from dataclasses import dataclass, field, asdict
from typing import Any

from bedrock_llm import ChatBedrockAPIKey
from config import BEDROCK_API_KEY, BEDROCK_MODEL_ID, AWS_REGION, LLM_TEMPERATURE, LLM_MAX_TOKENS

logger = logging.getLogger("reel_script")

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

REEL_DURATIONS = [15, 30, 60]
REEL_TONES = ["Educational", "Motivational", "Funny", "Emotional", "Storytelling"]


@dataclass
class ReelSegment:
    timestamp:   str   = ""    # e.g. "0:00 - 0:03"
    voiceover:   str   = ""    # what to say
    on_screen:   str   = ""    # text overlay on screen
    broll:       str   = ""    # visual suggestion
    energy:      str   = ""    # Low / Medium / High


@dataclass
class ReelScript:
    topic:        str            = ""
    duration_sec: int            = 30
    tone:         str            = "Educational"
    hook_frame:   str            = ""    # first 2-3 sec visual/text
    hook_text:    str            = ""    # on-screen text for hook
    segments:     list           = field(default_factory=list)   # list of ReelSegment dicts
    cta:          str            = ""    # call-to-action last 3 sec
    caption:      str            = ""    # full Instagram caption
    music_vibe:   str            = ""    # music suggestion
    total_words:  int            = 0     # estimated voiceover word count

    def to_dict(self) -> dict:
        return asdict(self)


def generate_reel_script(
    topic: str,
    duration_sec: int = 30,
    tone: str = "Educational",
    language: str = "English",
    competitor_context: str = "",
) -> ReelScript:
    """
    Generate a complete Reel script for a given topic.

    Args:
        topic:              What the reel is about
        duration_sec:       15, 30, or 60 seconds
        tone:               Educational / Motivational / Funny / Emotional / Storytelling
        language:           English / Hindi / Hinglish
        competitor_context: Injected competitor intel from pipeline

    Returns:
        ReelScript dataclass with all sections
    """
    duration_sec = min([15, 30, 60], key=lambda x: abs(x - duration_sec))
    words_per_sec = 2.5   # average spoken words per second

    # Duration-specific structure
    structures = {
        15: "Hook (0-3s) → 2 Quick Points (3-12s) → CTA (12-15s)",
        30: "Hook (0-3s) → Problem (3-8s) → 3 Points (8-24s) → CTA (24-30s)",
        60: "Hook (0-4s) → Problem (4-10s) → Solution intro (10-20s) → 3-4 Detailed Points (20-50s) → CTA (50-60s)",
    }

    lang_note = f"Write the voiceover in {language}." if language != "English" else "Write in English with occasional Hinglish phrases for Indian relatability."
    ctx_block = f"\n\nCompetitor Intel:\n{competitor_context}\n" if competitor_context else ""

    prompt = f"""You are an expert Instagram Reel scriptwriter for Indian Gen Z and millennial audience.

Create a complete {duration_sec}-second Reel script about: "{topic}"
Tone: {tone}
Structure: {structures[duration_sec]}
{lang_note}
{ctx_block}

Rules:
- Hook MUST be provocative, surprising, or scroll-stopping in the first 2 seconds
- Voiceover: conversational, fast-paced, relatable to Indian youth
- On-screen text: 3-5 words max per frame, bold and punchy
- B-roll: specific visual suggestions (not generic)
- Music: suggest a specific vibe (not song name) e.g. "upbeat lo-fi beats", "dramatic build-up"
- CTA: specific action — "save this", "comment your answer", "share with a friend who needs this"
- Total estimated words: ~{int(duration_sec * words_per_sec)}

Output ONLY valid JSON:
{{
  "hook_frame":   "visual description of first 2-3 seconds",
  "hook_text":    "on-screen text for the hook (under 6 words)",
  "segments": [
    {{
      "timestamp":  "0:00 - 0:03",
      "voiceover":  "exact words to say",
      "on_screen":  "text overlay (3-5 words)",
      "broll":      "specific visual to show",
      "energy":     "High"
    }}
  ],
  "cta":          "exact call-to-action text (voiceover + on-screen)",
  "caption":      "full Instagram caption (125 chars visible + hashtag placeholder)",
  "music_vibe":   "music energy description",
  "total_words":  {int(duration_sec * words_per_sec)}
}}"""

    try:
        r    = llm.invoke(prompt)
        data = json.loads(_msg_text(r.content).strip().strip("```json").strip("```").strip())

        segments = [
            ReelSegment(
                timestamp=s.get("timestamp", ""),
                voiceover=s.get("voiceover", ""),
                on_screen=s.get("on_screen", ""),
                broll=s.get("broll", ""),
                energy=s.get("energy", "Medium"),
            ).__dict__
            for s in data.get("segments", [])
        ]

        return ReelScript(
            topic=topic,
            duration_sec=duration_sec,
            tone=tone,
            hook_frame=data.get("hook_frame", ""),
            hook_text=data.get("hook_text", ""),
            segments=segments,
            cta=data.get("cta", ""),
            caption=data.get("caption", ""),
            music_vibe=data.get("music_vibe", ""),
            total_words=data.get("total_words", int(duration_sec * words_per_sec)),
        )

    except Exception as e:
        logger.error(f"[ReelScript] Failed: {e}")
        return ReelScript(
            topic=topic, duration_sec=duration_sec, tone=tone,
            hook_frame="Close-up of text on screen",
            hook_text=f"You NEED to know this about {topic[:20]}",
            segments=[{
                "timestamp": "0:00 - 0:30",
                "voiceover": f"Here's everything you need to know about {topic}.",
                "on_screen": "Key Tips", "broll": "Person speaking to camera", "energy": "Medium",
            }],
            cta="Save this for later! 📌",
            caption=f"Everything about {topic} in {duration_sec} seconds! 🔥",
            music_vibe="Upbeat background music",
            total_words=int(duration_sec * words_per_sec),
        )


# ── LangGraph Node ─────────────────────────────────────────────────────────────

def reel_script_node(state: Any) -> dict:
    topic   = state.get("topic", "")
    lang    = state.get("target_language", "English")
    tone    = state.get("selected_tone", "Educational")
    dur     = state.get("reel_duration", 30)
    ctx     = state.get("competitor_context", "")
    logger.info(f"===== [NODE: reel_script] Topic: '{topic[:50]}' | {dur}s | {tone}")
    try:
        script = generate_reel_script(topic, dur, tone, lang, ctx)
        return {"reel_script": script.to_dict()}
    except Exception as e:
        logger.error(f"[NODE: reel_script] Failed: {e}")
        return {"reel_script": {}}


if __name__ == "__main__":
    import sys
    t = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else "5 money habits every Indian 20-something should build"
    for dur in [15, 30, 60]:
        s = generate_reel_script(t, duration_sec=dur)
        print(f"\n{'='*50}")
        print(f"  {dur}s Reel — Hook: {s.hook_text}")
        print(f"  Segments: {len(s.segments)}")
        print(f"  CTA: {s.cta}")
