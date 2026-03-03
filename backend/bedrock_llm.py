"""
Custom LangChain chat model for AWS Bedrock via API Key (ABSK).

Uses the Bedrock runtime InvokeModel endpoint with Bearer token auth.
Compatible with Mistral Large 2 (and any model exposing OpenAI-compatible chat format).
"""

import json
import logging
import requests
from typing import Any, List, Optional
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
from langchain_core.outputs import ChatGeneration, ChatResult

logger = logging.getLogger("bedrock_llm")


class ChatBedrockAPIKey(BaseChatModel):
    """LangChain chat model that calls AWS Bedrock via long-lived API Key."""

    api_key: str
    model_id: str
    region: str = "us-west-2"
    temperature: float = 0.7
    max_tokens: int = 4096

    @property
    def _llm_type(self) -> str:
        return "bedrock-api-key"

    @property
    def _endpoint(self) -> str:
        return (
            f"https://bedrock-runtime.{self.region}.amazonaws.com"
            f"/model/{self.model_id}/invoke"
        )

    def _convert_messages(self, messages: List[BaseMessage]) -> List[dict]:
        """Convert LangChain messages to OpenAI-compatible format."""
        result = []
        for msg in messages:
            if isinstance(msg, SystemMessage):
                result.append({"role": "system", "content": msg.content})
            elif isinstance(msg, HumanMessage):
                result.append({"role": "user", "content": msg.content})
            elif isinstance(msg, AIMessage):
                result.append({"role": "assistant", "content": msg.content})
            else:
                result.append({"role": "user", "content": msg.content})
        return result

    def _generate(
        self,
        messages: List[BaseMessage],
        stop: Optional[List[str]] = None,
        **kwargs: Any,
    ) -> ChatResult:
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}",
        }

        body = {
            "messages": self._convert_messages(messages),
            "max_tokens": kwargs.get("max_tokens", self.max_tokens),
            "temperature": kwargs.get("temperature", self.temperature),
        }
        if stop:
            body["stop"] = stop

        response = requests.post(
            self._endpoint,
            headers=headers,
            data=json.dumps(body),
            timeout=120,
        )
        response.raise_for_status()
        data = response.json()

        content = data["choices"][0]["message"]["content"]
        # Strip leading </s> tokens that Mistral sometimes emits
        if content.startswith("</s>"):
            content = content[4:].lstrip()

        usage = data.get("usage", {})
        return ChatResult(
            generations=[
                ChatGeneration(
                    message=AIMessage(content=content),
                    generation_info={
                        "finish_reason": data["choices"][0].get("finish_reason"),
                        "usage": usage,
                    },
                )
            ],
            llm_output={
                "model": data.get("model", self.model_id),
                "token_usage": usage,
            },
        )
