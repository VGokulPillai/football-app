"""Transfer intelligence API."""
from fastapi import APIRouter
from server.data.mock_data import _transfer_targets

router = APIRouter(prefix="/transfers", tags=["transfers"])


@router.get("/targets")
async def transfer_targets():
    """Transfer market opportunities."""
    return _transfer_targets()


@router.get("/targets/{target_id}")
async def get_transfer_target(target_id: str):
    """Single transfer target details."""
    for t in _transfer_targets():
        if t["id"] == target_id:
            return t
    return {"error": "Target not found"}
