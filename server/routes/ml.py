"""ML prediction API - attendance, injury risk, match predictions."""
from fastapi import APIRouter, Query
from pydantic import BaseModel
from typing import List, Optional
from server.ml_inference import (
    predict_attendance,
    predict_injury_risk,
    get_match_predictions,
)

router = APIRouter(prefix="/ml", tags=["ml"])


class AttendancePredictRequest(BaseModel):
    opponent_tier: int = 2  # 1=big, 2=medium, 3=small
    is_weekend: bool = True
    temp_c: float = 12.0
    is_rain: bool = False
    competition: str = "La Liga"


class InjuryRiskRequest(BaseModel):
    training_load: float
    fatigue: float
    matches_7d: int = 0
    minutes_7d: int = 0


@router.post("/predict-attendance")
async def ml_predict_attendance(req: AttendancePredictRequest):
    """Predict matchday attendance from fixture and weather features."""
    return await predict_attendance(
        opponent_tier=req.opponent_tier,
        is_weekend=req.is_weekend,
        temp_c=req.temp_c,
        is_rain=req.is_rain,
        competition=req.competition,
    )


@router.post("/predict-injury-risk")
async def ml_predict_injury_risk(req: InjuryRiskRequest):
    """Predict player injury risk from workload and fatigue."""
    return await predict_injury_risk(
        training_load=req.training_load,
        fatigue=req.fatigue,
        matches_7d=req.matches_7d,
        minutes_7d=req.minutes_7d,
    )


@router.get("/match-predictions")
async def ml_match_predictions(
    fixture_id: Optional[int] = Query(None),
):
    """Get match outcome predictions from API-Football (ML-enhanced)."""
    predictions = await get_match_predictions(fixture_id)
    return {"predictions": predictions, "source": "api-football"}


def _formation_catalog() -> list[dict]:
    return [
        {"id": "4231", "label": "4-2-3-1", "bias": "neutral", "note": "Balanced rest-defence; strong central access."},
        {"id": "433", "label": "4-3-3", "bias": "attacking", "note": "Extra width — good vs high press to play through/out."},
        {"id": "352", "label": "3-5-2", "bias": "neutral", "note": "Overload midfield; wing-backs stretch lines."},
        {"id": "541", "label": "5-4-1", "bias": "defensive", "note": "Low block + compact lines; counters via lone forward."},
    ]


def _ml_recommend_formation(minute: int, current_id: str) -> tuple[str, str]:
    """Demo ML: suggest shape vs opponent press narrative."""
    if minute > 0:
        return current_id, "In-simulation: keep chosen shape unless fatigue triggers a profile shift (see subs)."
    opp_press = True
    if opp_press and current_id in ("541", "532"):
        return current_id, "Low block already matches aggressive opponent press risk."
    if opp_press and current_id == "4231":
        return "433", "Model leans slightly more attacking width (4-3-3) vs simulated high press — easier outlets wide."
    if opp_press:
        return "433", "Width helps break pressure; 4-3-3 edges xThreat +0.04 in calibration vs this opponent profile."
    return "4231", "Standard control shape maximizes central progression in this scenario."


def _sub_profile_for_slot(slot: int) -> str:
    """Map pitch slot index (4231-style board) to suggested replacement profile."""
    if slot in (2, 3, 5, 6, 10):
        return "defensive"
    if slot in (0, 1, 4, 7, 8, 9):
        return "attacking"
    return "neutral"


def _parse_slot_roles(raw: Optional[str]) -> Optional[list[str]]:
    """11 chars A/D/N = client-derived tactical role per home slot index."""
    if not raw or len(raw) != 11:
        return None
    out: list[str] = []
    for ch in raw.strip().upper():
        if ch not in ("A", "D", "N"):
            return None
        out.append(ch)
    return out


def _profile_from_slot_role(ch: str) -> str:
    if ch == "D":
        return "defensive"
    if ch == "A":
        return "attacking"
    return "neutral"


def _xi_bias_from_roles(roles: list[str]) -> str:
    ca, cd = roles.count("A"), roles.count("D")
    if ca > cd + 1:
        return "attacking"
    if cd > ca + 1:
        return "defensive"
    return "neutral"


@router.get("/tactical-live")
async def tactical_live_recommendations(
    minute: int = Query(0, ge=0, le=120, description="Simulated match minute 0–120"),
    subs_used: int = Query(0, ge=0, le=5),
    formation_id: str = Query("4231", description="4231|433|352|541"),
    fatigue_slots: Optional[str] = Query(
        None,
        description="Comma-separated tired slot indices from client (e.g. 6,5)",
    ),
    slot_roles: Optional[str] = Query(
        None,
        description="Exactly 11 chars A/D/N: tactical lean per home slot from current XI on pitch",
    ),
):
    """
    Demo tactical / workload model outputs for the live planning UI.
    Refresh as the match clock advances or after subs.
    """
    phase = (
        "first_half" if minute < 45
        else "half_time" if minute == 45
        else "second_half" if minute <= 90
        else "stoppage"
    )
    fatigue_idx = min(1.0, minute / 90 + subs_used * 0.04)

    def _slot_fatigue_pct(slot: int, salt: int) -> dict:
        """Deterministic per-slot workload (demo): mids / wide mids run hotter."""
        workload = {5: 14, 6: 14, 7: 10, 8: 10, 4: 8, 9: 8, 2: 6, 3: 6}.get(slot, 5)
        base = 12 + minute * 0.82 + workload
        jitter = (slot * 19 + minute * 5 + salt * 37) % 22
        # Fresh subs slightly ease squad-wide load in the model
        pct = int(round(max(8, min(100, base + jitter - subs_used * 1.2))))
        return {"slot": slot, "fatigue_pct": pct, "alert": pct >= 72}

    home_fatigue_by_slot = [_slot_fatigue_pct(i, 0) for i in range(11)]
    away_fatigue_by_slot = [_slot_fatigue_pct(i, 1) for i in range(11)]
    priority_home_sub_slots = [
        x["slot"] for x in sorted(home_fatigue_by_slot, key=lambda x: -x["fatigue_pct"])[:3]
    ]

    recs = []

    if minute < 20:
        recs.append({
            "id": "press",
            "title": "Controlled press on opponent buildup",
            "detail": "Model: opponent pass completion drops 6% when wide forwards pinch in after 15′ (training-set prior).",
            "confidence": 0.78,
            "type": "defensive",
        })
    if 25 <= minute < 40:
        recs.append({
            "id": "overload",
            "title": "Overload left channel",
            "detail": "Expected threat index +0.12 vs average when LB tucks inside and LW holds width (last 5 similar fixtures).",
            "confidence": 0.71,
            "type": "attacking",
        })
    if minute >= 55 and fatigue_idx > 0.55:
        recs.append({
            "id": "sub_fresh",
            "title": "Introduce fresh legs in midfield",
            "detail": f"Fatigue proxy {fatigue_idx:.0%} — dual #8 distance covered −11% vs season avg; sub improves xThreat +0.08 in sim.",
            "confidence": 0.84,
            "type": "substitution",
        })
    if minute >= 70 and subs_used < 3:
        recs.append({
            "id": "impact_sub",
            "title": "Impact sub wide",
            "detail": "Late-game model: direct winger vs tired full-back lifts big-chance rate 0.14 → 0.21 per 15′ block.",
            "confidence": 0.69,
            "type": "substitution",
        })
    if minute >= 80:
        recs.append({
            "id": "see_out",
            "title": "Compact block + rest defence",
            "detail": "Protect lead: narrow front three, trigger press only on backward pass to CB (concede xGA −0.04 in hold-out sim).",
            "confidence": 0.73,
            "type": "defensive",
        })

    if not recs:
        recs.append({
            "id": "maintain",
            "title": "Maintain structure",
            "detail": "No high-confidence deviation from baseline shape at this phase; monitor duel win % in wide areas.",
            "confidence": 0.62,
            "type": "neutral",
        })

    fid = formation_id.strip().lower().replace("-", "")
    if fid == "4-2-3-1":
        fid = "4231"
    if fid not in ("4231", "433", "352", "541"):
        fid = "4231"

    ml_form, ml_form_note = _ml_recommend_formation(minute, fid)
    current_meta = next((x for x in _formation_catalog() if x["id"] == fid), _formation_catalog()[0])

    tired_slots: List[int] = []
    if fatigue_slots:
        for part in fatigue_slots.split(","):
            part = part.strip()
            if part.isdigit():
                v = int(part)
                if 0 <= v <= 10:
                    tired_slots.append(v)
    if not tired_slots:
        tired_slots = list(priority_home_sub_slots[:3])

    roles_list = _parse_slot_roles(slot_roles)
    xi_tactical_bias = _xi_bias_from_roles(roles_list) if roles_list else None

    sub_suggestions: list[dict] = []
    # Typed subs appear once the sim has run long enough for fatigue signal (pre-kick = formation focus only).
    if minute >= 18:
        for rank, s in enumerate(tired_slots[:3]):
            if minute < 40 and rank > 0:
                continue
            if roles_list is not None and 0 <= s < len(roles_list):
                prof = _profile_from_slot_role(roles_list[s])
            else:
                prof = _sub_profile_for_slot(s)
            if prof == "defensive":
                detail = (
                    f"Slot {s} is defence-biased with your current XI — model prefers a like-for-like or holding "
                    "profile from the bench (stabilize rest defence, duels)."
                )
            elif prof == "attacking":
                detail = (
                    f"Slot {s} is attack-biased with your current XI — fresh wide or #9 profile from bench lifts "
                    "direct threat vs tired legs (sim)."
                )
            else:
                detail = (
                    f"Slot {s} is neutral/hybrid on the pitch — box-to-box or balanced bench option preserves shape "
                    "while refreshing metres covered."
                )
            conf = 0.82 - rank * 0.06 - (0.05 if subs_used >= 3 else 0)
            sub_suggestions.append({
                "id": f"sub-{s}-{rank}",
                "take_off_slot": s,
                "bench_profile": prof,
                "detail": detail,
                "confidence": round(max(0.55, min(0.92, conf)), 2),
                "label": "Defensive sub" if prof == "defensive" else "Attacking sub" if prof == "attacking" else "Neutral / flexible sub",
            })

    stream = "Live planning feed — updates with clock, formation, fatigue, and current XI placement (slot roles)."
    if xi_tactical_bias:
        stream = (
            f"XI tactical lean from current player positions: {xi_tactical_bias}. "
            "Swap or sub — typed suggestions follow each slot’s A/D/N profile."
        )

    return {
        "match_minute": minute,
        "phase": phase,
        "fatigue_index": round(fatigue_idx, 2),
        "subs_used": subs_used,
        "formation_id": fid,
        "formation_bias": current_meta.get("bias", "neutral"),
        "xi_tactical_bias": xi_tactical_bias,
        "formation_options": _formation_catalog(),
        "ml_recommended_formation_id": ml_form,
        "ml_formation_rationale": ml_form_note,
        "home_fatigue_by_slot": home_fatigue_by_slot,
        "away_fatigue_by_slot": away_fatigue_by_slot,
        "priority_home_sub_slots": priority_home_sub_slots,
        "sub_suggestions": sub_suggestions,
        "recommendations": recs[:4],
        "stream_note": stream,
    }
