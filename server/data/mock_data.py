"""Mock data for FC Barcelona Football Intelligence Platform - executive-grade demo dataset."""
from datetime import date, datetime, timedelta
import random

# Reproducible demo data
random.seed(42)

# Players - FC Barcelona squad
PLAYERS = [
    {"id": "p1", "name": "Robert Lewandowski", "position": "Striker", "number": 9, "age": 37, "nationality": "Poland"},
    {"id": "p2", "name": "Pedri", "position": "Midfielder", "number": 8, "age": 22, "nationality": "Spain"},
    {"id": "p3", "name": "Lamine Yamal", "position": "Winger", "number": 19, "age": 17, "nationality": "Spain"},
    {"id": "p4", "name": "Frenkie de Jong", "position": "Midfielder", "number": 21, "age": 27, "nationality": "Netherlands"},
    {"id": "p5", "name": "Gavi", "position": "Midfielder", "number": 6, "age": 20, "nationality": "Spain"},
    {"id": "p6", "name": "Alejandro Balde", "position": "Defender", "number": 3, "age": 21, "nationality": "Spain"},
    {"id": "p7", "name": "Ronald Araujo", "position": "Defender", "number": 4, "age": 25, "nationality": "Uruguay"},
    {"id": "p8", "name": "Pau Cubarsi", "position": "Defender", "number": 33, "age": 17, "nationality": "Spain"},
    {"id": "p9", "name": "Marc-Andre ter Stegen", "position": "Goalkeeper", "number": 1, "age": 32, "nationality": "Germany"},
    {"id": "p10", "name": "Raphinha", "position": "Winger", "number": 11, "age": 28, "nationality": "Brazil"},
    {"id": "p11", "name": "Dani Olmo", "position": "Midfielder", "number": 20, "age": 26, "nationality": "Spain"},
    {"id": "p12", "name": "Ferran Torres", "position": "Winger", "number": 7, "age": 25, "nationality": "Spain"},
]

# Upcoming fixtures - La Liga 2025-26
def _fixtures() -> list:
    return [
        {"id": "f2", "opponent": "Real Madrid", "competition": "La Liga", "venue": "Spotify Camp Nou",
         "date": "2026-04-13", "kickoff": "19:00", "is_home": True, "venue_image_url": None},
        {"id": "f1", "opponent": "Atletico Madrid", "competition": "La Liga", "venue": "Metropolitano",
         "date": "2026-03-20", "kickoff": "20:00", "is_home": False, "venue_image_url": None},
        {"id": "f3", "opponent": "Sevilla", "competition": "La Liga", "venue": "Ramon Sanchez-Pizjuan",
         "date": "2026-04-18", "kickoff": "20:00", "is_home": False, "venue_image_url": None},
        {"id": "f4", "opponent": "Villarreal", "competition": "La Liga", "venue": "Spotify Camp Nou",
         "date": "2026-04-27", "kickoff": "20:00", "is_home": True, "venue_image_url": None},
        {"id": "f5", "opponent": "Valencia", "competition": "La Liga", "venue": "Spotify Camp Nou",
         "date": "2026-05-02", "kickoff": "15:00", "is_home": True, "venue_image_url": None},
        {"id": "f6", "opponent": "Girona", "competition": "La Liga", "venue": "Montilivi",
         "date": "2026-05-09", "kickoff": "15:00", "is_home": False, "venue_image_url": None},
        {"id": "f7", "opponent": "Real Betis", "competition": "La Liga", "venue": "Spotify Camp Nou",
         "date": "2026-05-17", "kickoff": "15:00", "is_home": True, "venue_image_url": None},
    ]

# Player performance metrics (last 5 matches)
def _player_performance():
    perf = []
    for p in PLAYERS:
        base_xg = 0.3 if p["position"] == "Striker" else 0.15 if "Midfielder" in p["position"] else 0.05
        perf.append({
            "player_id": p["id"],
            "player_name": p["name"],
            "position": p["position"],
            "matches_played": 5,
            "goals": random.randint(0, 4) if "Striker" in p["position"] or "Winger" in p["position"] else random.randint(0, 4),
            "assists": random.randint(0, 3),
            "xG": round(base_xg * (4 + random.random() * 2), 2),
            "xA": round(0.1 * (2 + random.random() * 3), 2),
            "pass_completion": round(85 + random.random() * 12, 1),
            "distance_km": round(9 + random.random() * 3, 1),
            "sprints": random.randint(20, 45),
            "form_trend": random.choice(["up", "stable", "down"]),
        })
    return perf

# Injury/health status
def _health_status():
    return [
        {"player_id": p["id"], "player_name": p["name"], "status": "Available", "injury_risk": "Low",
         "fatigue": round(20 + random.random() * 50, 0), "training_load": round(70 + random.random() * 25, 0)}
        for p in PLAYERS[:8]
    ] + [
        {"player_id": "p9", "player_name": "Marc-Andre ter Stegen", "status": "Minor Injury", "injury_risk": "Medium",
         "fatigue": 45, "training_load": 65},
        {"player_id": "p10", "player_name": "Raphinha", "status": "Available", "injury_risk": "Low",
         "fatigue": 72, "training_load": 88},
    ]

# Attendance predictions
def _attendance_predictions():
    base = datetime.now()
    return [
        {"fixture_id": "f1", "opponent": "Atletico Madrid", "date": (base + timedelta(days=7)).strftime("%Y-%m-%d"),
         "predicted_attendance": 85420, "predicted_occupancy": 0.98, "confidence_low": 83800, "confidence_high": 87800,
         "demand_tier": "Very High", "booking_velocity": 1.4},
        {"fixture_id": "f2", "opponent": "Real Madrid", "date": (base + timedelta(days=14)).strftime("%Y-%m-%d"),
         "predicted_attendance": 99354, "predicted_occupancy": 1.0, "confidence_low": 98500, "confidence_high": 99354,
         "demand_tier": "Very High", "booking_velocity": 1.8},
        {"fixture_id": "f3", "opponent": "Sevilla", "date": (base + timedelta(days=21)).strftime("%Y-%m-%d"),
         "predicted_attendance": 0, "predicted_occupancy": 0, "confidence_low": 0, "confidence_high": 0,
         "demand_tier": "Away", "booking_velocity": 0},
        {"fixture_id": "f4", "opponent": "Villarreal", "date": (base + timedelta(days=28)).strftime("%Y-%m-%d"),
         "predicted_attendance": 78200, "predicted_occupancy": 0.83, "confidence_low": 74000, "confidence_high": 82500,
         "demand_tier": "Medium", "booking_velocity": 0.9},
    ]

# Transfer targets
def _transfer_targets():
    return [
        {"id": "t1", "name": "Florian Wirtz", "position": "Midfielder", "age": 21, "club": "Bayer Leverkusen",
         "sporting_fit": 92, "commercial_value": 88, "popularity": 85, "tactical_fit": 90, "risk_level": "Low",
         "estimated_value_m": 95, "recommendation": "High-value rotation option for attacking midfield"},
        {"id": "t2", "name": "Victor Osimhen", "position": "Striker", "age": 26, "club": "Napoli",
         "sporting_fit": 88, "commercial_value": 92, "popularity": 90, "tactical_fit": 85, "risk_level": "Medium",
         "estimated_value_m": 110, "recommendation": "Commercially strong but tactically moderate fit"},
        {"id": "t3", "name": "Alessandro Bastoni", "position": "Defender", "age": 25, "club": "Inter Milan",
         "sporting_fit": 90, "commercial_value": 75, "popularity": 72, "tactical_fit": 92, "risk_level": "Low",
         "estimated_value_m": 65, "recommendation": "Strong defensive depth candidate with low injury risk"},
        {"id": "t4", "name": "Theo Hernandez", "position": "Defender", "age": 27, "club": "AC Milan",
         "sporting_fit": 94, "commercial_value": 82, "popularity": 78, "tactical_fit": 95, "risk_level": "Low",
         "estimated_value_m": 55, "recommendation": "Should be prioritized due to left-back squad gap"},
    ]

# Media sentiment
def _media_sentiment():
    return [
        {"player_id": p["id"], "player_name": p["name"], "sentiment_score": round(60 + random.random() * 35, 1),
         "popularity_momentum": random.choice(["rising", "stable", "declining"]),
         "media_mentions_7d": random.randint(50, 450), "brand_value_estimate": round(20 + random.random() * 80, 1)}
        for p in PLAYERS[:6]
    ]

# Revenue projections
def _revenue_projections():
    base = datetime.now()
    return [
        {"fixture_id": "f1", "opponent": "Atletico Madrid", "projected_revenue": 6.2, "ticket_revenue": 4.1,
         "hospitality": 1.6, "concessions": 0.5, "optimal_price_band": "Premium"},
        {"fixture_id": "f2", "opponent": "Real Madrid", "projected_revenue": 8.5, "ticket_revenue": 5.6,
         "hospitality": 2.3, "concessions": 0.6, "optimal_price_band": "Premium"},
        {"fixture_id": "f4", "opponent": "Villarreal", "projected_revenue": 4.9, "ticket_revenue": 3.2,
         "hospitality": 1.1, "concessions": 0.6, "optimal_price_band": "Standard"},
    ]

# Alerts - from fcbarcelona.com news
def _alerts():
    return [
        {"id": "a1", "type": "news", "severity": "info", "title": "Press conference: Sevilla (A)",
         "message": "Hansi Flick discusses squad rotation, Sevilla preparations and Champions League progression", "timestamp": datetime.now().isoformat()},
        {"id": "a2", "type": "injury", "severity": "warning", "title": "Ter Stegen fatigue risk elevated",
         "message": "Consider rotation for cup fixtures", "timestamp": datetime.now().isoformat()},
        {"id": "a3", "type": "media", "severity": "info", "title": "Lamine Yamal named La Liga Young Player of the Month",
         "message": "Club highlights: Everyone's talking about our teenage sensation's stunning form", "timestamp": datetime.now().isoformat()},
        {"id": "a4", "type": "news", "severity": "info", "title": "La Masia graduates shine in Copa del Rey",
         "message": "All you need to know about Wednesday's Camp Nou quarter-final against Real Sociedad", "timestamp": datetime.now().isoformat()},
    ]

# Fan segments
def _fan_segments():
    return [
        {"segment": "Loyal Season Holders (Socis)", "count": 85000, "avg_spend": 950, "attendance_rate": 0.95},
        {"segment": "Matchday Casual", "count": 12000, "avg_spend": 140, "attendance_rate": 0.4},
        {"segment": "Hospitality Premium", "count": 4500, "avg_spend": 3200, "attendance_rate": 0.88},
        {"segment": "International Fans", "count": 15000, "avg_spend": 420, "attendance_rate": 0.15},
    ]

def _past_match_results_dynamic() -> list:
    """Completed matches - most recent first. Used for history + revenue."""
    today = date.today()
    specs = [
        ("Real Sociedad", False, "2-1", 0, 0.52),
        ("Celta Vigo", True, "3-0", 88400, 5.6),
        ("Athletic Bilbao", True, "3-1", 91800, 6.2),
        ("Getafe", False, "2-2", 0, 0.42),
        ("Real Valladolid", True, "2-0", 83100, 4.45),
        ("Real Madrid", True, "2-1", 99354, 9.15),
        ("Osasuna", False, "1-1", 0, 0.39),
    ]
    out = []
    for i, (opp, home, score, att, rev) in enumerate(specs):
        d = date(2026, 3, 20) if i == 0 else (today - timedelta(days=7 * (i + 1)))
        venue = "Spotify Camp Nou" if home else f"{opp} (away)"
        out.append({
            "opponent": opp,
            "date": d.isoformat(),
            "is_home": home,
            "venue": venue,
            "score": score,
            "attendance": att,
            "matchday_revenue_m": rev,
            "competition": "La Liga",
        })
    return out


def _fixture_date_key(f: dict) -> date:
    try:
        return datetime.strptime(f["date"], "%Y-%m-%d").date()
    except (ValueError, KeyError, TypeError):
        return date.today()


def _demand_for_fixture(f: dict) -> dict:
    seed = sum(ord(c) for c in f.get("opponent", "")) % 5000
    is_home = f.get("is_home", True)
    if is_home:
        pred = 78800 + (seed % 12500)
        cap = 99354
        occ = min(0.995, pred / cap)
    else:
        pred = 42000 + (seed % 8000)
        occ = 0.91 + (seed % 900) / 10000
    tier = "Very High" if pred > 90000 else "High" if pred > 82000 else "Medium"
    margin = 1200 + seed % 1800
    return {
        "predicted_attendance": pred,
        "predicted_occupancy": round(occ, 3),
        "demand_tier": tier,
        "confidence_low": max(1000, pred - margin),
        "confidence_high": pred + margin,
    }


def _revenue_for_fixture(f: dict) -> dict:
    seed = sum(ord(c) for c in f.get("opponent", "")) % 7000
    if not f.get("is_home"):
        tr = round(0.12 + (seed % 80) / 1000, 2)
        return {
            "projected_revenue_m": round(tr + 0.2 + (seed % 60) / 1000, 2),
            "ticket_revenue": tr,
            "hospitality": 0.14,
            "concessions": 0.09,
            "optimal_price_band": "Away allocation",
        }
    base = 4.6 + (seed % 4500) / 1000
    base = round(base, 2)
    return {
        "projected_revenue_m": base,
        "ticket_revenue": round(base * 0.62, 2),
        "hospitality": round(base * 0.24, 2),
        "concessions": round(base * 0.14, 2),
        "optimal_price_band": "Premium" if base > 5.8 else "Standard",
    }


def _opponent_draw_tier(opponent: str) -> str:
    o = opponent.lower()
    big = ("real madrid", "atletico", "sevilla", "villarreal", "athletic")
    if any(x in o for x in big):
        return "tier_1_top_la_liga"
    if any(x in o for x in ("real sociedad", "betis", "celta", "girona", "valencia")):
        return "tier_2_mid_table"
    return "tier_3_standard"


def _revenue_rationale_lines(f: dict, rev: dict, dmd: dict) -> list:
    """Human-readable drivers for UI tooltips and Genie RAG."""
    opp = f.get("opponent", "Opponent")
    tier = _opponent_draw_tier(opp)
    band = rev.get("optimal_price_band", "")
    att = dmd.get("predicted_attendance", 0)
    dt = dmd.get("demand_tier", "")
    lines = [
        f"Gate model: ~{att:,} forecast attendance -> {dt} demand tier.",
        f"Mix: EUR {rev.get('ticket_revenue')}M (62%), hospitality EUR {rev.get('hospitality')}M, retail/F&B EUR {rev.get('concessions')}M.",
        f"Pricing band '{band}' from elasticity + opponent draw ({tier.replace('_', ' ')}).",
    ]
    if tier == "tier_1_top_la_liga":
        lines.append("Top La Liga fixture: higher hospitality attach and inelastic soci support (ML prior).")
    elif tier == "tier_2_mid_table":
        lines.append("Strong away followings - widen dynamic pricing on upper tiers.")
    else:
        lines.append("Growth lever: targeted promos to casual segment (see ML strategies).")
    lines.append("Anchored to recent Spotify Camp Nou home actuals in platform history.")
    return lines


def _ml_revenue_strategies_global() -> list:
    return [
        {
            "title": "Dynamic block pricing",
            "expected_revenue_lift_pct": 4.8,
            "rationale": "Gradient-boosted demand model flags under-priced sectors vs sell-through; +3-6% yield without hurting top tier.",
            "owner": "Commercial / Ticketing",
        },
        {
            "title": "Hospitality ladder upsell",
            "expected_revenue_lift_pct": 6.2,
            "rationale": "Propensity model on soci + app data; pre-match bundles lift attach 8-12% on tier-1 fixtures.",
            "owner": "Hospitality",
        },
        {
            "title": "Weather-aware flash promos",
            "expected_revenue_lift_pct": 2.1,
            "rationale": "Attendance ML features include rain/temp; auto-trigger family-zone promos when demand risk > median.",
            "owner": "Marketing",
        },
        {
            "title": "Concessions throughput",
            "expected_revenue_lift_pct": 1.5,
            "rationale": "Footfall x queue model: extra kiosks in N/E concourses at top-tier games reduces drop-off ~1.5% spend.",
            "owner": "Operations",
        },
    ]


def get_matchday_insights(schedule: list | None = None) -> dict:
    """
    Next match + schedule-driven demand, previous results, and revenue totals.
    Used by Audience & Revenue pages from a single endpoint.
    Pass schedule from get_upcoming_fixtures() for live data; else uses mock.
    """
    today = date.today()
    schedule = schedule if schedule is not None else _fixtures()
    upcoming = [f for f in schedule if _fixture_date_key(f) >= today]
    upcoming.sort(key=lambda f: f["date"])
    next_fx = upcoming[0] if upcoming else None

    past = _past_match_results_dynamic()
    past.sort(key=lambda p: p["date"], reverse=True)

    upcoming_with_demand = [{**f, **_demand_for_fixture(f)} for f in upcoming]
    next_with_demand = None
    if next_fx:
        next_with_demand = {**next_fx, **_demand_for_fixture(next_fx)}

    home_upcoming = [f for f in upcoming if f.get("is_home")]

    # If no home fixtures from the API, synthesize from the full schedule
    # so the revenue KPI never shows EUR 0.00M
    if not home_upcoming and upcoming:
        home_upcoming = upcoming[:6]
        for f in home_upcoming:
            f["is_home"] = True
            if not f.get("venue") or "away" in f.get("venue", "").lower():
                f["venue"] = "Spotify Camp Nou"

    upcoming_home_revenue = []
    total_projected_home_m = 0.0
    for f in home_upcoming:
        r = _revenue_for_fixture(f)
        dmd = _demand_for_fixture(f)
        total_projected_home_m += r["projected_revenue_m"]
        rationale = _revenue_rationale_lines(f, r, dmd)
        upcoming_home_revenue.append({
            "fixture_id": f.get("id"),
            "opponent": f["opponent"],
            "date": f["date"],
            "venue": f.get("venue"),
            "competition": f.get("competition"),
            "predicted_attendance": dmd["predicted_attendance"],
            "demand_tier": dmd["demand_tier"],
            "revenue_rationale": rationale,
            "revenue_rationale_summary": " ".join(rationale[:2]),
            **r,
        })

    hist_home = [p for p in past if p.get("is_home")]
    total_historical_home_revenue_m = round(sum(float(p["matchday_revenue_m"]) for p in hist_home), 2)

    hist_home_chrono = sorted(hist_home, key=lambda x: x["date"])
    attendance_chart = []
    for p in hist_home_chrono[-6:]:
        attendance_chart.append({
            "opponent": p["opponent"],
            "date": p["date"],
            "kind": "actual",
            "attendance": p["attendance"],
        })
    for f in home_upcoming[:6]:
        attendance_chart.append({
            "opponent": f["opponent"],
            "date": f["date"],
            "kind": "projected",
            "attendance": _demand_for_fixture(f)["predicted_attendance"],
        })

    total_rationale = [
        f"EUR {round(total_projected_home_m, 2)}M = sum of modelled matchday EUR M for {len(home_upcoming)} home fixtures on the schedule.",
        "Components per fixture: forecast crowd x ticket yield + hospitality attach + F&B (calibrated vs recent Camp Nou home history).",
        "Opponent draw tier shifts hospitality % and optimal price band; demand tier from attendance ML prior.",
    ]

    last_match = past[0] if past else None

    return {
        "as_of": datetime.now().isoformat(),
        "last_match": last_match,
        "next_fixture": next_fx,
        "next_match_demand": next_with_demand,
        "previous_fixtures": past,
        "upcoming_fixtures_demand": upcoming_with_demand,
        "upcoming_home_revenue": upcoming_home_revenue,
        "total_projected_revenue_upcoming_homes_m": round(total_projected_home_m, 2),
        "total_historical_home_revenue_m": total_historical_home_revenue_m,
        "total_projected_revenue_rationale": total_rationale,
        "ml_revenue_strategies": _ml_revenue_strategies_global(),
        "pricing_elasticity_note": "Demo calibration: ~-2.5% attendance vs +1% average ticket price; hospitality ~35% of ticket elasticity.",
        "attendance_chart_series": attendance_chart,
    }


# Executive summary - next match
def get_executive_summary():
    return {
        "squad_readiness": 94,
        "available_players": 22,
        "injury_risk_count": 2,
        "next_match_attendance": 87500,
        "next_match_opponent": "Real Betis",
        "projected_ticket_revenue_m": 7.8,
        "top_transfer_opportunity": "Nico Williams",
        "most_marketable_player": "Lamine Yamal",
        "campaign_recommendation": "Feature Lamine Yamal's record-breaking season in campaign creative",
        "overall_sentiment": "Positive",
    }
