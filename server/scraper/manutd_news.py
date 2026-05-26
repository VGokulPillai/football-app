"""Scrape FC Barcelona news from fcbarcelona.com RSS feed."""
import logging
from datetime import datetime
from typing import Any, Optional
import httpx
import xml.etree.ElementTree as ET

logger = logging.getLogger(__name__)

RSS_URL = "https://www.fcbarcelona.com/en/rss"
USER_AGENT = "FCBFootballIntelligence/1.0 (compatible; news aggregator)"

# Keywords to classify articles
TRANSFER_KEYWORDS = [
    "transfer", "sign", "signing", "deal", "target", "move", "rumour", "rumor",
    "bid", "contract", "extension", "depart", "arrival", "loan", "permanent",
]
MATCH_REPORT_KEYWORDS = [
    "match report", "report:", "result", "highlights", "full-time", "half-time",
    "reaction", "post-match", "match report from", "report, reaction",
]


def _get_text(el: Optional[ET.Element]) -> str:
    """Get element text, handling namespaced tags."""
    if el is None:
        return ""
    return (el.text or "").strip()


def _find_child(item: ET.Element, tag: str) -> Optional[ET.Element]:
    """Find direct child by tag name (with or without namespace)."""
    for child in item:
        if child.tag.endswith(tag) or child.tag == tag:
            return child
    return item.find(tag)


def _parse_rss_item(item: ET.Element) -> Optional[dict[str, Any]]:
    """Parse a single RSS item into a dict."""
    title_el = _find_child(item, "title")
    link_el = _find_child(item, "link")
    desc_el = _find_child(item, "description")
    date_el = _find_child(item, "pubDate")

    title = _get_text(title_el)
    link = _get_text(link_el)
    if not title or not link:
        return None

    description = _get_text(desc_el)
    pub_date = _get_text(date_el)

    date_str = ""
    if pub_date:
        try:
            dt = datetime.strptime(pub_date, "%a, %d %b %Y %H:%M:%S %Z")
            date_str = dt.strftime("%Y-%m-%dT%H:%M")
        except ValueError:
            date_str = pub_date[:16] if len(pub_date) >= 16 else pub_date

    return {
        "headline": title,
        "url": link,
        "excerpt": description,
        "date": date_str,
        "source": "fcbarcelona.com",
    }


def _classify_article(article: dict[str, Any]) -> str:
    """Classify as 'transfer', 'match_report', or 'news'."""
    text = f"{article.get('headline', '')} {article.get('excerpt', '')}".lower()
    title = article.get("headline", "").lower()

    for kw in TRANSFER_KEYWORDS:
        if kw in text:
            return "transfer"

    for kw in MATCH_REPORT_KEYWORDS:
        if kw in text or title.startswith("report:"):
            return "match_report"

    return "news"


async def fetch_fcb_news(limit: int = 30) -> list[dict[str, Any]]:
    """
    Fetch and parse news from fcbarcelona.com RSS feed.
    Returns list of articles with headline, url, excerpt, date, source, category.
    """
    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            r = await client.get(
                RSS_URL,
                headers={"User-Agent": USER_AGENT},
            )
            if r.status_code != 200:
                logger.warning("FCB RSS fetch failed: status %s", r.status_code)
                return []

            root = ET.fromstring(r.text)
            channel = root.find("channel")
            if channel is None:
                for child in root:
                    if "channel" in child.tag.lower():
                        channel = child
                        break
                if channel is None:
                    channel = root

            items = list(channel) if channel is not None else []
            items = [i for i in items if i.tag.endswith("item") or i.tag == "item"]
            articles = []
            for item in items:
                parsed = _parse_rss_item(item)
                if parsed:
                    parsed["category"] = _classify_article(parsed)
                    articles.append(parsed)
                    if len(articles) >= limit:
                        break

            return articles
    except Exception as e:
        logger.warning("FCB news scrape failed: %s", e)
        return []

# Keep backward-compatible alias
fetch_manutd_news = fetch_fcb_news


async def fetch_transfer_news(limit: int = 15) -> list[dict[str, Any]]:
    """Fetch transfer-related news from fcbarcelona.com."""
    all_news = await fetch_fcb_news(limit=50)
    return [a for a in all_news if a.get("category") == "transfer"][:limit]


async def fetch_match_reports(limit: int = 15) -> list[dict[str, Any]]:
    """Fetch match reports from fcbarcelona.com."""
    all_news = await fetch_fcb_news(limit=50)
    return [a for a in all_news if a.get("category") == "match_report"][:limit]


def format_news_for_rag(articles: list[dict[str, Any]], section: str) -> str:
    """Format scraped news for RAG context."""
    if not articles:
        return ""
    lines = [f"{section}:"]
    for a in articles[:15]:
        ex = a.get("excerpt", "")[:120]
        if len(a.get("excerpt", "")) > 120:
            ex += "..."
        lines.append(f"  - {a.get('headline', '?')}: {ex}")
    return "\n".join(lines)
