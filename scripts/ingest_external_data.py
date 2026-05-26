"""
Ingest data from free APIs into Delta Lake.
APIs: Open-Meteo (weather, no key), Football-Data.org (free tier, needs token), NewsAPI (free tier).
Run as Databricks job or notebook.
"""
import os
import json
from datetime import datetime
from pyspark.sql import SparkSession
from pyspark.sql.types import StructType, StructField, StringType, DoubleType, IntegerType, LongType

spark = SparkSession.builder.getOrCreate()
RAW_DELTA_BASE = os.environ.get("RAW_DELTA_BASE", "dbfs:/tmp/mufc_raw")

# Manchester coordinates (Old Trafford)
MANCHESTER_LAT = 53.4631
MANCHESTER_LON = -2.2913


def fetch_open_meteo_weather():
    """Open-Meteo: Free, no API key. Manchester weather."""
    import urllib.request
    url = (
        f"https://api.open-meteo.com/v1/forecast?"
        f"latitude={MANCHESTER_LAT}&longitude={MANCHESTER_LON}"
        f"&current=temperature_2m,weather_code,wind_speed_10m,precipitation"
        f"&hourly=temperature_2m,precipitation_probability"
        f"&forecast_days=3"
    )
    with urllib.request.urlopen(url) as r:
        data = json.loads(r.read().decode())
    return data


def fetch_football_data():
    """Football-Data.org: Free tier. Requires X-Auth-Token env var."""
    import urllib.request
    token = os.environ.get("FOOTBALL_DATA_API_KEY", "")
    if not token:
        return None
    # Premier League = PL, Man United team ID varies - use competitions
    url = "https://api.football-data.org/v4/competitions/PL/matches?status=SCHEDULED,LIVE,FINISHED"
    req = urllib.request.Request(url, headers={"X-Auth-Token": token})
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read().decode())


def fetch_news():
    """NewsAPI free tier - requires API key. Fallback: use RSS or skip."""
    api_key = os.environ.get("NEWS_API_KEY", "")
    if not api_key:
        return None
    import urllib.request
    url = f"https://newsapi.org/v2/everything?q=Manchester+United&apiKey={api_key}&pageSize=10"
    try:
        with urllib.request.urlopen(url) as r:
            return json.loads(r.read().decode())
    except Exception:
        return None


def main():
    # 1. Weather
    try:
        weather = fetch_open_meteo_weather()
        current = weather.get("current", {})
        rows = [{
            "ingested_at": datetime.utcnow().isoformat(),
            "latitude": MANCHESTER_LAT,
            "longitude": MANCHESTER_LON,
            "temp_c": current.get("temperature_2m"),
            "weather_code": current.get("weather_code"),
            "wind_speed_kmh": current.get("wind_speed_10m"),
            "precipitation": current.get("precipitation", 0),
        }]
        df = spark.createDataFrame(rows)
        df.write.mode("append").format("delta").save(f"{RAW_DELTA_BASE}/weather")
        print("Weather ingested.")
    except Exception as e:
        print(f"Weather ingest failed: {e}")

    # 2. Football matches (if token available)
    try:
        football = fetch_football_data()
        if football and "matches" in football:
            rows = []
            for m in football["matches"][:50]:
                rows.append({
                    "match_id": str(m.get("id", "")),
                    "home_team": m.get("homeTeam", {}).get("name", ""),
                    "away_team": m.get("awayTeam", {}).get("name", ""),
                    "utc_date": m.get("utcDate", ""),
                    "status": m.get("status", ""),
                    "competition": m.get("competition", {}).get("name", ""),
                    "ingested_at": datetime.utcnow().isoformat(),
                })
            if rows:
                df = spark.createDataFrame(rows)
                df.write.mode("append").format("delta").save(f"{RAW_DELTA_BASE}/football_matches")
                print("Football matches ingested.")
    except Exception as e:
        print(f"Football ingest failed: {e}")

    # 3. News (if key available)
    try:
        news = fetch_news()
        if news and "articles" in news:
            rows = []
            for a in news["articles"][:20]:
                rows.append({
                    "title": a.get("title", ""),
                    "source": a.get("source", {}).get("name", ""),
                    "published_at": a.get("publishedAt", ""),
                    "url": a.get("url", ""),
                    "ingested_at": datetime.utcnow().isoformat(),
                })
            if rows:
                df = spark.createDataFrame(rows)
                df.write.mode("append").format("delta").save(f"{RAW_DELTA_BASE}/news")
                print("News ingested.")
    except Exception as e:
        print(f"News ingest failed: {e}")

    print("Ingestion complete.")


if __name__ == "__main__":
    main()
