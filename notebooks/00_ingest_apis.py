# Databricks notebook source
# MAGIC %md
# MAGIC # Ingest from Free APIs (Open-Meteo, Football-Data.org, NewsAPI)

# COMMAND ----------

import os
import json
import urllib.request
from datetime import datetime
from pyspark.sql import SparkSession

spark = SparkSession.builder.getOrCreate()
# Override when DBFS is disabled or UC volume is available, e.g. RAW_DELTA_BASE=/Volumes/<cat>/<schema>/raw_data
RAW_DELTA_BASE = os.environ.get("RAW_DELTA_BASE", "dbfs:/tmp/mufc_raw").rstrip("/")


def try_write_delta(df, subpath: str, mode: str = "append") -> bool:
    path = f"{RAW_DELTA_BASE}/{subpath}"
    try:
        df.write.mode(mode).format("delta").save(path)
        print(f"Wrote delta: {path}")
        return True
    except Exception as e:
        print(f"DELTA write skipped ({path}): {e}")
        return False


MANCHESTER_LAT = 53.4631
MANCHESTER_LON = -2.2913

# COMMAND ----------

# MAGIC %md
# MAGIC ## Open-Meteo Weather (no API key)

# COMMAND ----------

url = f"https://api.open-meteo.com/v1/forecast?latitude={MANCHESTER_LAT}&longitude={MANCHESTER_LON}&current=temperature_2m,weather_code,wind_speed_10m,precipitation&forecast_days=1"
with urllib.request.urlopen(url, timeout=5) as r:
    weather = json.loads(r.read().decode())

cur = weather.get("current", {})
rows = [{
    "ingested_at": datetime.utcnow().isoformat(),
    "temp_c": cur.get("temperature_2m"),
    "weather_code": cur.get("weather_code"),
    "wind_speed_kmh": cur.get("wind_speed_10m"),
    "precipitation": cur.get("precipitation", 0),
}]
df = spark.createDataFrame(rows)
try_write_delta(df, "weather")
print("Weather fetch complete.")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Football-Data.org (optional - set FOOTBALL_DATA_API_KEY)

# COMMAND ----------

token = os.environ.get("FOOTBALL_DATA_API_KEY", "")
if token:
    try:
        req = urllib.request.Request(
            "https://api.football-data.org/v4/competitions/PL/matches?status=SCHEDULED",
            headers={"X-Auth-Token": token}
        )
        with urllib.request.urlopen(req) as r:
            football = json.loads(r.read().decode())
        rows = []
        for m in football.get("matches", [])[:30]:
            rows.append({
                "match_id": str(m.get("id", "")),
                "home_team": m.get("homeTeam", {}).get("name", ""),
                "away_team": m.get("awayTeam", {}).get("name", ""),
                "utc_date": m.get("utcDate", ""),
                "status": m.get("status", ""),
                "ingested_at": datetime.utcnow().isoformat(),
            })
        if rows:
            try_write_delta(spark.createDataFrame(rows), "football_matches")
            print("Football fetch complete.")
    except Exception as e:
        print(f"Football ingest failed: {e}")
else:
    print("FOOTBALL_DATA_API_KEY not set - skipping.")
