import logging
from typing import Any

import anthropic

from app.core.config import settings

logger = logging.getLogger(__name__)

_client: anthropic.Anthropic | None = None


class ClaudeUnavailable(Exception):
    pass


def enabled() -> bool:
    return bool(settings.ANTHROPIC_API_KEY)


def _get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        _client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY, timeout=120, max_retries=2)
    return _client


def structured(
    system: str,
    prompt: str,
    tool_name: str,
    tool_description: str,
    schema: dict[str, Any],
    max_tokens: int = 4000,
) -> dict[str, Any]:
    """Call Claude and force a JSON response matching `schema` via a tool call."""
    if not enabled():
        raise ClaudeUnavailable("Claude API key is not configured (ANTHROPIC_API_KEY).")
    response = _get_client().messages.create(
        model=settings.CLAUDE_MODEL,
        max_tokens=max_tokens,
        system=system,
        messages=[{"role": "user", "content": prompt}],
        tools=[{"name": tool_name, "description": tool_description, "input_schema": schema}],
        tool_choice={"type": "tool", "name": tool_name},
    )
    for block in response.content:
        if block.type == "tool_use":
            return block.input
    raise RuntimeError("Claude did not return a structured result.")


def clip(text: str, limit: int) -> str:
    text = text or ""
    return text if len(text) <= limit else text[:limit] + "\n...[truncated]"
