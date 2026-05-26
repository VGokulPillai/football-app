"""Scenario simulation API."""
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/simulation", tags=["simulation"])


class InjurySimulation(BaseModel):
    player_ids: list[str]
    duration_weeks: int = 2


class TransferSimulation(BaseModel):
    transfer_in: Optional[list[str]] = None  # player names to add
    transfer_out: Optional[list[str]] = None  # player names to remove


class PricingSimulation(BaseModel):
    fixture_id: str
    price_change_pct: float


@router.post("/injury")
async def simulate_injury(sim: InjurySimulation):
    """Simulate player injury impact on squad depth."""
    return {
        "affected_players": sim.player_ids,
        "duration_weeks": sim.duration_weeks,
        "bench_depth_score_before": 85,
        "bench_depth_score_after": max(0, 85 - len(sim.player_ids) * 12),
        "position_coverage_impact": "Moderate gap in midfield" if "p4" in sim.player_ids else "Manageable",
        "recommendation": "Consider academy call-up or loan recall",
    }


@router.post("/transfer")
async def simulate_transfer(sim: TransferSimulation):
    """Simulate transfer in/out effects."""
    return {
        "transfer_in": sim.transfer_in or [],
        "transfer_out": sim.transfer_out or [],
        "squad_balance_impact": "Improved" if sim.transfer_in else "Needs reinforcement",
        "tactical_fit_change": "+5",
        "commercial_value_change": "+8" if sim.transfer_in else "-3",
    }


@router.post("/pricing")
async def simulate_pricing(sim: PricingSimulation):
    """Simulate ticket price change impact."""
    return {
        "fixture_id": sim.fixture_id,
        "price_change_pct": sim.price_change_pct,
        "attendance_impact_pct": -1.5 * sim.price_change_pct if sim.price_change_pct > 0 else 2 * abs(sim.price_change_pct),
        "revenue_impact_pct": sim.price_change_pct * 0.7,
        "optimal_range": "-5% to +10%",
    }


@router.post("/weather")
async def simulate_weather(fixture_id: str, conditions: str = "rain"):
    """Simulate weather impact on attendance."""
    impact = -8 if conditions == "rain" else -3 if conditions == "cold" else 0
    return {
        "fixture_id": fixture_id,
        "conditions": conditions,
        "attendance_impact_pct": impact,
        "no_show_increase_pct": 2 if conditions == "rain" else 0,
    }
