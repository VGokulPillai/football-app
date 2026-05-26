"""ML inference service - attendance prediction, injury risk, match outcome."""
import os
import time
import logging
from datetime import datetime
from typing import Any, Optional
import httpx

logger = logging.getLogger(__name__)

API_FOOTBALL_BASE = "https://v3.football.api-sports.io"
FCB_ID = 529
LA_LIGA_ID = 140

_now = datetime.now()
SEASON = _now.year if _now.month >= 8 else _now.year - 1  # Aug–Jul

_ml_cache: dict[str, tuple[float, Any]] = {}
_ML_CACHE_TTL = 300


def _get_headers() -> dict:
    key = os.environ.get("API_FOOTBALL_KEY", "")
    return {"x-apisports-key": key} if key else {}


async def predict_attendance(
    opponent_tier: int = 2,
    is_weekend: bool = True,
    temp_c: float = 12.0,
    is_rain: bool = False,
    competition: str = "La Liga",
) -> dict:
    """
    Predict matchday attendance using feature-based heuristic (ML model in production).
    opponent_tier: 1=big (Real Madrid, Atletico), 2=medium, 3=small
    """
    base = 50000
    adj = 0
    adj += (1 if opponent_tier == 1 else -1 if opponent_tier == 3 else 0) * 4000
    adj += 2000 if is_weekend else 0
    adj += temp_c * 80
    adj += -4000 if is_rain else 0
    adj += 3000 if "Champions" in competition or "UCL" in competition else 0
    pred = max(35000, min(76000, int(base + adj)))
    return {
        "predicted_attendance": pred,
        "confidence_low": int(pred * 0.92),
        "confidence_high": int(pred * 1.08),
        "features": {
            "opponent_tier": opponent_tier,
            "is_weekend": is_weekend,
            "temp_c": temp_c,
            "is_rain": is_rain,
            "competition": competition,
        },
    }


async def predict_injury_risk(
    training_load: float,
    fatigue: float,
    matches_7d: int = 0,
    minutes_7d: int = 0,
) -> dict:
    """
    Predict injury risk from workload features.
    Returns risk score 0-100 and binary at_risk flag.
    """
    risk_score = (
        fatigue * 0.35
        + training_load * 0.25
        + matches_7d * 12
        + minutes_7d * 0.04
    )
    risk_score = min(100, max(0, risk_score))
    return {
        "risk_score": round(risk_score, 1),
        "at_risk": risk_score > 55,
        "recommendation": "Consider rotation" if risk_score > 55 else "Normal load",
        "features": {
            "training_load": training_load,
            "fatigue": fatigue,
            "matches_7d": matches_7d,
            "minutes_7d": minutes_7d,
        },
    }


async def get_match_predictions(fixture_id: Optional[int] = None) -> list:
    """Get match predictions from API-Football."""
    if not _get_headers():
        return []

    cache_key = f"predictions|{fixture_id}"
    now = time.time()
    if cache_key in _ml_cache:
        ts, data = _ml_cache[cache_key]
        if now - ts < _ML_CACHE_TTL:
            return data

    url = f"{API_FOOTBALL_BASE}/predictions"
    params = {"league": LA_LIGA_ID, "season": SEASON}
    if fixture_id:
        params["fixture"] = fixture_id
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.get(url, headers=_get_headers(), params=params)
            if r.status_code == 429:
                logger.warning("ML: API-Football 429 on predictions")
                if cache_key in _ml_cache:
                    return _ml_cache[cache_key][1]
                return []
            if r.status_code == 200:
                data = r.json()
                result = data.get("response", [])
                _ml_cache[cache_key] = (now, result)
                return result
    except Exception as e:
        logger.warning("Predictions fetch failed: %s", e)
        if cache_key in _ml_cache:
            return _ml_cache[cache_key][1]
    return []


async def get_player_statistics(player_id: int, season: int = SEASON) -> dict:
    """Get player season statistics from API-Football for ML features."""
    if not _get_headers():
        return {}

    cache_key = f"player|{player_id}|{season}"
    now = time.time()
    if cache_key in _ml_cache:
        ts, data = _ml_cache[cache_key]
        if now - ts < _ML_CACHE_TTL:
            return data

    url = f"{API_FOOTBALL_BASE}/players"
    params = {"id": player_id, "season": season}
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.get(url, headers=_get_headers(), params=params)
            if r.status_code == 429:
                logger.warning("ML: API-Football 429 on player stats %d", player_id)
                if cache_key in _ml_cache:
                    return _ml_cache[cache_key][1]
                return {}
            if r.status_code == 200:
                data = r.json()
                resp = data.get("response", [])
                result = resp[0] if resp else {}
                _ml_cache[cache_key] = (now, result)
                return result
    except Exception as e:
        logger.warning("Player stats fetch failed: %s", e)
        if cache_key in _ml_cache:
            return _ml_cache[cache_key][1]
    return {}
