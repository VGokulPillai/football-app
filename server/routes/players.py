"""Player performance and health API."""
from fastapi import APIRouter
from server.data.mock_data import PLAYERS, _player_performance, _health_status

router = APIRouter(prefix="/players", tags=["players"])


@router.get("")
async def list_players():
    """All squad players."""
    return PLAYERS


@router.get("/{player_id}")
async def get_player(player_id: str):
    """Single player details."""
    for p in PLAYERS:
        if p["id"] == player_id:
            perf = next((x for x in _player_performance() if x["player_id"] == player_id), None)
            health = next((x for x in _health_status() if x["player_id"] == player_id), None)
            return {**p, "performance": perf, "health": health}
    return {"error": "Player not found"}


@router.get("/performance/summary")
async def performance_summary():
    """Player performance metrics (last 5 matches)."""
    return _player_performance()


@router.get("/health/status")
async def health_status():
    """Squad health and injury status."""
    return _health_status()


@router.get("/comparison")
async def player_comparison(player_ids: str = ""):
    """Compare multiple players (comma-separated IDs)."""
    ids = [x.strip() for x in player_ids.split(",") if x.strip()] if player_ids else []
    perf = _player_performance()
    if ids:
        perf = [p for p in perf if p["player_id"] in ids]
    return perf
