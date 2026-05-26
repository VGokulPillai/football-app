"""Executive dashboard API."""
from datetime import datetime

from fastapi import APIRouter

from server.data.mock_data import get_executive_summary, get_matchday_insights, _alerts
from server.services.fixtures import get_upcoming_fixtures, get_last_played_fixture

router = APIRouter(prefix="/executive", tags=["executive"])


@router.get("/summary")
async def get_summary():
    """Executive control tower summary. Next + last match from live API-Football data."""
    fixtures = await get_upcoming_fixtures()
    live_last = await get_last_played_fixture()

    insights = get_matchday_insights(schedule=fixtures)
    first = fixtures[0] if fixtures else None
    base = get_executive_summary()
    base["last_updated"] = datetime.utcnow().isoformat() + "Z"
    if first:
        base["next_match_opponent"] = first.get("opponent", base.get("next_match_opponent"))

    last = live_last or insights.get("last_match")
    if last:
        base["last_match_opponent"] = last.get("opponent", "—")
        base["last_match_date"] = last.get("date", "")
        base["last_match_venue"] = last.get("venue", "")
        base["last_match_score"] = last.get("score", "")
        base["last_match_is_home"] = last.get("is_home", True)
    return base


@router.get("/alerts")
async def get_alerts():
    """Real-time alerts."""
    return _alerts()


@router.get("/upcoming-fixtures")
async def upcoming_fixtures():
    """Upcoming match fixtures — live from API-Football with mock fallback."""
    return await get_upcoming_fixtures()


@router.get("/matchday-insights")
async def matchday_insights():
    """Next match, demand estimates, previous results, and home revenue (projected + historical totals)."""
    fixtures = await get_upcoming_fixtures()
    return get_matchday_insights(schedule=fixtures)
