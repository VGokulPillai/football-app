# Manchester United — Genie Space Deployment Guide

Deploy a conversational AI analytics space where any team member can ask questions about matchday performance, commercial revenue, weather impact, and operational health — in plain English, no SQL needed.

---

## What Gets Deployed

| Component | Description |
|-----------|-------------|
| **Genie Space** | "Manchester United Football Intelligence" — AI analyst with 15 curated questions |
| **gold_matchday_intelligence** | Weather + commercial KPIs joined per day — the main Genie table |
| **gold_commercial_summary** | Daily sales KPIs with rolling averages and cumulative revenue |
| **gold_operational_health_iot** | IoT device health aligned to commercial regions |
| **gold_weather_attendance_impact** | Weather conditions → modelled attendance impact |
| **gold_daily_sales_kpi** | Raw daily sales by region |

---

## Prerequisites

Before deploying, you need:

- [ ] Databricks workspace with Unity Catalog enabled
- [ ] A SQL Serverless Warehouse (or Classic) — copy its ID from **SQL > Warehouses**
- [ ] Databricks CLI installed: `brew install databricks` (Mac) or see [docs](https://docs.databricks.com/dev-tools/cli/index.html)
- [ ] CLI authenticated: `databricks auth login --host <your-workspace-url>`
- [ ] The DLT pipelines have run at least once (so gold tables exist)

---

## Step 1 — Configure Variables

Edit `databricks.yml` and set the three variables for your workspace:

```yaml
variables:
  warehouse_id:
    default: "abc123def456"      # ← paste your warehouse ID here

  catalog:
    default: "main"              # ← your UC catalog (usually "main")

  schema:
    default: "mufc"              # ← schema name (will be created if missing)
```

> **Client workspaces:** Update the `workspace.host` under `targets.prod` to your workspace URL.

---

## Step 2 — Run the Setup Notebook

Open **`notebooks/05_genie_setup.py`** in your workspace and run it. This creates the joined gold views Genie needs.

You can also set these Spark configs on your cluster before running:
```
genie.catalog = main
genie.schema  = mufc
genie.analyst_group = users
```

Wait for the final cell — it confirms all tables are ready:
```
✅ gold_matchday_intelligence: 45 rows
✅ gold_commercial_summary: 180 rows
✅ gold_operational_health_iot: 90 rows
✅ gold_weather_attendance_impact: 45 rows
✅ gold_daily_sales_kpi: 180 rows

🟢 All Genie tables ready — deploy the Genie Space now
```

---

## Step 3 — Deploy

```bash
cd mufc

# Deploy to dev first
databricks bundle deploy --target dev

# When ready for production
databricks bundle deploy --target prod
```

That's it. The Genie Space appears in your workspace under **Dashboards > Genie**.

---

## Step 4 — Share with Teams

1. In the workspace, navigate to **Dashboards > Genie**
2. Find **"Manchester United Football Intelligence"**
3. Click **Share** → add your team members or AD groups
4. Share the URL directly — users click it and start asking questions immediately

No training needed. The Genie home screen shows 15 pre-built questions to get started.

---

## Asking Questions — Quick Reference for Teams

Teams can ask anything about the data. Here are the most useful patterns:

### Commercial & Revenue
```
"What was total revenue last week by region?"
"Which region has the highest average order value this month?"
"Show me the revenue trend over the last 30 days"
"Compare this month's revenue to last month"
"How many orders did we process yesterday?"
```

### Weather & Attendance
```
"How does rain affect attendance at Old Trafford?"
"What is today's weather and what attendance impact do we expect?"
"Show attendance impact by weather condition type"
"On which days did we have the worst weather this season?"
```

### Operations
```
"Which IoT devices had the highest readings yesterday?"
"Show operational health for the last 7 days"
"Is there any correlation between device readings and revenue?"
```

### Executive / Combined
```
"Give me a matchday intelligence summary for this week"
"On rainy days, how does revenue compare to clear days?"
"What were the top 5 revenue days this season and what was the weather?"
```

---

## Customising for Your Client

### Add new tables
1. Create the table/view in the setup notebook
2. Add it to `resources/manutd_genie.yml` under `tables:`
3. Redeploy: `databricks bundle deploy`

### Add curated questions
Add entries under `curated_questions:` in `resources/manutd_genie.yml`:
```yaml
curated_questions:
  - question: "Your new question here"
```

### Update instructions
Edit the `instructions:` block in `resources/manutd_genie.yml` to add new business terms, join logic, or formatting rules. Genie uses these to answer questions correctly.

### Change catalog/schema per environment
```bash
databricks bundle deploy --target prod \
  --var="catalog=client_catalog" \
  --var="schema=mufc_prod" \
  --var="warehouse_id=abc123"
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Genie shows "no tables found" | Re-run `05_genie_setup.py` and check the final verification cell |
| "Warehouse not found" error | Set `warehouse_id` in `databricks.yml` to a running warehouse |
| Tables have 0 rows | Run the DLT pipelines first (`manutd_etl` + `dlt_operational_sales_pipeline`) |
| Permission denied on tables | Check analyst group in setup notebook: `ANALYST_GROUP = "users"` |
| Genie gives wrong answers | Add clarification to the `instructions:` block in `manutd_genie.yml` and redeploy |
| Bundle deploy fails | Run `databricks bundle validate` first to catch config errors |

---

## Files in This Bundle

```
mufc/
├── databricks.yml                    ← Bundle config (edit variables here)
├── GENIE_DEPLOYMENT.md               ← This guide
├── notebooks/
│   └── 05_genie_setup.py             ← Run first — creates UC tables + grants
├── resources/
│   ├── manutd_genie.yml              ← Genie Space definition (tables, instructions, questions)
│   ├── manutd_jobs.yml               ← Scheduled ingestion jobs
│   ├── manutd_pipeline.yml           ← DLT medallion pipeline
│   └── mufc.app.yml                  ← Football Intelligence web app
└── pipelines/
    ├── manutd_etl.py                 ← Weather + attendance DLT pipeline
    └── dlt_operational_sales_pipeline_demo.py  ← CRM + ERP + IoT DLT pipeline
```
