# Manchester United Football Intelligence - Deployment Guide

## Deploy after every change (recommended)

From `mufc/`:

```bash
./scripts/deploy-dev.sh
```

This runs `npm run build` in `frontend/`, then `databricks bundle deploy -t dev`, then restarts the app (`mufc_app`). Use the same flow whenever you change UI or backend code.

## Quick Deploy

### 1. Prerequisites
- Databricks CLI 0.229+
- `databricks auth login` completed
- Node.js 18+ (for frontend build)

### 2. Build Frontend
```bash
cd mufc/frontend
npm install
npm run build
```

### 3. Configure Workspace
Edit `databricks.yml` or set variables:
```yaml
variables:
  workspace_host: "https://your-workspace.azuredatabricks.net"
```

### 4. Deploy Bundle
```bash
cd mufc
databricks bundle validate -t dev
databricks bundle deploy -t dev
```

### 5. Run Resources
```bash
# Start the app
databricks bundle run mufc_app -t dev

# Run ingestion job (fetches Open-Meteo weather, Football-Data.org if key set)
databricks bundle run manutd_ingest -t dev

# Run DLT pipeline
databricks bundle run manutd_etl -t dev

# Train ML models
databricks bundle run manutd_ml_attendance -t dev
databricks bundle run manutd_ml_injury -t dev
```

## Free APIs Used

| API | Key Required | Purpose |
|-----|--------------|---------|
| **Open-Meteo** | No | Manchester weather, attendance impact |
| **Football-Data.org** | Yes (free) | Fixtures, matches - get at football-data.org |
| **NewsAPI** | Yes (free tier) | Football news - get at newsapi.org |

### Optional: Set API Keys
For ingestion job to fetch football and news:
- `FOOTBALL_DATA_API_KEY` - Register at https://www.football-data.org/
- `NEWS_API_KEY` - Register at https://newsapi.org/

Add as job environment variables or cluster environment.

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Open-Meteo     │     │ Football-Data   │     │    NewsAPI      │
│  (no key)       │     │ (free key)      │     │  (free key)     │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 ▼
                    ┌────────────────────────┐
                    │  Ingest Job (daily)    │
                    │  scripts/ingest_*.py   │
                    └────────────┬───────────┘
                                 ▼
                    ┌────────────────────────┐
                    │  Delta Lake (Volume)   │
                    │  raw_data/weather      │
                    │  raw_data/football_*   │
                    └────────────┬───────────┘
                                 ▼
                    ┌────────────────────────┐
                    │  DLT Pipeline         │
                    │  Bronze→Silver→Gold    │
                    └────────────┬───────────┘
                                 ▼
                    ┌────────────────────────┐
                    │  ML Models (MLflow)   │
                    │  Attendance, Injury   │
                    └────────────┬───────────┘
                                 ▼
                    ┌────────────────────────┐
                    │  Databricks App        │
                    │  React + FastAPI       │
                    └────────────────────────┘
```

## App Features
- **Live Weather**: Open-Meteo (no key) - Manchester matchday conditions
- **Animations**: Framer Motion on Executive Dashboard
- **ML Models**: Attendance prediction, Injury risk (train via jobs)
- **AI Copilot**: Databricks Foundation Models (add Model Serving resource)
