"""Live fixtures from API-Football with mock fallback. Powers hero, countdown, venue images."""
import os
import time
import logging
from datetime import date
from typing import Any

import httpx

from server.data.mock_data import _fixtures as _mock_fixtures

logger = logging.getLogger(__name__)

FCB_TEAM_ID = 529
API_BASE = "https://v3.football.api-sports.io"
MEDIA_BASE = "https://media.api-sports.io/football"

_cache: dict[str, tuple[float, Any]] = {}
CACHE_TTL = 300  # 5 minutes


def _sorted_next_fixtures(fixtures: list[dict]) -> list[dict]:
    """Filter to upcoming only and sort by date so first = next match."""
    today = date.today().isoformat()
    upcoming = [f for f in fixtures if (f.get("date") or "") >= today]
    upcoming.sort(key=lambda f: (f.get("date", ""), f.get("kickoff", "")))
    return upcoming if upcoming else fixtures


def _transform_api_fixture(item: dict) -> dict:
    """Transform API-Football fixture to executive format."""
    fixture = item.get("fixture") or {}
    teams = item.get("teams") or {}
    league = item.get("league") or {}
    home = teams.get("home") or {}
    away = teams.get("away") or {}
    venue_obj = fixture.get("venue") or {}

    is_home = home.get("id") == FCB_TEAM_ID
    opponent = (away if is_home else home).get("name", "TBC")
    venue = venue_obj.get("name") or ("Spotify Camp Nou" if is_home else "Away")
    raw_date = fixture.get("date") or ""
    date_str = raw_date[:10] if len(raw_date) >= 10 else ""
    time_str = raw_date[11:16] if len(raw_date) >= 16 else "20:00"
    venue_id = venue_obj.get("id")

    return {
        "id": str(fixture.get("id", "")),
        "opponent": opponent,
        "competition": league.get("name", "La Liga"),
        "venue": venue,
        "date": date_str,
        "kickoff": time_str,
        "fixture_datetime_iso": raw_date if "T" in raw_date else None,
        "is_home": is_home,
        "venue_id": venue_id,
        "venue_image_url": f"{MEDIA_BASE}/venues/{venue_id}.png" if venue_id else None,
    }


async def _api_get(params: dict, cache_key: str) -> dict | None:
    """Cached API-Football GET for /fixtures with 429 handling."""
    now = time.time()
    if cache_key in _cache:
        ts, data = _cache[cache_key]
        if now - ts < CACHE_TTL:
            return data

    key = os.environ.get("API_FOOTBALL_KEY", "")
    if not key:
        return None

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.get(
                f"{API_BASE}/fixtures",
                params=params,
                headers={"x-apisports-key": key},
            )
            if r.status_code == 429:
                logger.warning("API-Football 429 on fixtures — using cache/mock")
                if cache_key in _cache:
                    return _cache[cache_key][1]
                return None
            r.raise_for_status()
            data = r.json()
            _cache[cache_key] = (now, data)
            return data
    except Exception:
        if cache_key in _cache:
            return _cache[cache_key][1]
        return None


async def get_last_played_fixture() -> dict[str, Any] | None:
    """Fetch the most recent completed FC Barcelona fixture (with score)."""
    data = await _api_get({"team": FCB_TEAM_ID, "last": 1}, "last_played")
    if not data:
        return None

    items = data.get("response") or []
    if not items:
        return None

    item = items[0]
    fx = _transform_api_fixture(item)
    goals = item.get("goals") or {}
    home_goals = goals.get("home")
    away_goals = goals.get("away")
    if home_goals is not None and away_goals is not None:
        teams = item.get("teams") or {}
        is_home = (teams.get("home") or {}).get("id") == FCB_TEAM_ID
        if is_home:
            fx["score"] = f"{home_goals}-{away_goals}"
        else:
            fx["score"] = f"{away_goals}-{home_goals}"
    return fx


async def get_upcoming_fixtures() -> list[dict[str, Any]]:
    """Fetch upcoming fixtures, falls back to mock data on any error."""
    data = await _api_get({"team": FCB_TEAM_ID, "next": 12}, "upcoming_12")
    if not data:
        return _sorted_next_fixtures(_mock_fixtures())

    raw = data.get("response") or []
    result = []
    today = date.today().isoformat()
    for item in raw:
        try:
            fx = _transform_api_fixture(item)
            if fx.get("date", "") >= today:
                result.append(fx)
        except Exception:
            continue
    result.sort(key=lambda f: (f.get("date", ""), f.get("kickoff", "")))
    return result if result else _sorted_next_fixtures(_mock_fixtures())
