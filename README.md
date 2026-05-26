# Manchester United Football Intelligence Platform

An executive-grade, AI-powered control center for Manchester United, built on **Databricks Apps** with a React frontend and Python/FastAPI backend. Features live weather (Open-Meteo), DLT pipelines, ML models, and animated dashboards. The platform unifies sporting performance intelligence and commercial decision-making in one unified application.

## Features

### ML & RAG (Machine Learning + Retrieval-Augmented Generation)

- **RAG-augmented Copilot**: Ask Genie uses live API-Football data (squad, fixtures, standings, injuries, transfers, predictions) as context for accurate, data-grounded answers
- **Attendance prediction**: ML model predicts matchday attendance from opponent tier, weather, competition
- **Injury risk model**: Predicts player injury risk from training load, fatigue, matches/minutes
- **Match prediction**: API-Football predictions + ML match outcome model (notebook)
- **Data ingest**: `notebooks/03_ingest_api_football.py` ingests squad, fixtures, standings, injuries, top scorers into Delta for ML training

### Core Capabilities

1. **Audience Prediction & Matchday Demand**
   - Attendance forecasts for upcoming matches
   - Demand heatmaps by stadium zone
   - Fan segmentation (geography, loyalty, spending)
   - Booking velocity and forecast confidence bands

2. **Revenue Optimization**
   - Projected revenue by fixture
   - Marketing recommendations (targeted promotions, upsell)
   - What-if pricing simulation

3. **Player Performance**
   - Match metrics (goals, assists, xG, xA, pass %, distance, sprints)
   - Form progression and position-specific KPIs
   - Player comparison and radar charts

4. **Health & Squad Readiness**
   - Injury status and fatigue monitoring
   - Training load vs fatigue analysis
   - Medical risk flags

5. **Transfer Intelligence**
   - Transfer target scores (sporting, commercial, tactical)
   - Squad gap analysis
   - AI-generated recommendations

6. **Media & Popularity**
   - Sentiment scores and popularity momentum
   - Trending players and news summary
   - Brand value estimates

7. **Executive Dashboard**
   - Single pane of glass for leadership
   - Real-time alerts and key insights
   - Upcoming fixtures overview

8. **AI Copilot**
   - Natural language queries
   - "Ask the Club Assistant" for attendance, players, transfers, revenue

9. **Live match planning**
   - Vertical pitch with XI vs opponent, 90′ clock
   - Drag-and-drop subs and reshuffles; ML tactical recommendations

10. **DLT vs ADF solutions demo** (`/dlt-demo`)
    - Neo-style animated pipeline canvas
    - Architecture narrative and ADF vs DLT comparison
    - Reference pipeline: `pipelines/dlt_operational_sales_pipeline_demo.py`

## Architecture

```
mufc/
├── app.py                 # FastAPI entry point
├── app.yaml               # Databricks App config
├── requirements.txt
├── server/
│   ├── config.py          # Dual-mode auth (Databricks vs local)
│   ├── llm.py             # Foundation Model client
│   ├── databricks_client.py
│   ├── data/mock_data.py  # Demo data (used when Delta tables not available)
│   └── routes/            # API endpoints
├── frontend/               # React + Vite + Tailwind
│   ├── src/
│   │   ├── pages/         # Dashboard pages
│   │   ├── components/
│   │   └── lib/api.ts
│   └── package.json
├── scripts/
│   └── generate_synthetic_data.py  # Delta Lake data generation
└── resources/             # DAB resources
```

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Recharts, Lucide icons
- **Backend**: FastAPI, Pydantic
- **AI**: Databricks Foundation Models (Claude)
- **Data**: Delta Lake, Unity Catalog
- **Deployment**: Databricks Apps

## Getting Started

### Prerequisites

- Databricks CLI (0.229.0+)
- Node.js 18+
- Python 3.10+
- uv (optional, for Python)

### Local Development

1. **Backend**
   ```bash
   cd mufc
   pip install -r requirements.txt
   export DATABRICKS_PROFILE=your-profile
   uvicorn app:app --reload --port 8000
   ```

2. **Frontend**
   ```bash
   cd frontend
   npm install
   npm run dev   # Proxies /api to backend
   ```

3. Open http://localhost:5173

### Generate Synthetic Data (Optional)

Run on a Databricks cluster to populate Delta tables:

```bash
databricks runs submit --python-file scripts/generate_synthetic_data.py
```

Or run the notebook/script in a Databricks workspace.

### Deploy to Databricks Apps

1. **Create app**
   ```bash
   databricks apps create mufc --description "MUFC Football Intelligence Platform" -p your-profile
   ```

2. **Build frontend**
   ```bash
   cd frontend && npm run build
   ```

3. **Sync and deploy**
   ```bash
   databricks sync . /Users/your-email/mufc \
     --exclude node_modules --exclude .venv --exclude __pycache__ -p your-profile
   databricks apps deploy mufc --source-code-path /Users/your-email/mufc -p your-profile
   ```

4. **Add resources** (via UI): Model serving endpoint for Foundation Models

### Deploy via Asset Bundle

```bash
cd mufc
databricks bundle deploy -t dev
databricks bundle run mufc_app
```

## OpenAI via Databricks (Recommended)

Use OpenAI GPT through the Databricks platform so API keys stay in Databricks secrets:

1. **Create a secret scope** and store your OpenAI API key:
   ```bash
   databricks secrets create-scope my-openai-scope
   databricks secrets put-secret my-openai-scope openai_api_key --string-value "sk-..."
   ```

2. **Create an external model endpoint** (Serving UI or script):
   - Go to **Serving** → **Create serving endpoint**
   - Choose **External model** → **OpenAI** → **gpt-4o-mini**
   - Configure API key from secrets: `{{secrets/my-openai-scope/openai_api_key}}`
   - Name the endpoint (e.g. `openai-gpt-4o-mini`)

3. **Set the app env var**: `GPT_FALLBACK_ENDPOINT=openai-gpt-4o-mini`

The app will use this endpoint for Copilot fallback and GPT news analysis (injuries, transfers).

## Environment Variables

| Variable | Description |
|---------|-------------|
| `DATABRICKS_PROFILE` | CLI profile for local dev |
| `SERVING_ENDPOINT` | Foundation Model endpoint (e.g. databricks-claude-sonnet-4-5) |
| `CATALOG` | Unity Catalog name |
| `SCHEMA` | Schema name |
| `DATABRICKS_WAREHOUSE_ID` | SQL warehouse for Delta queries (optional) |
| `GPT_FALLBACK_ENDPOINT` | Databricks external model endpoint name for OpenAI GPT (preferred - keys in secrets) |
| `OPENAI_API_KEY` | OpenAI API key for GPT fallback when not using Databricks external model |

## Business Value

The platform demonstrates how Databricks can power:

- **Sporting**: Player performance, injury risk, transfer decisions, squad depth
- **Commercial**: Ticket revenue, fan targeting, pricing optimization, campaign ROI
- **Unified**: One platform for directors, analysts, medical, marketing, ticketing

## License

Internal demo. Manchester City branding for illustrative purposes.
