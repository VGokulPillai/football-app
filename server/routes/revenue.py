"""Revenue optimization and ticket marketing API."""
from typing import Optional

from fastapi import APIRouter, Query
from server.data.mock_data import _revenue_projections, get_matchday_insights, _ml_revenue_strategies_global

router = APIRouter(prefix="/revenue", tags=["revenue"])


@router.get("/projections")
async def revenue_projections():
    """Projected revenue by fixture."""
    return _revenue_projections()


@router.get("/recommendations")
async def marketing_recommendations():
    """Ticket marketing and pricing recommendations."""
    return [
        {"fixture": "Villarreal", "action": "Targeted promotion", "segment": "Matchday Casual",
         "channel": "Email + Social", "expected_lift_pct": 12},
        {"fixture": "Atletico Madrid", "action": "Upsell hospitality", "segment": "Loyal Socis",
         "channel": "In-app", "expected_lift_pct": 8},
        {"fixture": "Real Madrid", "action": "Premium pricing", "segment": "All",
         "channel": "N/A", "expected_lift_pct": 15},
    ]


@router.get("/ml-strategies")
async def ml_revenue_strategies():
    """Platform ML / analytics strategies to grow matchday revenue."""
    return {"strategies": _ml_revenue_strategies_global(), "source": "platform_model"}


def _find_home_revenue_row(fixture_id: str) -> Optional[dict]:
    data = get_matchday_insights()
    rows = data.get("upcoming_home_revenue") or []
    for r in rows:
        if str(r.get("fixture_id")) == str(fixture_id):
            return r
    return rows[0] if rows else None


@router.post("/simulate")
async def simulate_pricing(
    fixture_id: str = Query(..., description="Fixture id from matchday insights e.g. f2"),
    price_change_pct: float = Query(..., description="Percent change to average ticket price, e.g. 5 or -3"),
):
    """
    What-if pricing: uses fixture baseline from matchday insights + elasticity priors
    (attendance vs price, hospitality less elastic).
    """
    row = _find_home_revenue_row(fixture_id)
    base = float(row["projected_revenue_m"]) if row else 3.5
    opp = str(row.get("opponent", "Home fixture")) if row else "Home fixture"
    ticket_part = float(row.get("ticket_revenue", base * 0.62)) if row else base * 0.62
    hosp_part = float(row.get("hospitality", base * 0.24)) if row else base * 0.24
    conc_part = float(row.get("concessions", base * 0.14)) if row else base * 0.14

    # Elasticity priors (demo ML calibration — documented for Genie / UI)
    att_elasticity_per_1pct_price = -2.5  # % points attendance per +1% ticket price
    att_delta_pct = att_elasticity_per_1pct_price * price_change_pct
    hosp_price_pass_through = 0.35  # hospitality follows price weakly

    ticket_mult = max(0.5, (1 + att_delta_pct / 100) * (1 + price_change_pct / 100))
    hosp_mult = max(0.85, 1 + (price_change_pct / 100) * hosp_price_pass_through)
    conc_mult = max(0.7, (1 + att_delta_pct / 100) * (1 + min(price_change_pct, 0) / 200))

    new_ticket = ticket_part * ticket_mult
    new_hosp = hosp_part * hosp_mult
    new_conc = conc_part * conc_mult
    new_rev = new_ticket + new_hosp + new_conc
    rev_delta_pct = ((new_rev - base) / base * 100) if base else 0.0

    explanation = [
        f"Baseline EUR {base:.2f}M for {opp} from platform matchday model (see /executive/matchday-insights).",
        f"Ticket block (~EUR {ticket_part:.2f}M) scaled by attendance factor {(1 + att_delta_pct / 100):.3f} and price factor {(1 + price_change_pct / 100):.3f}.",
        f"Hospitality (~EUR {hosp_part:.2f}M) uses {(hosp_price_pass_through * 100):.0f}% pass-through vs ticket move (less elastic).",
        f"F&B (~EUR {conc_part:.2f}M) tracks footfall (attendance) with small price sensitivity.",
        f"Net revenue change ≈ {rev_delta_pct:+.1f}% at {price_change_pct:+.1f}% ticket price scenario.",
    ]

    if abs(price_change_pct) > 12:
        explanation.append("Warning: beyond ±12% moves enter low-confidence extrapolation on elasticity curve.")

    strategies = _ml_revenue_strategies_global()[:3]
    if row and row.get("demand_tier") == "Medium":
        strategies = [
            {
                "title": "Demand lift for this fixture",
                "expected_revenue_lift_pct": 3.2,
                "rationale": f"Medium demand vs {opp} — early-bird + family bundles before peak selling window.",
                "owner": "Marketing",
            }
        ] + strategies[:2]

    return {
        "fixture_id": fixture_id,
        "opponent": opp,
        "base_revenue_m": round(base, 3),
        "simulated_revenue_m": round(new_rev, 3),
        "price_change_pct": price_change_pct,
        "estimated_attendance_impact_pct": round(att_delta_pct, 2),
        "estimated_revenue_impact_pct": round(rev_delta_pct, 2),
        "revenue_delta_m": round(new_rev - base, 3),
        "explanation": explanation,
        "ml_growth_strategies": strategies,
        "recommendation": "High risk — test on single block first" if abs(price_change_pct) > 12
        else "Within typical elasticity band" if abs(price_change_pct) <= 8
        else "Proceed with A/B on secondary blocks",
    }
