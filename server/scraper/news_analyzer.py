"""Use GPT to extract structured insights (injuries, transfers) from scraped news."""
import json
import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


async def analyze_news_with_gpt(articles: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Use OpenAI GPT to extract injuries, transfers in, transfers out from news.
    Returns structured dict with injuries, transfers_in, transfers_out, summary.
    """
    try:
        from server.llm import has_gpt_fallback, chat_completion_openai
    except ImportError:
        return _empty_insights()

    if not has_gpt_fallback():
        return _empty_insights()

    if not articles:
        return _empty_insights()

    # Build news text for GPT
    news_text = "\n\n".join(
        f"- {a.get('headline', '')}: {a.get('excerpt', '')}"
        for a in articles[:25]
    )

    prompt = f"""Analyze these FC Barcelona news headlines and excerpts. Extract structured information.

NEWS:
{news_text}

Return a JSON object with these keys (use empty arrays if none found):
- "injuries": list of {{"player": str, "reason": str, "source_headline": str}} for any injury mentions
- "transfers_in": list of {{"player": str, "from_club": str, "source_headline": str}} for signings/arrivals
- "transfers_out": list of {{"player": str, "to_club": str, "source_headline": str}} for departures/loans out
- "summary": 2-3 sentence summary of key news (injuries, transfers, match results)

Return ONLY valid JSON, no markdown or extra text."""

    try:
        response = await chat_completion_openai(
            messages=[{"role": "user", "content": prompt}],
            model="gpt-4o-mini",
            max_tokens=1024,
            temperature=0.2,
        )
        if not response:
            return _empty_insights()

        # Parse JSON from response (handle markdown code blocks)
        text = response.strip()
        if "```" in text:
            start = text.find("{")
            end = text.rfind("}") + 1
            if start >= 0 and end > start:
                text = text[start:end]
        data = json.loads(text)

        return {
            "injuries": data.get("injuries", []) or [],
            "transfers_in": data.get("transfers_in", []) or [],
            "transfers_out": data.get("transfers_out", []) or [],
            "summary": data.get("summary", "") or "",
        }
    except json.JSONDecodeError as e:
        logger.warning("GPT news analysis JSON parse failed: %s", e)
        return _empty_insights()
    except Exception as e:
        logger.warning("GPT news analysis failed: %s", e)
        return _empty_insights()


def _empty_insights() -> Dict[str, Any]:
    return {
        "injuries": [],
        "transfers_in": [],
        "transfers_out": [],
        "summary": "",
    }


def format_insights_for_rag(insights: Dict[str, Any]) -> str:
    """Format GPT-extracted insights for RAG context."""
    parts = []
    if insights.get("injuries"):
        parts.append("Injuries mentioned in recent news:")
        for i in insights["injuries"]:
            parts.append(f"  - {i.get('player', '?')}: {i.get('reason', '?')} (from: {i.get('source_headline', '')[:50]}...)")
    if insights.get("transfers_in"):
        parts.append("Transfers in (from news):")
        for t in insights["transfers_in"]:
            parts.append(f"  - {t.get('player', '?')} from {t.get('from_club', '?')}")
    if insights.get("transfers_out"):
        parts.append("Transfers out (from news):")
        for t in insights["transfers_out"]:
            parts.append(f"  - {t.get('player', '?')} to {t.get('to_club', '?')}")
    if insights.get("summary"):
        parts.append(f"News summary: {insights['summary']}")
    return "\n".join(parts) if parts else ""
