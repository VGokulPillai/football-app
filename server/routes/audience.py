"""Audience prediction and matchday demand API."""
from fastapi import APIRouter
from server.data.mock_data import _attendance_predictions, _fan_segments

router = APIRouter(prefix="/audience", tags=["audience"])


@router.get("/predictions")
async def attendance_predictions():
    """Predicted attendance for upcoming home fixtures."""
    return _attendance_predictions()


@router.get("/fan-segments")
async def fan_segments():
    """Fan segmentation by geography, loyalty, spending."""
    return _fan_segments()


@router.get("/demand-heatmap")
async def demand_heatmap():
    """Stadium zone demand heatmap data."""
    zones = ["North Stand", "South Stand", "East Stand", "West Stand", "Family Stand", "Hospitality"]
    return [
        {"zone": z, "demand_score": 70 + (i * 5) % 30, "occupancy_pct": 75 + (i * 3) % 20}
        for i, z in enumerate(zones)
    ]
