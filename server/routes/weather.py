"""Weather API - Open-Meteo (free, no key)."""
import urllib.request
import json
from fastapi import APIRouter

router = APIRouter(prefix="/weather", tags=["weather"])

BARCELONA_LAT = 41.3809
BARCELONA_LON = 2.1228


def fetch_weather() -> dict:
    """Fetch Barcelona weather from Open-Meteo."""
    url = (
        f"https://api.open-meteo.com/v1/forecast?"
        f"latitude={BARCELONA_LAT}&longitude={BARCELONA_LON}"
        f"&current=temperature_2m,weather_code,wind_speed_10m,precipitation"
        f"&hourly=temperature_2m,precipitation_probability"
        f"&forecast_days=2"
    )
    try:
        with urllib.request.urlopen(url, timeout=5) as r:
            return json.loads(r.read().decode())
    except Exception:
        return {}


def weather_code_to_label(code: int) -> str:
    wmo = {
        0: "Clear", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
        45: "Foggy", 48: "Foggy", 51: "Drizzle", 53: "Drizzle", 55: "Drizzle",
        61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain",
        80: "Showers", 81: "Showers", 82: "Heavy showers",
    }
    return wmo.get(code, "Unknown")


@router.get("/current")
async def current_weather():
    """Current Barcelona weather for matchday impact."""
    data = fetch_weather()
    if not data or "current" not in data:
        return {"temp_c": 18, "conditions": "Unknown", "attendance_impact": 0}
    cur = data["current"]
    temp = cur.get("temperature_2m", 18)
    code = cur.get("weather_code", 0)
    conditions = weather_code_to_label(code)
    impact = -8 if code >= 61 else -4 if code >= 51 else -3 if temp < 5 else -2 if temp > 35 else 0
    return {
        "temp_c": temp,
        "weather_code": code,
        "conditions": conditions,
        "wind_speed_kmh": cur.get("wind_speed_10m"),
        "attendance_impact_pct": impact,
    }


@router.get("/forecast")
async def forecast():
    """Hourly forecast for next 48h."""
    data = fetch_weather()
    if not data or "hourly" not in data:
        return {"hours": []}
    hours = data["hourly"]
    times = hours.get("time", [])[:24]
    temps = hours.get("temperature_2m", [])[:24]
    return {
        "hours": [{"time": t, "temp_c": temps[i] if i < len(temps) else None} for i, t in enumerate(times)],
    }
