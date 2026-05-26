# Databricks notebook source
# MAGIC %md
# MAGIC # Ingest API-Football Data for ML & RAG
# MAGIC Fetches squad, fixtures, standings, injuries, transfers into Delta for ML training and RAG

# COMMAND ----------

import os
import json
import urllib.request
from datetime import datetime
from pyspark.sql import SparkSession
from pyspark.sql import functions as F

spark = SparkSession.builder.getOrCreate()
RAW_DELTA_BASE = os.environ.get("RAW_DELTA_BASE", "dbfs:/tmp/mufc_raw").rstrip("/")
API_KEY = os.environ.get("API_FOOTBALL_KEY", "")


def try_write_delta(df, subpath: str, mode: str = "append") -> bool:
    path = f"{RAW_DELTA_BASE}/{subpath}"
    try:
        df.write.mode(mode).format("delta").save(path)
        print(f"Wrote delta: {path}")
        return True
    except Exception as e:
        print(f"DELTA write skipped ({path}): {e}")
        return False

MANUTD_ID = 33
PREMIER_LEAGUE_ID = 39
# Current season: Aug–Jul
_now = datetime.now()
SEASON = _now.year if _now.month >= 8 else _now.year - 1

# COMMAND ----------

def api_get(endpoint: str, params: dict = None) -> dict:
    """Call API-Football."""
    url = f"https://v3.football.api-sports.io/{endpoint}"
    if params:
        url += "?" + "&".join(f"{k}={v}" for k, v in params.items())
    req = urllib.request.Request(url, headers={"x-apisports-key": API_KEY})
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(r.read().decode())

# COMMAND ----------

# MAGIC %md
# MAGIC ## Squad

# COMMAND ----------

if API_KEY:
    try:
        data = api_get("players/squads", {"team": MANUTD_ID})
        resp = data.get("response", [])
        if resp:
            team_data = resp[0]
            players = team_data.get("players", [])
            rows = []
            for p in players:
                rows.append({
                    "player_id": p.get("id"),
                    "name": p.get("name"),
                    "position": p.get("position"),
                    "number": p.get("number"),
                    "age": p.get("age"),
                    "photo_url": f"https://media.api-sports.io/football/players/{p.get('id')}.png",
                    "ingested_at": datetime.utcnow().isoformat(),
                })
            if rows:
                df = spark.createDataFrame(rows)
                try_write_delta(df, "api_football_squad", mode="overwrite")
                print(f"Ingested {len(rows)} squad players.")
    except Exception as e:
        print(f"Squad ingest failed: {e}")
else:
    print("API_FOOTBALL_KEY not set - skipping.")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Fixtures

# COMMAND ----------

if API_KEY:
    try:
        data = api_get("fixtures", {"team": MANUTD_ID, "next": 20})
        resp = data.get("response", [])
        rows = []
        for f in resp:
            fixture = f.get("fixture", {})
            teams = f.get("teams", {})
            league = f.get("league", {})
            venue_obj = fixture.get("venue") or {}
            home_id = (teams.get("home") or {}).get("id")
            is_home = home_id == MANUTD_ID
            rows.append({
                "fixture_id": fixture.get("id"),
                "date": fixture.get("date", "")[:10],
                "kickoff": (fixture.get("date") or "")[11:16] if len(fixture.get("date") or "") >= 16 else None,
                "home_team": teams.get("home", {}).get("name"),
                "away_team": teams.get("away", {}).get("name"),
                "venue": venue_obj.get("name"),
                "venue_id": venue_obj.get("id"),
                "is_home": is_home,
                "opponent": (teams.get("away") if is_home else teams.get("home", {})).get("name"),
                "league": league.get("name"),
                "season": league.get("season"),
                "ingested_at": datetime.utcnow().isoformat(),
            })
        if rows:
            try_write_delta(spark.createDataFrame(rows), "api_football_fixtures", mode="overwrite")
            print(f"Ingested {len(rows)} fixtures (venue, opponent, kickoff).")
    except Exception as e:
        print(f"Fixtures ingest failed: {e}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Standings (for ML features)

# COMMAND ----------

if API_KEY:
    try:
        data = api_get("standings", {"league": PREMIER_LEAGUE_ID, "season": SEASON})
        resp = data.get("response", [])
        if resp:
            league_data = resp[0]
            standings = league_data.get("league", {}).get("standings", [[]])
            rows = []
            for group in standings:
                for r in group:
                    rows.append({
                        "rank": r.get("rank"),
                        "team_id": r.get("team", {}).get("id"),
                        "team_name": r.get("team", {}).get("name"),
                        "points": r.get("points"),
                        "goals_diff": r.get("goalsDiff"),
                        "played": r.get("all", {}).get("played"),
                        "season": SEASON,
                        "ingested_at": datetime.utcnow().isoformat(),
                    })
            if rows:
                try_write_delta(spark.createDataFrame(rows), "api_football_standings", mode="overwrite")
                print(f"Ingested {len(rows)} standings rows.")
    except Exception as e:
        print(f"Standings ingest failed: {e}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Injuries (for injury risk ML)

# COMMAND ----------

if API_KEY:
    try:
        data = api_get("injuries", {"team": MANUTD_ID, "league": PREMIER_LEAGUE_ID, "season": SEASON})
        resp = data.get("response", [])
        rows = []
        for inj in resp:
            p = inj.get("player", {})
            rows.append({
                "player_id": p.get("id"),
                "player_name": p.get("name"),
                "reason": p.get("reason"),
                "type": p.get("type"),
                "ingested_at": datetime.utcnow().isoformat(),
            })
        if rows:
            try_write_delta(spark.createDataFrame(rows), "api_football_injuries", mode="overwrite")
            print(f"Ingested {len(rows)} injuries.")
        else:
            print("No injuries data.")
    except Exception as e:
        print(f"Injuries ingest failed: {e}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Top Scorers (for player performance ML)

# COMMAND ----------

if API_KEY:
    try:
        data = api_get("players/topscorers", {"league": PREMIER_LEAGUE_ID, "season": SEASON})
        resp = data.get("response", [])
        rows = []
        for s in resp:
            p = s.get("player", {})
            stats = s.get("statistics", [{}])[0] if s.get("statistics") else {}
            rows.append({
                "player_id": p.get("id"),
                "player_name": p.get("name"),
                "team": stats.get("team", {}).get("name"),
                "goals": stats.get("goals", {}).get("total"),
                "assists": stats.get("goals", {}).get("assists"),
                "ingested_at": datetime.utcnow().isoformat(),
            })
        if rows:
            try_write_delta(spark.createDataFrame(rows), "api_football_top_scorers", mode="overwrite")
            print(f"Ingested {len(rows)} top scorers.")
    except Exception as e:
        print(f"Top scorers ingest failed: {e}")
