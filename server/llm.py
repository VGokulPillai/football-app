"""LLM client for AI Copilot and recommendation generation."""
import logging
import os
from openai import AsyncOpenAI
from server.config import get_oauth_token, get_workspace_host, IS_DATABRICKS_APP

logger = logging.getLogger(__name__)

# OpenAI via Databricks External Model (preferred) - endpoint name in your workspace
GPT_FALLBACK_ENDPOINT = os.environ.get("GPT_FALLBACK_ENDPOINT", "")
# Direct OpenAI API key (fallback when no Databricks external model)
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")


def get_llm_client() -> AsyncOpenAI:
    """Get OpenAI-compatible client for Databricks Model Serving."""
    host = get_workspace_host()
    if IS_DATABRICKS_APP:
        token = os.environ.get("DATABRICKS_TOKEN") or get_oauth_token()
    else:
        token = get_oauth_token()

    return AsyncOpenAI(
        api_key=token,
        base_url=f"{host}/serving-endpoints",
    )


async def chat_completion_openai(
    messages: list,
    model: str = "gpt-4o-mini",
    max_tokens: int = 4096,
    temperature: float = 0.7,
) -> str:
    """Get chat completion from OpenAI GPT (direct API or via Databricks external model)."""
    # Prefer Databricks external model (OpenAI via platform - keys in secrets)
    if GPT_FALLBACK_ENDPOINT:
        try:
            client = get_llm_client()
            response = await client.chat.completions.create(
                model=GPT_FALLBACK_ENDPOINT,
                messages=messages,
                max_tokens=max_tokens,
                temperature=temperature,
            )
            return response.choices[0].message.content or ""
        except Exception as e:
            logger.warning("Databricks OpenAI external model failed: %s", e)
            if not OPENAI_API_KEY:
                raise

    # Fallback to direct OpenAI API
    if not OPENAI_API_KEY:
        raise ValueError("Neither GPT_FALLBACK_ENDPOINT nor OPENAI_API_KEY set")
    client = AsyncOpenAI(api_key=OPENAI_API_KEY)
    response = await client.chat.completions.create(
        model=model,
        messages=messages,
        max_tokens=max_tokens,
        temperature=temperature,
    )
    return response.choices[0].message.content or ""


def has_gpt_fallback() -> bool:
    """Check if GPT fallback is available (Databricks external model or direct OpenAI)."""
    return bool(GPT_FALLBACK_ENDPOINT or OPENAI_API_KEY)


async def chat_completion(
    messages: list,
    model: str = "databricks-claude-sonnet-4-5",
    max_tokens: int = 4096,
    temperature: float = 0.7,
) -> str:
    """Get chat completion from Foundation Model, with OpenAI GPT fallback via Databricks or direct API."""
    try:
        client = get_llm_client()
        response = await client.chat.completions.create(
            model=model,
            messages=messages,
            max_tokens=max_tokens,
            temperature=temperature,
        )
        return response.choices[0].message.content or ""
    except Exception as e:
        logger.warning("Databricks LLM failed: %s, trying GPT fallback", e)
        if has_gpt_fallback():
            try:
                return await chat_completion_openai(
                    messages, model="gpt-4o-mini", max_tokens=max_tokens, temperature=temperature
                )
            except Exception as e2:
                logger.warning("GPT fallback failed: %s", e2)
        return f"AI assistant unavailable: {str(e)}"
