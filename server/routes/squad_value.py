"""Squad value and transfer potential - API-Football + ML."""
import os
import time
import logging
from typing import Any, Optional, Tuple
import httpx
from fastapi import APIRouter

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/squad-value", tags=["squad-value"])

API_BASE = "https://v3.football.api-sports.io"
FCB_ID = 529
MEDIA_BASE = "https://media.api-sports.io/football"

_sv_cache: dict[str, tuple[float, list]] = {}
_SV_CACHE_TTL = 300


def _get_headers() -> dict:
    key = os.environ.get("API_FOOTBALL_KEY", "")
    return {"x-apisports-key": key} if key else {}


async def _fetch(endpoint: str, params: Optional[dict] = None) -> list:
    if not _get_headers():
        return []

    cache_key = f"{endpoint}|{sorted((params or {}).items())}"
    now = time.time()
    if cache_key in _sv_cache:
        ts, data = _sv_cache[cache_key]
        if now - ts < _SV_CACHE_TTL:
            return data

    url = f"{API_BASE}/{endpoint}"
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.get(url, headers=_get_headers(), params=params or {})
            if r.status_code == 429:
                logger.warning("Squad-value: API-Football 429 on %s", endpoint)
                if cache_key in _sv_cache:
                    return _sv_cache[cache_key][1]
                return []
            if r.status_code == 200:
                data = r.json()
                result = data.get("response", [])
                _sv_cache[cache_key] = (now, result)
                return result
    except Exception:
        if cache_key in _sv_cache:
            return _sv_cache[cache_key][1]
    return []


def _estimate_value(age: int, position: str) -> float:
    """ML-style valuation: younger + key positions = higher potential value."""
    base = 15
    if age and age < 22:
        base *= 1.8
    elif age and age < 25:
        base *= 1.4
    elif age and age > 30:
        base *= 0.7
    pos_mult = {"Striker": 1.5, "Midfielder": 1.3, "Winger": 1.4, "Defender": 1.1, "Goalkeeper": 1.0}
    mult = pos_mult.get(position, 1.2) if position else 1.2
    return round(base * mult, 1)


def _build_loan_map(transfers_data: list) -> Tuple[dict, list]:
    """
    Build player_id -> loan_status from transfers API.
    Returns (loan_map, loaned_out_list).
    loan_status: "loan_in" | "loan_out" | None
    """
    loan_map = {}
    loaned_out = []
    for item in transfers_data or []:
        try:
            p = item.get("player") or {}
            pid = p.get("id")
            pname = p.get("name", "?")
            transfers_list = item.get("transfers") or []
            if not transfers_list:
                continue
            latest = transfers_list[0]
            ttype = (latest.get("type") or "").lower()
            teams = latest.get("teams") or {}
            out_t = teams.get("out") or {}
            in_t = teams.get("in") or {}
            out_id = out_t.get("id") if isinstance(out_t, dict) else None
            in_id = in_t.get("id") if isinstance(in_t, dict) else None
            in_name = in_t.get("name", "?") if isinstance(in_t, dict) else "?"
            out_name = out_t.get("name", "?") if isinstance(out_t, dict) else "?"
            if "loan" in ttype:
                if out_id == FCB_ID and in_id != FCB_ID:
                    loan_map[pid] = "loan_out"
                    loaned_out.append({"id": pid, "name": pname, "club": in_name})
                elif in_id == FCB_ID and out_id != FCB_ID:
                    loan_map[pid] = "loan_in"
        except Exception:
            continue
    return loan_map, loaned_out


@router.get("/squad")
async def get_squad_with_value():
    """Squad with estimated market value, potential, and loan tags (API-Football)."""
    data = await _fetch("players/squads", {"team": FCB_ID})
    transfers_data = await _fetch("transfers", {"team": FCB_ID})
    loan_map, loaned_out = _build_loan_map(transfers_data)

    if not data:
        return {"squad": [], "total_value_m": 0, "loaned_out": loaned_out, "source": "fallback"}
    team_data = data[0]
    players = team_data.get("players", [])
    squad = []
    total = 0
    for p in players:
        age = p.get("age") or 25
        pos = p.get("position") or "Midfielder"
        val = _estimate_value(age, pos)
        total += val
        pid = p.get("id")
        loan_status = loan_map.get(pid)
        squad.append({
            "id": pid,
            "name": p.get("name"),
            "position": pos,
            "number": p.get("number"),
            "age": age,
            "photo_url": f"{MEDIA_BASE}/players/{pid}.png",
            "estimated_value_m": val,
            "potential_value_m": round(val * 1.3, 1) if age < 24 else val,
            "loan_status": loan_status,
        })
    return {"squad": squad, "total_value_m": round(total, 1), "loaned_out": loaned_out, "source": "api-football"}


@router.get("/transfer-potential")
async def get_transfer_potential():
    """Transfer targets matched to squad gaps - API-Football transfers + ML fit score."""
    from server.data.mock_data import _transfer_targets

    squad_data = await get_squad_with_value()
    squad = squad_data.get("squad", [])
    transfers = await _fetch("transfers", {"team": FCB_ID})
    targets = _transfer_targets()

    # Squad gaps from positions
    positions = {p.get("position") for p in squad if p.get("position")}
    gap_priority = {"Defender": "Left Back", "Striker": "Rotation", "Midfielder": "Attacking"}

    # Enrich targets with ML fit
    for t in targets:
        pos = t.get("position", "")
        t["squad_gap_match"] = pos in gap_priority or "Defender" in pos
        t["ml_fit_score"] = min(100, int(
            t.get("sporting_fit", 0) * 0.4 + t.get("tactical_fit", 0) * 0.4 + t.get("commercial_value", 0) * 0.2
        ))

    recent = []
    for t in transfers[:10]:
        try:
            p = t.get("player") or {}
            teams = t.get("teams") or {}
            out_t = teams.get("out") or {}
            in_t = teams.get("in") or {}
            recent.append({
                "player": p.get("name") if isinstance(p, dict) else str(p),
                "from": out_t.get("name", "?") if isinstance(out_t, dict) else "?",
                "to": in_t.get("name", "?") if isinstance(in_t, dict) else "?",
                "date": (t.get("update") or "")[:10],
            })
        except Exception:
            recent.append({"player": "?", "from": "?", "to": "?", "date": ""})

    return {
        "targets": sorted(targets, key=lambda x: x.get("ml_fit_score", 0), reverse=True),
        "recent_transfers": recent,
        "squad_total_value_m": squad_data.get("total_value_m", 0),
    }
