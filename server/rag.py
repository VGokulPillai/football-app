"""RAG service - builds context from fresh API-Football data for Copilot."""
import os
import time
import logging
from typing import Optional
import httpx

logger = logging.getLogger(__name__)

API_FOOTBALL_BASE = "https://v3.football.api-sports.io"
FCB_ID = 529
LA_LIGA_ID = 140
from datetime import datetime

_now = datetime.now()
SEASON = _now.year if _now.month >= 8 else _now.year - 1  # Aug–Jul

_rag_cache: dict[str, tuple[float, dict]] = {}
_RAG_CACHE_TTL = 300


def _get_headers() -> dict:
    key = os.environ.get("API_FOOTBALL_KEY", "")
    return {"x-apisports-key": key} if key else {}


async def _fetch(endpoint: str, params: Optional[dict] = None) -> dict:
    if not _get_headers():
        return {}

    cache_key = f"{endpoint}|{sorted((params or {}).items())}"
    now = time.time()
    if cache_key in _rag_cache:
        ts, data = _rag_cache[cache_key]
        if now - ts < _RAG_CACHE_TTL:
            return data

    url = f"{API_FOOTBALL_BASE}/{endpoint}"
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.get(url, headers=_get_headers(), params=params or {})
            if r.status_code == 429:
                logger.warning("RAG: API-Football 429 on %s — using cache", endpoint)
                if cache_key in _rag_cache:
                    return _rag_cache[cache_key][1]
                return {}
            if r.status_code == 200:
                data = r.json()
                result = data.get("response", data)
                _rag_cache[cache_key] = (now, result)
                return result
    except Exception as e:
        logger.warning("API-Football fetch failed: %s", e)
        if cache_key in _rag_cache:
            return _rag_cache[cache_key][1]
    return {}


def _format_squad(data: list) -> str:
    if not data or not isinstance(data, list):
        return ""
    team_data = data[0] if data else {}
    team = team_data.get("team", {})
    players = team_data.get("players", [])
    lines = [f"FC Barcelona squad ({team.get('name', 'FC Barcelona')}):"]
    by_pos: dict[str, list] = {}
    for p in players:
        pos = p.get("position", "Other")
        by_pos.setdefault(pos, []).append(p.get("name", "?"))
    for pos, names in sorted(by_pos.items()):
        lines.append(f"  {pos}: {', '.join(names[:8])}{'...' if len(names) > 8 else ''}")
    return "\n".join(lines)


def _format_fixtures(data: list) -> str:
    if not data or not isinstance(data, list):
        return ""
    lines = ["Upcoming fixtures:"]
    for f in data[:10]:
        teams = f.get("teams", {})
        home = teams.get("home", {}).get("name", "?")
        away = teams.get("away", {}).get("name", "?")
        date = f.get("fixture", {}).get("date", "")[:10]
        league = f.get("league", {}).get("name", "")
        lines.append(f"  {home} vs {away} ({date}) - {league}")
    return "\n".join(lines)


def _format_standings(data: list) -> str:
    if not data or not isinstance(data, list):
        return ""
    first = data[0] if data else {}
    league = first.get("league", {})
    standings = league.get("standings", [])
    rows = (standings[0][:10] if standings and isinstance(standings[0], list) else []) or []
    lines = [f"La Liga {league.get('season', '')} standings:"]
    for r in rows:
        team = r.get("team", {}).get("name", "?")
        pts = r.get("points", 0)
        pos = r.get("rank", "?")
        fcb_marker = " (FC Barcelona)" if r.get("team", {}).get("id") == FCB_ID else ""
        lines.append(f"  {pos}. {team}: {pts} pts{fcb_marker}")
    return "\n".join(lines)


def _format_injuries(data: list) -> str:
    if not data or not isinstance(data, list):
        return ""
    lines = ["Current injuries:"]
    for inj in data[:15]:
        p = inj.get("player", {})
        lines.append(f"  {p.get('name', '?')}: {p.get('reason', '?')} ({p.get('type', '?')})")
    return "\n".join(lines)


def _format_transfers(data: list) -> str:
    if not data or not isinstance(data, list):
        return ""
    lines = ["Recent transfers:"]
    for t in data[:10]:
        p = t.get("player", {})
        teams = t.get("teams", {})
        out_name = teams.get("out", {}).get("name", "?")
        in_name = teams.get("in", {}).get("name", "?")
        lines.append(f"  {p.get('name', '?')}: {out_name} → {in_name}")
    return "\n".join(lines)


def _format_top_scorers(data: list) -> str:
    if not data or not isinstance(data, list):
        return ""
    lines = ["La Liga top scorers:"]
    for s in data[:10]:
        p = s.get("player", {})
        goals = s.get("statistics", [{}])[0].get("goals", {}).get("total") or 0
        team = s.get("statistics", [{}])[0].get("team", {}).get("name", "")
        lines.append(f"  {p.get('name', '?')} ({team}): {goals} goals")
    return "\n".join(lines)


async def _fetch_fcb_news() -> str:
    """Fetch and format scraped news from fcbarcelona.com for RAG context."""
    try:
        from server.scraper.fcb_news import (
            fetch_fcb_news,
            fetch_transfer_news,
            fetch_match_reports,
            format_news_for_rag,
        )
        all_news, transfer_news_list, match_reports_list = await asyncio.gather(
            fetch_fcb_news(limit=15),
            fetch_transfer_news(limit=8),
            fetch_match_reports(limit=8),
        )
        parts = []
        if transfer_news_list:
            parts.append(format_news_for_rag(transfer_news_list, "Latest transfer news (fcbarcelona.com)"))
        if match_reports_list:
            parts.append(format_news_for_rag(match_reports_list, "Recent match reports (fcbarcelona.com)"))
        if all_news and not (transfer_news_list or match_reports_list):
            parts.append(format_news_for_rag(all_news[:10], "Latest news (fcbarcelona.com)"))
        return "\n\n".join(parts) if parts else ""
    except Exception as e:
        logger.warning("fcb news fetch for RAG failed: %s", e)
        return ""


async def _fetch_gpt_news_insights() -> str:
    """Fetch GPT-analyzed news insights (injuries, transfers) for RAG."""
    try:
        from server.scraper.fcb_news import fetch_fcb_news
        from server.scraper.news_analyzer import analyze_news_with_gpt, format_insights_for_rag
        articles = await fetch_fcb_news(limit=20)
        if not articles:
            return ""
        insights = await analyze_news_with_gpt(articles)
        return format_insights_for_rag(insights)
    except Exception as e:
        logger.warning("GPT news insights for RAG failed: %s", e)
        return ""


def _format_commercial_revenue_context() -> str:
    """Static matchday + revenue model context for Genie (always available, no external API)."""
    try:
        from server.data.mock_data import get_matchday_insights
        d = get_matchday_insights()
    except Exception:
        return ""
    lines = [
        "COMMERCIAL / PROJECTED REVENUE (internal platform model — use for revenue, pricing, attendance money questions):",
        f"As of {d.get('as_of')}: total projected Estadi home revenue (upcoming homes) €{d.get('total_projected_revenue_upcoming_homes_m')}M.",
        f"Recent home historical sample total EUR {d.get('total_historical_home_revenue_m')}M.",
        str(d.get("pricing_elasticity_note", "")),
        "Why projections exist (per fixture): forecast attendance → demand tier; split tickets/hospitality/F&B; opponent draw tier sets band.",
    ]
    for r in (d.get("upcoming_home_revenue") or [])[:6]:
        opp = r.get("opponent", "?")
        rev = r.get("projected_revenue_m", "?")
        rat = r.get("revenue_rationale") or []
        lines.append(f"  • {opp}: EUR {rev}M — {' | '.join(rat[:3])}")
    for s in (d.get("ml_revenue_strategies") or [])[:4]:
        lines.append(
            f"  ML strategy: {s.get('title')} (~+{s.get('expected_revenue_lift_pct')}% lift) — {s.get('rationale', '')[:120]}"
        )
    return "\n".join(lines)


def _format_predictions(data: list) -> str:
    if not data or not isinstance(data, list):
        return ""
    lines = ["Match predictions:"]
    for p in data[:5]:
        teams = p.get("teams", {})
        home = teams.get("home", {}).get("name", "?")
        away = teams.get("away", {}).get("name", "?")
        pred = p.get("predictions", {})
        winner = pred.get("winner", {}).get("name", "Draw")
        lines.append(f"  {home} vs {away}: predicted winner {winner}")
    return "\n".join(lines)


async def build_rag_context(query: str) -> str:
    """
    Fetch fresh API-Football data and scraped fcbarcelona.com news; build context for RAG.
    Returns formatted text to augment LLM prompts.
    """
    import asyncio

    squad_task = _fetch("players/squads", {"team": FCB_ID})
    fixtures_task = _fetch("fixtures", {"team": FCB_ID, "next": 12})
    standings_task = _fetch("standings", {"league": LA_LIGA_ID, "season": SEASON})
    injuries_task = _fetch("injuries", {"team": FCB_ID, "league": LA_LIGA_ID, "season": SEASON})
    transfers_task = _fetch("transfers", {"team": FCB_ID})
    scorers_task = _fetch("players/topscorers", {"league": LA_LIGA_ID, "season": SEASON})
    predictions_task = _fetch("predictions", {"league": LA_LIGA_ID, "season": SEASON})

    # Also fetch scraped news and GPT-analyzed insights (injuries, transfers from news)
    news_task = _fetch_fcb_news()
    gpt_insights_task = _fetch_gpt_news_insights()

    squad, fixtures, standings, injuries, transfers, scorers, predictions, news_data, gpt_insights = await asyncio.gather(
        squad_task, fixtures_task, standings_task, injuries_task,
        transfers_task, scorers_task, predictions_task, news_task, gpt_insights_task,
    )

    commercial = _format_commercial_revenue_context()

    sections = []
    if commercial:
        sections.append(commercial)
    if gpt_insights:
        sections.append(gpt_insights)
    if news_data:
        sections.append(news_data)
    if squad:
        sections.append(_format_squad(squad) if isinstance(squad, list) else "")
    if fixtures:
        sections.append(_format_fixtures(fixtures) if isinstance(fixtures, list) else "")
    if standings:
        sections.append(_format_standings(standings) if isinstance(standings, list) else "")
    if injuries:
        sections.append(_format_injuries(injuries) if isinstance(injuries, list) else "")
    if transfers:
        sections.append(_format_transfers(transfers) if isinstance(transfers, list) else "")
    if scorers:
        sections.append(_format_top_scorers(scorers) if isinstance(scorers, list) else "")
    if predictions:
        sections.append(_format_predictions(predictions) if isinstance(predictions, list) else "")

    context = "\n\n".join(s for s in sections if s)
    if not context:
        context = """Squad: Lewandowski, Pedri, Lamine Yamal, Frenkie de Jong, Gavi, Balde, Araujo, Cubarsi, ter Stegen, Raphinha, Dani Olmo, Ferran Torres.
Upcoming: Real Madrid (home), Atletico Madrid (away), Sevilla (away), Villarreal (home).
Top transfer targets: Theo Hernandez, Florian Wirtz, Victor Osimhen."""

    return f"""LIVE FOOTBALL DATA (from API-Football, use to answer the user's question):

{context}

Answer the user's question using the above data. If the data doesn't contain the answer, say so and use general knowledge about FC Barcelona."""
