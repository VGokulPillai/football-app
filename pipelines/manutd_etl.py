# Databricks notebook source
# MAGIC %md
# MAGIC # Manchester United Football Intelligence - DLT Pipeline
# MAGIC Bronze → Silver → Gold with weather, fixtures, and ML features

# COMMAND ----------

import dlt
from pyspark.sql import functions as F

# COMMAND ----------

CATALOG = "main"
SCHEMA = "default"
VOLUME_PATH = f"/Volumes/{CATALOG}/{SCHEMA}/raw_data"

# COMMAND ----------

# MAGIC %md
# MAGIC ## Bronze: Raw Weather (from Open-Meteo API)

# COMMAND ----------

@dlt.table(
    name="bronze_weather",
    comment="Raw weather from Open-Meteo - Manchester",
)
def bronze_weather():
    try:
        return spark.read.format("delta").load(f"{VOLUME_PATH}/weather")
    except Exception:
        return spark.createDataFrame(
            [("2024-01-01T00:00:00", 10.0, 0, 15.0, 0.0)],
            "ingested_at string, temp_c double, weather_code int, wind_speed_kmh double, precipitation double",
        )

# COMMAND ----------

# MAGIC %md
# MAGIC ## Silver: Cleaned Weather

# COMMAND ----------

@dlt.table(
    name="silver_weather",
    comment="Cleaned weather for attendance impact",
)
@dlt.expect_or_drop("valid_temp", "temp_c IS NOT NULL AND temp_c BETWEEN -30 AND 50")
def silver_weather():
    return (
        dlt.read("bronze_weather")
        .withColumn("temperature_c", F.col("temp_c").cast("double"))
        .withColumn(
            "conditions",
            F.when(F.col("weather_code") >= 60, "rain")
            .when(F.col("weather_code") >= 50, "drizzle")
            .when(F.col("weather_code") >= 3, "cloudy")
            .otherwise("clear"),
        )
        .select("ingested_at", "temperature_c", "conditions", "weather_code")
    )

# COMMAND ----------

# MAGIC %md
# MAGIC ## Gold: Weather Impact on Attendance

# COMMAND ----------

@dlt.table(
    name="gold_weather_attendance_impact",
    comment="Weather-based attendance impact for ML",
)
def gold_weather_attendance_impact():
    return (
        dlt.read("silver_weather")
        .withColumn(
            "attendance_impact_pct",
            F.when(F.col("conditions") == "rain", -8)
            .when(F.col("conditions") == "drizzle", -4)
            .when(F.col("temperature_c") < 5, -3)
            .when(F.col("temperature_c") > 25, -2)
            .otherwise(0),
        )
        .select("ingested_at", "temperature_c", "conditions", "attendance_impact_pct")
    )
