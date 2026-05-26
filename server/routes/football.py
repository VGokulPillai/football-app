"""API-Football proxy - all endpoints from https://www.api-football.com/documentation-v3."""
import os
import time
import logging
from datetime import datetime
from typing import Any, Optional
import httpx
from fastapi import APIRouter, Query, HTTPException

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/football", tags=["football"])

BASE_URL = "https://v3.football.api-sports.io"
MEDIA_BASE = "https://media.api-sports.io/football"

# FC Barcelona team ID (API-Football)
FCB_TEAM_ID = 529
LA_LIGA_ID = 140

# Current season: Aug–Jul (e.g. Aug 2025 = 2025)
_now = datetime.now()
CURRENT_SEASON = _now.year if _now.month >= 8 else _now.year - 1

# --- In-memory cache to avoid 429 rate limits ---
_cache: dict[str, tuple[float, dict]] = {}
CACHE_TTL_SECONDS = 300  # 5 minutes


def _get_headers() -> dict:
    key = os.environ.get("API_FOOTBALL_KEY", "")
    if not key:
        raise HTTPException(status_code=503, detail="API_FOOTBALL_KEY not configured")
    return {"x-apisports-key": key}


def _cache_key(endpoint: str, params: Optional[dict]) -> str:
    sorted_params = sorted((params or {}).items())
    return f"{endpoint}|{'&'.join(f'{k}={v}' for k, v in sorted_params)}"


async def _fetch(endpoint: str, params: Optional[dict] = None) -> dict:
    """Fetch from API-Football with in-memory caching to respect rate limits."""
    key = _cache_key(endpoint, params)
    now = time.time()

    if key in _cache:
        ts, data = _cache[key]
        if now - ts < CACHE_TTL_SECONDS:
            return data

    url = f"{BASE_URL}/{endpoint}"
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            r = await client.get(url, headers=_get_headers(), params=params or {})
            if r.status_code == 429:
                logger.warning("API-Football 429 for %s — returning cached or empty", endpoint)
                if key in _cache:
                    return _cache[key][1]
                return {"response": [], "errors": {"rateLimit": "Too many requests — try again later"}}
            r.raise_for_status()
            data = r.json()
            _cache[key] = (now, data)
            return data
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 429:
            logger.warning("API-Football 429 for %s — returning cached or empty", endpoint)
            if key in _cache:
                return _cache[key][1]
            return {"response": [], "errors": {"rateLimit": "Too many requests — try again later"}}
        raise


# --- Timezone ---
@router.get("/timezone")
async def get_timezone():
    """getTimezone - List supported timezones."""
    return await _fetch("timezone")


# --- Countries ---
@router.get("/countries")
async def get_countries(
    name: Optional[str] = Query(None),
    code: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
):
    """getCountries - List countries."""
    params = {k: v for k, v in [("name", name), ("code", code), ("search", search)] if v}
    return await _fetch("countries", params)


# --- Leagues ---
@router.get("/leagues")
async def get_leagues(
    id: Optional[int] = Query(None),
    name: Optional[str] = Query(None),
    country: Optional[str] = Query(None),
    code: Optional[str] = Query(None),
    season: Optional[int] = Query(None),
    team: Optional[int] = Query(None),
    type: Optional[str] = Query(None),
    current: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
):
    """getLeagues - List leagues/competitions."""
    params = {k: v for k, v in [
        ("id", id), ("name", name), ("country", country), ("code", code),
        ("season", season), ("team", team), ("type", type), ("current", current), ("search", search)
    ] if v is not None}
    return await _fetch("leagues", params)


@router.get("/leagues/seasons")
async def get_seasons():
    """getSeasons - List available seasons."""
    return await _fetch("leagues/seasons")


# --- Teams ---
@router.get("/teams")
async def get_teams(
    id: Optional[int] = Query(None),
    name: Optional[str] = Query(None),
    league: Optional[int] = Query(None),
    season: Optional[int] = Query(None),
    country: Optional[str] = Query(None),
    code: Optional[str] = Query(None),
    venue: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
):
    """getTeams - List teams."""
    params = {k: v for k, v in [
        ("id", id), ("name", name), ("league", league), ("season", season),
        ("country", country), ("code", code), ("venue", venue), ("search", search)
    ] if v is not None}
    return await _fetch("teams", params)


@router.get("/teams/statistics")
async def get_teams_statistics(
    league: int = Query(...),
    season: int = Query(...),
    team: int = Query(...),
):
    """getTeams statistics - Team stats for a league season."""
    return await _fetch("teams/statistics", {"league": league, "season": season, "team": team})


@router.get("/teams/seasons")
async def get_teams_seasons(team: int = Query(...)):
    """getTeams seasons - Seasons a team participated in."""
    return await _fetch("teams/seasons", {"team": team})


# --- Venues ---
@router.get("/venues")
async def get_venues(
    id: Optional[int] = Query(None),
    name: Optional[str] = Query(None),
    city: Optional[str] = Query(None),
    country: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
):
    """getVenues - List venues."""
    params = {k: v for k, v in [
        ("id", id), ("name", name), ("city", city), ("country", country), ("search", search)
    ] if v is not None}
    return await _fetch("venues", params)


# --- Standings ---
@router.get("/leagues/current-season")
async def get_league_current_season(league: int = Query(140)):
    """Get the API's current season for a league (leagues?current=true)."""
    data = await _fetch("leagues", {"id": league, "current": "true"})
    resp = data.get("response", [])
    if resp and resp[0].get("seasons"):
        year = resp[0]["seasons"][0].get("year")
        if year:
            return {"league": league, "season": year}
    return {"league": league, "season": CURRENT_SEASON}


@router.get("/standings")
async def get_standings(
    league: int = Query(...),
    season: int = Query(...),
    team: Optional[int] = Query(None),
):
    """getStandings - League/cup standings."""
    params = {"league": league, "season": season}
    if team:
        params["team"] = team
    return await _fetch("standings", params)


# --- Fixtures ---
@router.get("/fixtures")
async def get_fixtures(
    id: Optional[int] = Query(None),
    ids: Optional[str] = Query(None),
    live: Optional[str] = Query(None),
    date: Optional[str] = Query(None),
    league: Optional[int] = Query(None),
    season: Optional[int] = Query(None),
    team: Optional[int] = Query(None),
    last: Optional[int] = Query(None),
    next: Optional[int] = Query(None),
    from_date: Optional[str] = Query(None, alias="from"),
    to_date: Optional[str] = Query(None, alias="to"),
    round: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    venue: Optional[int] = Query(None),
    timezone: Optional[str] = Query(None),
):
    """getFixtures - Match fixtures."""
    params: dict[str, Any] = {}
    for k, v in [
        ("id", id), ("ids", ids), ("live", live), ("date", date), ("league", league),
        ("season", season), ("team", team), ("last", last), ("next", next),
        ("from", from_date), ("to", to_date), ("round", round), ("status", status),
        ("venue", venue), ("timezone", timezone),
    ]:
        if v is not None:
            params[k] = v
    return await _fetch("fixtures", params)


@router.get("/fixtures/headtohead")
async def get_fixtures_headtohead(
    h2h: str = Query(...),
    last: Optional[int] = Query(None),
    from_date: Optional[str] = Query(None, alias="from"),
    to_date: Optional[str] = Query(None, alias="to"),
    status: Optional[str] = Query(None),
    venue: Optional[int] = Query(None),
):
    """getFixtures head to head - H2H between two teams."""
    params = {"h2h": h2h}
    for k, v in [("last", last), ("from", from_date), ("to", to_date), ("status", status), ("venue", venue)]:
        if v is not None:
            params[k] = v
    return await _fetch("fixtures/headtohead", params)


@router.get("/fixtures/rounds")
async def get_fixtures_rounds(
    league: int = Query(...),
    season: int = Query(...),
    current: Optional[str] = Query(None),
    dates: Optional[str] = Query(None),
):
    """getFixtures rounds - Round names for a league season."""
    params = {"league": league, "season": season}
    if current:
        params["current"] = current
    if dates:
        params["dates"] = dates
    return await _fetch("fixtures/rounds", params)


@router.get("/fixtures/events")
async def get_fixtures_events(fixture: int = Query(...)):
    """getFixtures events - Match events (goals, cards, etc)."""
    return await _fetch("fixtures/events", {"fixture": fixture})


@router.get("/fixtures/lineups")
async def get_fixtures_lineups(
    fixture: int = Query(...),
    team: Optional[int] = Query(None),
    player: Optional[int] = Query(None),
):
    """getFixtures lineups - Formations and starting XI."""
    params = {"fixture": fixture}
    if team:
        params["team"] = team
    if player:
        params["player"] = player
    return await _fetch("fixtures/lineups", params)


@router.get("/fixtures/statistics")
async def get_fixtures_statistics(
    fixture: int = Query(...),
    team: Optional[int] = Query(None),
):
    """getFixtures statistics - Match statistics."""
    params = {"fixture": fixture}
    if team:
        params["team"] = team
    return await _fetch("fixtures/statistics", params)


# --- Injuries ---
@router.get("/injuries")
async def get_injuries(
    fixture: Optional[int] = Query(None),
    league: Optional[int] = Query(None),
    season: Optional[int] = Query(None),
    team: Optional[int] = Query(None),
    player: Optional[int] = Query(None),
    ids: Optional[str] = Query(None),
):
    """getInjuries - Player injury data."""
    params = {k: v for k, v in [
        ("fixture", fixture), ("league", league), ("season", season),
        ("team", team), ("player", player), ("ids", ids)
    ] if v is not None}
    return await _fetch("injuries", params)


# --- Predictions ---
@router.get("/predictions")
async def get_predictions(
    fixture: Optional[int] = Query(None),
    league: Optional[int] = Query(None),
    season: Optional[int] = Query(None),
    from_date: Optional[str] = Query(None, alias="from"),
    to_date: Optional[str] = Query(None, alias="to"),
):
    """getPredictions - Match predictions."""
    params: dict[str, Any] = {}
    for k, v in [("fixture", fixture), ("league", league), ("season", season), ("from", from_date), ("to", to_date)]:
        if v is not None:
            params[k] = v
    return await _fetch("predictions", params)


# --- Coaches ---
@router.get("/coachs")
async def get_coachs(
    id: Optional[int] = Query(None),
    team: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
):
    """getCoachs - Coach information."""
    params = {k: v for k, v in [("id", id), ("team", team), ("search", search)] if v is not None}
    return await _fetch("coachs", params)


# --- Players ---
@router.get("/players")
async def get_players(
    id: Optional[int] = Query(None),
    team: Optional[int] = Query(None),
    league: Optional[int] = Query(None),
    season: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
    page: Optional[int] = Query(None),
):
    """getPlayers - Player profiles and squad data."""
    params = {k: v for k, v in [
        ("id", id), ("team", team), ("league", league), ("season", season),
        ("search", search), ("page", page)
    ] if v is not None}
    return await _fetch("players", params)


@router.get("/players/squads")
async def get_players_squads(team: int = Query(...)):
    """getPlayers squads - Squad list for a team."""
    return await _fetch("players/squads", {"team": team})


@router.get("/players/topscorers")
async def get_players_topscorers(
    league: int = Query(...),
    season: int = Query(...),
):
    """getTop Scorers - Top scorers for a league season."""
    return await _fetch("players/topscorers", {"league": league, "season": season})


@router.get("/players/topassists")
async def get_players_topassists(
    league: int = Query(...),
    season: int = Query(...),
):
    """getTop Assists - Top assist providers."""
    return await _fetch("players/topassists", {"league": league, "season": season})


@router.get("/players/topyellowcards")
async def get_players_topyellowcards(
    league: int = Query(...),
    season: int = Query(...),
):
    """getTop Yellow Cards."""
    return await _fetch("players/topyellowcards", {"league": league, "season": season})


@router.get("/players/topredcards")
async def get_players_topredcards(
    league: int = Query(...),
    season: int = Query(...),
):
    """getTop Red Cards."""
    return await _fetch("players/topredcards", {"league": league, "season": season})


@router.get("/players/statistics")
async def get_players_statistics(
    fixture: Optional[int] = Query(None),
    league: Optional[int] = Query(None),
    season: Optional[int] = Query(None),
    team: Optional[int] = Query(None),
    player: Optional[int] = Query(None),
):
    """getPlayers statistics - Player match/season statistics."""
    params = {k: v for k, v in [
        ("fixture", fixture), ("league", league), ("season", season),
        ("team", team), ("player", player)
    ] if v is not None}
    return await _fetch("players/statistics", params)


# --- Transfers ---
@router.get("/transfers")
async def get_transfers(
    player: Optional[int] = Query(None),
    team: Optional[int] = Query(None),
):
    """getTransfers - Player transfer history."""
    params = {k: v for k, v in [("player", player), ("team", team)] if v is not None}
    return await _fetch("transfers", params)


# --- Trophies ---
@router.get("/trophies")
async def get_trophies(
    player: Optional[int] = Query(None),
    coach: Optional[int] = Query(None),
):
    """getTrophies - Player/coach trophy history."""
    params = {k: v for k, v in [("player", player), ("coach", coach)] if v is not None}
    return await _fetch("trophies", params)


# --- Sidelined ---
@router.get("/sidelined")
async def get_sidelined(
    player: Optional[int] = Query(None),
    coach: Optional[int] = Query(None),
    players: Optional[str] = Query(None),
    coachs: Optional[str] = Query(None),
):
    """getSidelined - Suspensions, bans, etc."""
    params = {k: v for k, v in [("player", player), ("coach", coach), ("players", players), ("coachs", coachs)] if v is not None}
    return await _fetch("sidelined", params)


# --- Odds ---
@router.get("/odds")
async def get_odds(
    fixture: Optional[int] = Query(None),
    league: Optional[int] = Query(None),
    season: Optional[int] = Query(None),
    date: Optional[str] = Query(None),
    timezone: Optional[str] = Query(None),
    page: Optional[int] = Query(None),
    bookmaker: Optional[int] = Query(None),
    bet: Optional[int] = Query(None),
):
    """getOdds - Pre-match odds."""
    params = {k: v for k, v in [
        ("fixture", fixture), ("league", league), ("season", season),
        ("date", date), ("timezone", timezone), ("page", page),
        ("bookmaker", bookmaker), ("bet", bet)
    ] if v is not None}
    return await _fetch("odds", params)


@router.get("/odds/live")
async def get_odds_live(fixture: int = Query(...)):
    """getOdds live - Live in-play odds."""
    return await _fetch("odds/live", {"fixture": fixture})


@router.get("/odds/bookmakers")
async def get_odds_bookmakers():
    """getBookmakers - List bookmakers."""
    return await _fetch("odds/bookmakers")


@router.get("/odds/bets")
async def get_odds_bets():
    """getBets - List bet types."""
    return await _fetch("odds/bets")


# --- Status (no quota) ---
@router.get("/status")
async def get_status():
    """API status and quota - does not count toward daily limit."""
    return await _fetch("status")


# --- Media URLs (helper - images don't need API key) ---
@router.get("/media/player/{player_id}")
async def player_photo_url(player_id: int):
    """Return player photo URL. Use: https://media.api-sports.io/football/players/{id}.png"""
    return {"url": f"{MEDIA_BASE}/players/{player_id}.png"}


@router.get("/media/team/{team_id}")
async def team_logo_url(team_id: int):
    """Return team logo URL."""
    return {"url": f"{MEDIA_BASE}/teams/{team_id}.png"}


@router.get("/media/league/{league_id}")
async def league_logo_url(league_id: int):
    """Return league logo URL."""
    return {"url": f"{MEDIA_BASE}/leagues/{league_id}.png"}


@router.get("/media/venue/{venue_id}")
async def venue_image_url(venue_id: int):
    """Return venue image URL."""
    return {"url": f"{MEDIA_BASE}/venues/{venue_id}.png"}


# --- FC Barcelona convenience ---
@router.get("/barcelona/squad")
async def barcelona_squad(season: Optional[int] = Query(None)):
    """FC Barcelona squad with player photos (season param ignored - squads use team only)."""
    data = await _fetch("players/squads", {"team": FCB_TEAM_ID})
    return data


@router.get("/barcelona/fixtures")
async def barcelona_fixtures(
    season: Optional[int] = Query(None),
    next_n: int = Query(10, alias="next"),
):
    """FC Barcelona upcoming fixtures."""
    params = {"team": FCB_TEAM_ID, "next": next_n}
    if season:
        params["season"] = season
    return await _fetch("fixtures", params)


@router.get("/barcelona/standings")
async def barcelona_standings(season: int = Query(default=CURRENT_SEASON, description="Season year (e.g. 2025 for 2025-26)")):
    """La Liga standings (FC Barcelona in context)."""
    return await _fetch("standings", {"league": LA_LIGA_ID, "season": season})


def _formation_attack_defense_pct(formation: Optional[str]) -> tuple[int, int, str]:
    """
    Heuristic balance from formation string (back → front lines).
    Higher weight on forward lines → higher attacking %.
    """
    if not formation or not str(formation).strip():
        return 50, 50, "No formation on file — using neutral split."
    raw = str(formation).replace(" ", "").strip()
    parts: list[int] = []
    for seg in raw.split("-"):
        if seg.isdigit():
            parts.append(int(seg))
    if not parts:
        return 50, 50, "Could not parse formation — neutral split."
    n = len(parts)
    attack_w = sum(parts[i] * (i + 1) for i in range(n))
    def_w = sum(parts[i] * (n - i) for i in range(n))
    t = attack_w + def_w
    if t <= 0:
        return 50, 50, "Neutral split."
    attacking = max(18, min(82, round(100 * attack_w / t)))
    defending = 100 - attacking
    if attacking >= 58:
        label = "Attack-leaning shape (wide or advanced lines)."
    elif defending >= 58:
        label = "Defence-leaning shape (low block / extra defender)."
    else:
        label = "Balanced between attack and defensive structure."
    return attacking, defending, label


def _safe_num(x: Any, default: float = 0.0) -> float:
    if x is None or x == "":
        return default
    try:
        return float(x)
    except (TypeError, ValueError):
        return default


def _safe_int(x: Any, default: int = 0) -> int:
    return int(round(_safe_num(x, float(default))))


async def _latest_barcelona_formation() -> tuple[Optional[str], Optional[int], Optional[dict]]:
    """Most recent fixture (scan last few) where API published a lineup + formation."""
    data = await _fetch("fixtures", {"team": FCB_TEAM_ID, "last": 12})
    for item in data.get("response") or []:
        fid = (item.get("fixture") or {}).get("id")
        if not fid:
            continue
        lu = await _fetch("fixtures/lineups", {"fixture": fid})
        for block in lu.get("response") or []:
            if (block.get("team") or {}).get("id") != FCB_TEAM_ID:
                continue
            fm = block.get("formation")
            if fm:
                return str(fm), int(fid), item
    return None, None, None


async def _all_players_team_league(team: int, league: int, season: int) -> list[dict]:
    out: list[dict] = []
    page = 1
    while True:
        data = await _fetch(
            "players",
            {"team": team, "league": league, "season": season, "page": page},
        )
        out.extend(data.get("response") or [])
        pg = data.get("paging") or {}
        cur = pg.get("current", page)
        tot = pg.get("total", 1)
        if cur >= tot:
            break
        page = cur + 1
        if page > 50:
            break
    return out


def _pl_stat_row(entry: dict) -> Optional[dict]:
    player = entry.get("player") or {}
    pid = player.get("id")
    name = player.get("name")
    if not pid or not name:
        return None
    stats_list = entry.get("statistics") or []
    if not stats_list:
        return None
    st = stats_list[0]
    for s in stats_list:
        if (s.get("league") or {}).get("id") == LA_LIGA_ID:
            st = s
            break
    games = st.get("games") or {}
    goals = st.get("goals") or {}
    shots = st.get("shots") or {}
    passes = st.get("passes") or {}
    tackles = st.get("tackles") or {}
    duels = st.get("duels") or {}
    dribbles = st.get("dribbles") or {}
    cards = st.get("cards") or {}

    apps = _safe_int(games.get("appearences"))
    minutes = _safe_int(games.get("minutes"))
    gl = _safe_int(goals.get("total"))
    ast = _safe_int(goals.get("assists"))
    shots_tot = _safe_int(shots.get("total"))
    shots_on = _safe_int(shots.get("on"))
    key_passes = _safe_int(passes.get("key"))
    acc = passes.get("accuracy")
    if isinstance(acc, str):
        acc = acc.replace("%", "").strip()
    pass_acc = _safe_num(acc, 0.0)
    tk = _safe_int(tackles.get("total"))
    inter = _safe_int(tackles.get("interceptions"))
    duels_w = _safe_int(duels.get("won"))
    drib_succ = _safe_int(dribbles.get("success"))

    atk_raw = gl * 8 + ast * 6 + shots_on * 2 + min(shots_tot, 50) * 0.35 + drib_succ * 1.5 + key_passes * 2
    def_raw = tk * 2 + inter * 2.5 + duels_w * 0.45

    return {
        "player_id": pid,
        "name": name,
        "photo": f"{MEDIA_BASE}/players/{pid}.png",
        "position": games.get("position") or player.get("position") or "",
        "appearances": apps,
        "minutes": minutes,
        "rating": games.get("rating"),
        "goals": gl,
        "assists": ast,
        "shots": shots_tot,
        "shots_on_target": shots_on,
        "passes_key": key_passes,
        "pass_accuracy": round(pass_acc, 1),
        "tackles": tk,
        "interceptions": inter,
        "duels_won": duels_w,
        "dribbles_success": drib_succ,
        "yellow_cards": _safe_int(cards.get("yellow")),
        "red_cards": _safe_int(cards.get("red")),
        "attacking_contribution_raw": round(atk_raw, 2),
        "defensive_contribution_raw": round(def_raw, 2),
    }


@router.get("/barcelona/player-performance-live")
async def barcelona_player_performance_live(
    season: int = Query(default=CURRENT_SEASON, description="Season year (e.g. 2025 for 2025-26 La Liga)"),
):
    """
    Single bundle for Player Performance UI: latest published formation (last match with lineups)
    + all FC Barcelona players La Liga statistics from API-Football (live data only).
    """
    try:
        _get_headers()
    except HTTPException as e:
        return {
            "ok": False,
            "source": "api-football",
            "error": str(e.detail),
            "season": season,
            "formation": None,
            "formation_fixture_id": None,
            "formation_context": None,
            "formation_balance": None,
            "players": [],
        }

    try:
        formation, fix_id, fix_item = await _latest_barcelona_formation()
        atk_pct, def_pct, shape_note = _formation_attack_defense_pct(formation)

        ctx = None
        if fix_item:
            fx = fix_item.get("fixture") or {}
            teams = fix_item.get("teams") or {}
            home = teams.get("home") or {}
            away = teams.get("away") or {}
            ctx = {
                "fixture_id": fix_id,
                "date": (fx.get("date") or "")[:16],
                "status": (fx.get("status") or {}).get("long"),
                "home_team": home.get("name"),
                "away_team": away.get("name"),
                "home_id": home.get("id"),
                "away_id": away.get("id"),
            }

        raw_players = await _all_players_team_league(FCB_TEAM_ID, LA_LIGA_ID, season)
        by_id: dict[int, dict] = {}
        for ent in raw_players:
            row = _pl_stat_row(ent)
            if row:
                by_id[int(row["player_id"])] = row

        squad_data = await _fetch("players/squads", {"team": FCB_TEAM_ID})
        squad_block = (squad_data.get("response") or [{}])[0]
        squad_players = squad_block.get("players") or []

        def _empty_row(pid: int, pname: str, pos: str) -> dict:
            return {
                "player_id": pid,
                "name": pname,
                "photo": f"{MEDIA_BASE}/players/{pid}.png",
                "position": pos or "",
                "appearances": 0,
                "minutes": 0,
                "rating": None,
                "goals": 0,
                "assists": 0,
                "shots": 0,
                "shots_on_target": 0,
                "passes_key": 0,
                "pass_accuracy": 0.0,
                "tackles": 0,
                "interceptions": 0,
                "duels_won": 0,
                "dribbles_success": 0,
                "yellow_cards": 0,
                "red_cards": 0,
                "attacking_contribution_raw": 0.0,
                "defensive_contribution_raw": 0.0,
            }

        rows: list[dict] = []
        for sp in squad_players:
            pid = sp.get("id")
            if not pid:
                continue
            pid = int(pid)
            if pid in by_id:
                rows.append(by_id[pid])
            else:
                rows.append(
                    _empty_row(
                        pid,
                        str(sp.get("name") or "?"),
                        str(sp.get("position") or ""),
                    )
                )

        rows.sort(key=lambda r: (-r["minutes"], r["name"]))

        atks = [r["attacking_contribution_raw"] for r in rows]
        defs = [r["defensive_contribution_raw"] for r in rows]

        def _norm(vals: list[float], v: float) -> int:
            if not vals:
                return 50
            lo, hi = min(vals), max(vals)
            if hi <= lo:
                return 50
            return int(round(100 * (v - lo) / (hi - lo)))

        for r in rows:
            r["attacking_index"] = _norm(atks, r["attacking_contribution_raw"])
            r["defensive_index"] = _norm(defs, r["defensive_contribution_raw"])
            # Blend for "current role" arrow on pitch-style thinking
            tr = _safe_num(r["rating"], 0.0)
            r["live_rating"] = round(tr, 2) if tr else None

        return {
            "ok": True,
            "source": "api-football",
            "season": season,
            "league_id": LA_LIGA_ID,
            "formation": formation,
            "formation_fixture_id": fix_id,
            "formation_context": ctx,
            "formation_balance": {
                "attacking_pct": atk_pct,
                "defending_pct": def_pct,
                "interpretation": shape_note,
                "method": "Line depth weighting on published formation from the most recent match with lineups.",
            },
            "players": rows,
        }
    except HTTPException:
        raise
    except Exception as e:
        return {
            "ok": False,
            "source": "api-football",
            "error": str(e),
            "season": season,
            "formation": None,
            "formation_fixture_id": None,
            "formation_context": None,
            "formation_balance": None,
            "players": [],
        }
