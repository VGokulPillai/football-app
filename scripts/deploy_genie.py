"""
Manchester United — Genie Space Deployment Script

Creates (or updates) the Genie Space via the Databricks SDK.
Run this AFTER the DLT pipelines have created the gold tables.

Usage:
    python scripts/deploy_genie.py --profile <profile> --warehouse <warehouse_id> --catalog main --schema mufc

After running, open the Genie Space URL to add tables and instructions via the UI.
"""
from __future__ import annotations

import argparse
import json
import sys

try:
    from databricks.sdk import WorkspaceClient
    from databricks.sdk.service.dashboards import GenieSpace
except ImportError:
    print("ERROR: databricks-sdk not installed. Run: pip install databricks-sdk")
    sys.exit(1)

GENIE_TITLE = "Manchester United Football Intelligence"
GENIE_DESCRIPTION = (
    "AI-powered conversational analytics for Manchester United — "
    "matchday performance, commercial revenue, weather impact, fan attendance, "
    "and operational health. Ask questions in plain English, no SQL needed."
)

GOLD_TABLES = [
    ("gold_matchday_intelligence",      "Master match-day view: weather joined with commercial KPIs per day"),
    ("gold_commercial_summary",         "Daily sales KPIs with rolling averages and cumulative revenue by region"),
    ("gold_daily_sales_kpi",            "Raw daily revenue, orders, avg order value by CRM region"),
    ("gold_weather_attendance_impact",  "Weather conditions and modelled attendance impact at Old Trafford"),
    ("gold_operational_health_iot",     "IoT device health aligned to commercial regions"),
]

INSTRUCTIONS = """
## Manchester United Football Intelligence — Genie Guide

You are an AI analyst for Manchester United FC. You help the commercial,
sporting, and operations teams make data-driven decisions quickly.

### Available Data
- **Match Day Intelligence** (gold_matchday_intelligence): Weather + commercial KPIs joined per day
- **Commercial / Sales** (gold_commercial_summary, gold_daily_sales_kpi): Revenue, orders, regions
- **Weather & Attendance** (gold_weather_attendance_impact): How weather affects Old Trafford attendance
- **Operational IoT** (gold_operational_health_iot): Stadium and facility device readings

### Key Business Terms
- **attendance_impact_pct**: Estimated % change in attendance vs average due to weather (negative = fewer fans)
- **crm_region**: Geographic sales region — UK, Europe, Asia Pacific, Americas, Middle East
- **revenue**: Total commercial revenue in GBP (£)
- **orders**: Number of commercial transactions (merchandise, hospitality, F&B)
- **avg_order_value**: Average spend per transaction in GBP (£)
- **conditions**: Weather classification — clear | cloudy | drizzle | rain
- **matchday_condition_rating**: Summary quality — Excellent | Good | Fair | Poor

### How to Join Tables
- Join weather with sales on event_date = order_date (both calendar dates)
- gold_matchday_intelligence already performs this join — use it for combined queries
- For IoT + commercial questions, use gold_operational_health_iot

### Date Handling
- All dates are UTC
- "Last week" = 7 days before today; "This month" = calendar month to date
- Sort time-series ascending unless asked otherwise

### Formatting
- Show revenue in £ (GBP) with 2 decimal places
- Show percentages with 1 decimal place
"""

CURATED_QUESTIONS = [
    # Commercial
    "What was total revenue last week by region?",
    "Which CRM region has the highest average order value this month?",
    "Show me the revenue trend over the last 30 days",
    "How many orders did we process yesterday?",
    "Compare this month's revenue to last month by region",
    # Weather & Attendance
    "How does rain affect attendance at Old Trafford?",
    "What is today's weather and what attendance impact do we expect?",
    "Show attendance impact by weather condition type",
    "On which days this season did we have the worst weather conditions?",
    # Operations
    "Which IoT devices had the highest readings yesterday?",
    "Show operational health for the last 7 days",
    # Combined
    "Give me a matchday intelligence summary for this week",
    "On rainy days, how does commercial revenue compare to clear days?",
    "What were the top 5 revenue days this season and what was the weather?",
]


def find_existing_space(w: WorkspaceClient) -> str | None:
    """Return space_id if a space with our title already exists."""
    try:
        resp = w.genie.list_spaces()
        for s in (resp.spaces or []):
            if s.title == GENIE_TITLE:
                return s.space_id
    except Exception:
        pass
    return None


def create_or_update_space(w: WorkspaceClient, warehouse_id: str) -> GenieSpace:
    existing_id = find_existing_space(w)
    serialized = json.dumps({"version": 2, "dataSources": {"tables": []}})

    if existing_id:
        print(f"  Updating existing space {existing_id}")
        return w.genie.update_space(
            space_id=existing_id,
            title=GENIE_TITLE,
            description=GENIE_DESCRIPTION,
            warehouse_id=warehouse_id,
            serialized_space=serialized,
        )
    else:
        print("  Creating new Genie Space")
        return w.genie.create_space(
            warehouse_id=warehouse_id,
            serialized_space=serialized,
            title=GENIE_TITLE,
            description=GENIE_DESCRIPTION,
        )


def main() -> None:
    parser = argparse.ArgumentParser(description="Deploy Man United Genie Space")
    parser.add_argument("--profile",   default="fe-vm-serverless-stable", help="Databricks CLI profile")
    parser.add_argument("--warehouse", required=True, help="SQL warehouse ID")
    parser.add_argument("--catalog",   default="main",    help="Unity Catalog catalog")
    parser.add_argument("--schema",    default="mufc",    help="Unity Catalog schema")
    args = parser.parse_args()

    print(f"\n🔴 Manchester United — Genie Space Deployment")
    print(f"   Workspace:  (profile: {args.profile})")
    print(f"   Warehouse:  {args.warehouse}")
    print(f"   Tables:     {args.catalog}.{args.schema}.*\n")

    w = WorkspaceClient(profile=args.profile)

    # Step 1: Create / update the space
    print("Step 1: Creating Genie Space...")
    space = create_or_update_space(w, args.warehouse)
    space_id = space.space_id
    host = w.config.host.rstrip("/")
    space_url = f"{host}/genie/spaces/{space_id}"
    print(f"  ✅ Space ID: {space_id}")
    print(f"  ✅ URL:      {space_url}")

    # Step 2: Print manual steps (tables/instructions must be done via UI)
    print("\nStep 2: Add tables via the Genie UI")
    print(f"  Open: {space_url}")
    print("  Click 'Settings' → 'Data' → 'Add table' and add these tables:")
    print()
    for table, desc in GOLD_TABLES:
        print(f"    {args.catalog}.{args.schema}.{table}")
        print(f"      Description: {desc}")
    print()

    # Step 3: Print instructions to paste
    print("Step 3: Add Instructions via the Genie UI")
    print("  In the space Settings → 'Instructions', paste this:\n")
    print("  " + "\n  ".join(INSTRUCTIONS.strip().splitlines()))
    print()

    # Step 4: Print curated questions
    print("Step 4: Add Curated Questions via the Genie UI")
    print("  In Settings → 'Sample questions', add these:\n")
    for q in CURATED_QUESTIONS:
        print(f"    • {q}")
    print()

    print("=" * 60)
    print(f"✅ Genie Space ready: {space_url}")
    print("   Share this URL with your team.")
    print("   Complete Steps 2–4 in the UI to finish configuration.")
    print("=" * 60)


if __name__ == "__main__":
    main()
