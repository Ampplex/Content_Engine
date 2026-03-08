"""
AWS Bedrock image generation for LinkedIn post visuals.

Uses Amazon Titan Image Generator v2 via AWS Bedrock boto3 InvokeModel (primary).
Falls back to Stability AI models if Titan fails.
Authenticates via standard AWS credentials (~/.aws/credentials or env vars).
Falls back to Pollinations.ai if all Bedrock generation fails.
"""

import os
import uuid
import json
import base64
import logging
from pathlib import Path
from urllib.parse import quote
from dotenv import load_dotenv

try:
    import boto3
except ModuleNotFoundError:
    boto3 = None

logger = logging.getLogger("image_gen")

# Ensure .env credentials are available even when this module is called directly.
load_dotenv(dotenv_path=Path(__file__).parent / ".env")

# ── Configuration ──────────────────────────────────────────────────────────
GENERATED_IMAGES_DIR = Path(__file__).parent / "generated_images"
GENERATED_IMAGES_DIR.mkdir(exist_ok=True)

AWS_REGION = os.getenv("AWS_REGION", "us-west-2")
AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")

# Model options: Amazon Titan v2 first (no marketplace needed), then Stability AI
MODELS = [
    {
        "id": "amazon.titan-image-generator-v2:0",
        "name": "Amazon Titan Image Generator v2",
        "payload_fn": lambda prompt: {
            "taskType": "TEXT_IMAGE",
            "textToImageParams": {
                "text": prompt,
            },
            "imageGenerationConfig": {
                "numberOfImages": 1,
                "height": 768,
                "width": 1280,
            },
        },
        "extract_fn": lambda data: data["images"][0],
    },
    {
        "id": "stability.stable-image-core-v1:1",
        "name": "Stable Image Core v1.1",
        "payload_fn": lambda prompt: {
            "prompt": prompt,
            "mode": "text-to-image",
            "aspect_ratio": "16:9",
            "output_format": "png",
        },
        "extract_fn": lambda data: data["images"][0],
    },
    {
        "id": "stability.sd3-5-large-v1:0",
        "name": "Stable Diffusion 3.5 Large",
        "payload_fn": lambda prompt: {
            "prompt": prompt,
            "mode": "text-to-image",
            "aspect_ratio": "16:9",
            "output_format": "png",
        },
        "extract_fn": lambda data: data["images"][0],
    },
    {
        "id": "stability.stable-image-ultra-v1:1",
        "name": "Stable Image Ultra v1.1",
        "payload_fn": lambda prompt: {
            "prompt": prompt,
            "mode": "text-to-image",
            "aspect_ratio": "16:9",
            "output_format": "png",
        },
        "extract_fn": lambda data: data["images"][0],
    },
]

def _normalize_prompt(prompt: str) -> str:
    """Normalize whitespace for model payloads."""
    return " ".join((prompt or "").split()).strip()

def _truncate_prompt(prompt: str, max_len: int) -> str:
    """Truncate prompt to provider max length while preserving whole words when possible."""
    prompt = _normalize_prompt(prompt)
    if len(prompt) <= max_len:
        return prompt
    cut = prompt[:max_len]
    last_space = cut.rfind(" ")
    if last_space > max_len * 0.7:
        cut = cut[:last_space]
    return cut.strip()


def generate_post_image(prompt: str) -> dict:
    """
    Generate an image using Stability AI on AWS Bedrock.

    Tries models in order: Stable Image Ultra → SD3 Large → SDXL 1.0.
    Uses standard AWS credentials (shared credentials file or env vars).

    Args:
        prompt: Descriptive prompt for image generation.

    Returns:
        dict with 'filename' and 'filepath' on success,
        or 'error' key on failure.
    """
    if boto3 is None:
        return {"error": "boto3 is not installed"}

    client_kwargs = {
        "service_name": "bedrock-runtime",
        "region_name": AWS_REGION,
    }
    if AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY:
        client_kwargs["aws_access_key_id"] = AWS_ACCESS_KEY_ID
        client_kwargs["aws_secret_access_key"] = AWS_SECRET_ACCESS_KEY

    bedrock = boto3.client(**client_kwargs)

    filename = f"{uuid.uuid4().hex}.png"
    filepath = GENERATED_IMAGES_DIR / filename

    last_error = None

    for model in MODELS:
        try:
            logger.info(f"Trying {model['name']} ({model['id']}) | Prompt: {prompt[:80]}...")

            # Titan enforces a strict 512-char limit for text prompt.
            model_prompt = _truncate_prompt(prompt, 512) if model["id"].startswith("amazon.titan-image-generator") else _normalize_prompt(prompt)
            payload = model["payload_fn"](model_prompt)

            response = bedrock.invoke_model(
                body=json.dumps(payload),
                modelId=model["id"],
                accept="application/json",
                contentType="application/json",
            )

            response_body = json.loads(response["body"].read())
            image_b64 = model["extract_fn"](response_body)

            # Decode and save
            image_bytes = base64.b64decode(image_b64)
            filepath.write_bytes(image_bytes)
            logger.info(f"Image saved: {filepath} ({len(image_bytes)} bytes) via {model['name']}")
            return {"filename": filename, "filepath": str(filepath)}

        except Exception as e:
            last_error = str(e)
            logger.warning(f"{model['name']} failed: {e}")
            continue

    logger.error(f"All Stability AI models failed. Last error: {last_error}")
    return {"error": last_error or "All models failed"}


def get_fallback_image_url(prompt: str) -> str:
    """Fallback to Pollinations.ai if Stability AI fails."""
    encoded = quote(_truncate_prompt(prompt, 600), safe="")
    return f"https://image.pollinations.ai/prompt/{encoded}?width=600&height=400&nologo=true"

if __name__ == "__main__":
    test_prompt = "A futuristic city skyline at sunset, vibrant colors, digital art"
    result = generate_post_image(test_prompt)
    if "error" in result:
        print(f"Image generation failed: {result['error']}")
        fallback_url = get_fallback_image_url(test_prompt)
        print(f"Fallback image URL: {fallback_url}")
    else:
        print(f"Image generated successfully: {result['filepath']}")
