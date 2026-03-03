import os
from dotenv import load_dotenv

load_dotenv()

# ─── AWS Bedrock Configuration (API Key + Mistral Large 2) ──────────────────────
BEDROCK_API_KEY = os.getenv("BEDROCK_API_KEY")
AWS_REGION = os.getenv("AWS_REGION", "us-west-2")
BEDROCK_MODEL_ID = os.getenv("BEDROCK_MODEL_ID", "mistral.mistral-large-2407-v1:0")
LLM_TEMPERATURE = float(os.getenv("LLM_TEMPERATURE", "0.7"))
LLM_MAX_TOKENS = int(os.getenv("LLM_MAX_TOKENS", "4096"))

# ─── API Configuration ────────────────────────────────────────────────────────
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*").split(",")
API_HOST = os.getenv("API_HOST", "0.0.0.0")
API_PORT = int(os.getenv("API_PORT", "8000"))
