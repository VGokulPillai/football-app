"""
Generate synthetic data for MUFC Football Intelligence Platform.
Saves to Delta Lake in Unity Catalog for use by the app and pipelines.
"""
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from pyspark.sql import SparkSession

# =============================================================================
# CONFIGURATION
# =============================================================================
CATALOG = "mufc"
SCHEMA = "default"
SEED = 42

np.random.seed(SEED)

# =============================================================================
# SETUP
# =============================================================================
spark = SparkSession.builder.getOrCreate()

spark.sql(f"CREATE CATALOG IF NOT EXISTS {CATALOG}")
spark.sql(f"CREATE SCHEMA IF NOT EXISTS {CATALOG}.{SCHEMA}")

# =============================================================================
# 1. PLAYERS
# =============================================================================
players_data = [
    ("p1", "Erling Haaland", "Striker", 9, 24, "Norway"),
    ("p2", "Kevin De Bruyne", "Midfielder", 17, 33, "Belgium"),
    ("p3", "Phil Foden", "Midfielder", 47, 24, "England"),
    ("p4", "Rodri", "Midfielder", 16, 28, "Spain"),
    ("p5", "Bernardo Silva", "Midfielder", 20, 30, "Portugal"),
    ("p6", "Kyle Walker", "Defender", 2, 34, "England"),
    ("p7", "Rúben Dias", "Defender", 3, 27, "Portugal"),
    ("p8", "John Stones", "Defender", 5, 30, "England"),
    ("p9", "Ederson", "Goalkeeper", 31, 31, "Brazil"),
    ("p10", "Julian Álvarez", "Striker", 19, 25, "Argentina"),
    ("p11", "Jack Grealish", "Winger", 10, 29, "England"),
    ("p12", "Jeremy Doku", "Winger", 11, 22, "Belgium"),
]

players_df = spark.createDataFrame(
    players_data,
    ["player_id", "name", "position", "number", "age", "nationality"]
)
players_df.write.mode("overwrite").saveAsTable(f"{CATALOG}.{SCHEMA}.players")

# =============================================================================
# 2. FIXTURES
# =============================================================================
base = datetime.now()
fixtures_data = [
    ("f1", "Liverpool", "Premier League", "Etihad Stadium", (base + timedelta(days=7)).strftime("%Y-%m-%d"), "15:00", True),
    ("f2", "Real Madrid", "Champions League", "Etihad Stadium", (base + timedelta(days=14)).strftime("%Y-%m-%d"), "20:00", True),
    ("f3", "Arsenal", "Premier League", "Emirates Stadium", (base + timedelta(days=21)).strftime("%Y-%m-%d"), "16:30", False),
    ("f4", "Brighton", "Premier League", "Etihad Stadium", (base + timedelta(days=28)).strftime("%Y-%m-%d"), "15:00", True),
]

fixtures_df = spark.createDataFrame(
    fixtures_data,
    ["fixture_id", "opponent", "competition", "venue", "date", "kickoff", "is_home"]
)
fixtures_df.write.mode("overwrite").saveAsTable(f"{CATALOG}.{SCHEMA}.fixtures")

# =============================================================================
# 3. ATTENDANCE PREDICTIONS
# =============================================================================
attendance_data = [
    ("f1", "Liverpool", (base + timedelta(days=7)).strftime("%Y-%m-%d"), 53420, 0.98, 51800, 54800, "Very High", 1.4),
    ("f2", "Real Madrid", (base + timedelta(days=14)).strftime("%Y-%m-%d"), 55000, 1.0, 53500, 55200, "Very High", 1.8),
    ("f4", "Brighton", (base + timedelta(days=28)).strftime("%Y-%m-%d"), 45200, 0.83, 42000, 48500, "Medium", 0.9),
]

attendance_df = spark.createDataFrame(
    attendance_data,
    ["fixture_id", "opponent", "date", "predicted_attendance", "predicted_occupancy",
     "confidence_low", "confidence_high", "demand_tier", "booking_velocity"]
)
attendance_df.write.mode("overwrite").saveAsTable(f"{CATALOG}.{SCHEMA}.attendance_predictions")

# =============================================================================
# 4. PLAYER PERFORMANCE (last 5 matches)
# =============================================================================
perf_data = []
for pid, name, pos, _, _, _ in players_data:
    base_xg = 0.3 if pos == "Striker" else 0.15 if "Midfielder" in pos or "Winger" in pos else 0.05
    perf_data.append((
        pid, name, pos, 5,
        int(np.random.randint(0, 5)) if pos in ["Striker", "Winger"] else int(np.random.randint(0, 3)),
        int(np.random.randint(0, 4)),
        round(float(base_xg * (4 + np.random.random() * 2)), 2),
        round(float(0.1 * (2 + np.random.random() * 3)), 2),
        round(float(85 + np.random.random() * 12), 1),
        round(float(9 + np.random.random() * 3), 1),
        int(np.random.randint(20, 46)),
        np.random.choice(["up", "stable", "down"]),
    ))

perf_df = spark.createDataFrame(
    perf_data,
    ["player_id", "player_name", "position", "matches_played", "goals", "assists",
     "xG", "xA", "pass_completion", "distance_km", "sprints", "form_trend"]
)
perf_df.write.mode("overwrite").saveAsTable(f"{CATALOG}.{SCHEMA}.player_performance")

# =============================================================================
# 5. HEALTH STATUS
# =============================================================================
health_data = []
for i, (pid, name, _, _, _, _) in enumerate(players_data):
    status = "Minor Injury" if pid == "p9" else "Available"
    risk = "Medium" if pid == "p9" else "Low"
    fatigue = 45 if pid == "p9" else round(float(20 + np.random.random() * 50), 0)
    load = 65 if pid == "p9" else round(float(70 + np.random.random() * 25), 0)
    health_data.append((pid, name, status, risk, fatigue, load))

health_df = spark.createDataFrame(
    health_data,
    ["player_id", "player_name", "status", "injury_risk", "fatigue", "training_load"]
)
health_df.write.mode("overwrite").saveAsTable(f"{CATALOG}.{SCHEMA}.health_status")

print("Synthetic data generated successfully.")
print(f"Tables: {CATALOG}.{SCHEMA}.players, fixtures, attendance_predictions, player_performance, health_status")
