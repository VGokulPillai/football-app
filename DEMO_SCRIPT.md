# Manchester United Football Intelligence — Demo Script

**App URL:** https://mufc-dev-7474655465921038.aws.databricksapps.com
**Duration:** ~15 minutes (expandable to 25 with deep-dives)
**Audience:** CDO / CTO / Head of Data / Analytics leads at football clubs or sports orgs

---

## Opening (30 seconds)

> "This is a live Databricks App we built for Manchester United — a single platform that unifies sporting intelligence and commercial decision-making. Everything you're about to see runs on Databricks: the data pipelines, the ML models, the AI assistant, the app itself. Let me walk you through it."

---

## 1. Executive Control Tower — `/` (3 min)

**What to show:**
- The **hero banner** with the next fixture, live countdown to kick-off, and the most recent result (pulled live from API-Football)
- Five KPI tiles: Squad Readiness, Predicted Attendance, Projected Revenue, Injury Risks, and **Live Weather** (from Open-Meteo — updates in real time)
- The **ML Predictions** strip below the KPIs (attendance model output with confidence band)
- Real-time alerts and upcoming fixtures table

**Talking points:**
> "The executive dashboard is the single pane of glass. The countdown clock is live — it switches to local time after kick-off. Weather data feeds directly into the attendance model because rain on a Tuesday night genuinely affects turnout."

> "Every number here is computed — predicted attendance, projected revenue, squad readiness. These aren't static reports; they update as new data flows in through DLT pipelines and live API calls."

**Demo action:** Hover over the ML attendance prediction to show the confidence interval, then click **"Ask Genie"**.

---

## 2. Ask Genie — AI Copilot (2 min)

**What to show:**
- The slide-over Genie panel
- Ask: *"What's our projected revenue for the next home game and what's driving it?"*
- Watch the AI respond with data-grounded answers

**Talking points:**
> "This is RAG-powered — the assistant pulls live context from API-Football (squad, injuries, standings, transfers), scraped manutd.com news, commercial model outputs, and weather data. It's not hallucinating; it's grounded in the platform's own data."

> "Under the hood, this calls Databricks Foundation Models — Claude via Model Serving. The context window includes everything from squad fitness to ticket pricing elasticity."

**Demo action:** Try a second question: *"Which players are injury risks for the Chelsea match?"* — shows cross-domain awareness.

---

## 3. Revenue Optimization — `/revenue` (2 min)

**What to show:**
- Total projected revenue across upcoming home fixtures
- Per-fixture cards with ticket/hospitality/concessions breakdown
- **ML growth strategies** panel (revenue lift estimates with rationale)
- Hover a fixture's £M value to see the **model reasoning** tooltip

**Talking points:**
> "Each fixture has a modelled revenue projection. The model accounts for opponent draw tier, day of week, historical fill rates, and hospitality attach rates. Hover here — you can see exactly why the model predicts £5.1M for the Liverpool match."

**Demo action:** Select a fixture, enter a **+5% price change**, hit **Simulate**.

> "This is a what-if pricing simulator. It shows the elasticity trade-off — if we raise prices 5%, we lose some casual fans but hospitality revenue offsets it. The model recommends the optimal band."

---

## 4. Audience & Demand — `/audience` (1.5 min)

**What to show:**
- Attendance chart: actual (dark bars) vs projected (red bars) by opponent
- Zone demand heatmap (which stadium sections fill first)
- Fan segmentation table (Loyal Season Holders vs Hospitality Premium vs International)

**Talking points:**
> "We can see which fixtures are high-demand vs at-risk for empty seats. The demand model segments fans — 42,000 loyal season holders at 95% attendance vs 8,000 matchday casuals at 40%. That drives targeted marketing: you don't send the same promo to both groups."

---

## 5. Live Football Data — `/football` (1 min)

**What to show:**
- Premier League standings (live from API-Football)
- Squad grid with player photos, positions, loan-in badges
- Upcoming fixtures, injuries, top scorers, top assists

**Talking points:**
> "This is the live data layer — everything here comes directly from API-Football in real time. It's the truth source that feeds into the ML models and the AI copilot. When a player gets injured, this data flows through to the Health page, the Executive dashboard, and the copilot's context — all automatically."

---

## 6. Player Performance — `/players` (1.5 min)

**What to show:**
- **Live formation shape** with attacking/defensive emphasis
- Top 3 players radar chart (attack index vs defence index vs goals vs tackles)
- Full squad table with normalized indices
- Click **Refresh Live** to pull latest stats

**Talking points:**
> "Every player has an attacking and defensive index, normalized within the squad. The radar chart instantly tells you Bruno Fernandes dominates attacking output while Casemiro leads defensive metrics. These indices feed into the transfer scoring model too."

**Demo action:** Change the comparison metric dropdown to **Goals** or **Tackles** to reshape the bar chart.

---

## 7. Health & Squad Readiness — `/health` (1.5 min)

**What to show:**
- Four KPIs: Available players, At-risk count, Bench depth score, Avg fatigue
- Player cards with status, risk level, fatigue %, training load
- **ML Injury Risk Model** output (risk score per player, recommendation)

**Talking points:**
> "The injury risk model combines training load, fatigue levels, recent minutes played, and historical injury data. It's flagging Onana as elevated risk — the recommendation is to consider rotation for cup fixtures. This kind of insight prevents the £50M problem of losing a key player to a preventable injury."

---

## 8. Media & Sentiment — `/media` (1 min)

**What to show:**
- **GPT News Insights** panel (injuries detected, transfers in/out, AI summary)
- Player sentiment scores with brand value estimates
- Scraped transfer news and match reports from manutd.com

**Talking points:**
> "We scrape manutd.com and run GPT extraction to pull structured insights — who's injured, who's being linked with a transfer. The sentiment model tracks which players are trending and their commercial brand value. This feeds into the transfer intelligence scoring."

---

## 9. Transfer Intelligence — `/transfers` (1 min)

**What to show:**
- Squad value grid with current valuations
- Transfer targets with **sporting / commercial / tactical fit** scores
- ML fit badges and risk assessments

**Talking points:**
> "Transfer decisions aren't just about footballing ability. This platform scores targets on three axes — sporting fit, commercial value, and tactical need. Theo Hernández scores 92 on sporting but the model flags injury history risk. That's the kind of nuance that turns a £60M gamble into an informed decision."

---

## 10. Live Match Planning — `/simulation` (2 min) ⭐ The Closer

**What to show:**
- Click **Play** — the match clock starts ticking
- Watch player **fatigue build** in real time (colour-coded borders)
- **ML sidebar** shows tactical recommendations that evolve with the match phase
- When fatigue spikes, a **notification toast** pops up recommending a substitution

**Demo action:**
1. Start the clock at **2× speed** so fatigue builds faster
2. Wait for the ML panel to recommend a sub (~minute 55-65)
3. **Drag a bench player** onto a fatigued starter to make a substitution
4. Show the fatigue drop on the substituted position ("fresh legs" window)
5. Click **Apply ML Formation** to let the model suggest a formation change

**Talking points:**
> "This is a live tactical board. The match clock drives a fatigue simulation — each player's workload increases based on their position and role. The ML model watches for critical thresholds and recommends substitutions with confidence scores."

> "Watch what happens when I drag Garnacho onto this position — the fatigue drops immediately. And the ML sidebar updates its recommendation because the squad dynamics have changed. This is the kind of tool that turns data into in-match decisions."

---

## 11. Vision Scouting — `/vision-scouting` (2 min) ⭐ Bonus

**What to show:**
- The **upload zone** and CV status indicator (real vs demo mode)
- Click **Run Analysis** without uploading — instant demo mode with 11 tracked players
- The **pitch overlay** with player positions, trajectories, and colour-coded role labels
- Click different players to highlight their trajectory on the pitch
- The **tactical fit scores** — animated bars for Winger / CDM / Fullback
- The **AI reasoning** panel explaining why a player fits a particular role
- The **Squad Fit Matrix** table with heatmap-style score cells

**Demo action:**
1. Click **Run Analysis** (no upload) → demo data loads instantly
2. Click **Player 1** (the winger) — show the wide trajectory and high winger score
3. Click **Player 3** (the CDM) — show the central, compact movement pattern
4. Scroll to the Squad Fit Matrix — point out the colour-coded scores

**Talking points:**
> "This is computer vision for scouting. Upload any football broadcast clip and the platform runs YOLO player detection, centroid tracking, and trajectory analysis. It then scores each tracked player against tactical role profiles — Attacking Winger, Defensive Midfielder, Overlapping Fullback."

> "Right now we're in demo mode with synthetic tracking data, but the pipeline is wired for real video processing. Drop in an mp4, and if YOLO and OpenCV are installed, it runs real detection frame by frame. The scoring function is deterministic — high speed and wide positioning scores high for Winger, central stability scores high for CDM."

> "The key insight: this turns hours of video review into a structured scouting report in seconds. And because it runs on Databricks Apps, you can scale to process hundreds of matches."

**If they ask about data sources:**
> "For real deployments, you'd use SoccerNet broadcast footage (requires NDA), SoccerTrack v2 for tracking annotations, or StatsBomb for event enrichment. The pipeline is designed to work with any of these or a simple local mp4."

---

## Closing (30 seconds)

> "Everything you've seen runs on a single Databricks App — React frontend, Python backend, Foundation Models for the AI copilot, live API integrations, and ML models for attendance, injury risk, revenue, and tactical recommendations."

> "The data pipeline is DLT, the models are tracked in MLflow, the serving is Databricks Model Serving, and the whole thing deploys with a single `databricks bundle deploy`. This is what a modern data-driven sports organisation looks like on Databricks."

---

## Appendix: Suggested Genie Questions

Use these during the demo if the audience wants to see more AI interaction:

| Question | What it demonstrates |
|----------|---------------------|
| *"What's our projected revenue for the next home game?"* | Commercial awareness + revenue model context |
| *"Which players are injury risks this week?"* | Cross-referencing health data with fixtures |
| *"Should we sign Theo Hernández?"* | Transfer intelligence + multi-factor reasoning |
| *"Compare Bruno Fernandes and Mason Mount this season"* | Player performance data grounding |
| *"What's the weather forecast for Saturday's match?"* | Live external data integration |
| *"Summarise the latest transfer rumours"* | News scraping + GPT extraction |

---

## Appendix: Databricks Features Demonstrated

| Feature | Where it appears |
|---------|-----------------|
| **Databricks Apps** | The entire application |
| **Foundation Model Serving** | Ask Genie copilot (Claude) |
| **DLT Pipelines** | Data ingest (notebooks) |
| **Unity Catalog** | Delta tables for ML training data |
| **MLflow** | Attendance, injury risk, match prediction notebooks |
| **External Models** | Optional OpenAI GPT via Databricks serving |
| **SQL Warehouse** | Optional Delta queries |
| **DABs (Asset Bundles)** | One-command deployment |
| **Computer Vision (YOLO)** | Vision Scouting player detection & tracking |
