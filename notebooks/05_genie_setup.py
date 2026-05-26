# Databricks notebook source
# MAGIC %md
# MAGIC # Manchester United — Genie Space Setup
# MAGIC
# MAGIC **Run this once before deploying the Genie Space.**
# MAGIC
# MAGIC This notebook:
# MAGIC 1. Creates the target schema in Unity Catalog
# MAGIC 2. Creates joined gold views Genie needs (`gold_matchday_intelligence`, `gold_commercial_summary`)
# MAGIC 3. Sets table comments and column-level descriptions so Genie understands the data
# MAGIC 4. Grants analyst access
# MAGIC
# MAGIC **Prerequisites:** Run the DLT pipelines (manutd_etl + dlt_operational_sales_pipeline) first.

# COMMAND ----------

# DBTITLE 1,Configuration — edit before running
# Change these to match your environment
CATALOG = spark.conf.get("genie.catalog", "main")
SCHEMA  = spark.conf.get("genie.schema",  "default")
DLT_SCHEMA = spark.conf.get("genie.dlt_schema", SCHEMA)  # DLT pipeline target schema

# Analyst group to grant access (set to your AD group)
ANALYST_GROUP = spark.conf.get("genie.analyst_group", "users")

print(f"Catalog:     {CATALOG}")
print(f"Schema:      {SCHEMA}")
print(f"DLT Schema:  {DLT_SCHEMA}")

# COMMAND ----------

# DBTITLE 1,Create schema if needed
spark.sql(f"CREATE SCHEMA IF NOT EXISTS `{CATALOG}`.`{SCHEMA}`")
print(f"Schema ready: {CATALOG}.{SCHEMA}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Gold View 1: Matchday Intelligence (weather + commercial joined)

# COMMAND ----------

# DBTITLE 1,gold_matchday_intelligence
spark.sql(f"""
CREATE OR REPLACE VIEW `{CATALOG}`.`{SCHEMA}`.`gold_matchday_intelligence`
COMMENT 'Master match-day view: weather conditions joined with commercial KPIs. One row per calendar date.'
AS
SELECT
    -- Date (common join key)
    COALESCE(s.order_date, TO_DATE(w.ingested_at)) AS event_date,

    -- Weather
    w.temperature_c,
    w.conditions,
    w.attendance_impact_pct,

    -- Commercial
    COALESCE(s.crm_region, 'Unknown')              AS crm_region,
    COALESCE(s.revenue,    0)                       AS revenue,
    COALESCE(s.orders,     0)                       AS orders,
    COALESCE(s.avg_order_value, 0)                  AS avg_order_value,

    -- Derived
    CASE
        WHEN w.conditions = 'rain'   THEN 'Poor'
        WHEN w.conditions = 'drizzle' THEN 'Fair'
        WHEN w.conditions = 'cloudy'  THEN 'Good'
        ELSE 'Excellent'
    END AS matchday_condition_rating

FROM (
    -- Latest weather reading per day (Open-Meteo refreshes daily)
    SELECT
        TO_DATE(ingested_at)                AS weather_date,
        AVG(temperature_c)                  AS temperature_c,
        FIRST(conditions, TRUE)             AS conditions,
        AVG(attendance_impact_pct)          AS attendance_impact_pct
    FROM `{CATALOG}`.`{DLT_SCHEMA}`.`gold_weather_attendance_impact`
    GROUP BY TO_DATE(ingested_at)
) w
FULL OUTER JOIN `{CATALOG}`.`{DLT_SCHEMA}`.`gold_daily_sales_kpi` s
    ON w.weather_date = s.order_date
""")

print("✅ gold_matchday_intelligence created")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Gold View 2: Commercial Summary (sales KPIs, region-focused)

# COMMAND ----------

# DBTITLE 1,gold_commercial_summary
spark.sql(f"""
CREATE OR REPLACE VIEW `{CATALOG}`.`{SCHEMA}`.`gold_commercial_summary`
COMMENT 'Daily commercial KPIs by region — revenue, orders, avg order value. Use for trend and region comparison questions.'
AS
SELECT
    order_date,
    crm_region,
    ROUND(revenue, 2)          AS revenue,
    orders,
    ROUND(avg_order_value, 2)  AS avg_order_value,
    -- Running total per region (window)
    SUM(revenue) OVER (
        PARTITION BY crm_region
        ORDER BY order_date
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    )                          AS revenue_cumulative,
    -- 7-day rolling average
    AVG(revenue) OVER (
        PARTITION BY crm_region
        ORDER BY order_date
        ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
    )                          AS revenue_7d_avg
FROM `{CATALOG}`.`{DLT_SCHEMA}`.`gold_daily_sales_kpi`
""")

print("✅ gold_commercial_summary created")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Copy existing gold tables into target schema (if DLT schema differs)

# COMMAND ----------

# DBTITLE 1,Mirror IoT health table if needed
if DLT_SCHEMA != SCHEMA:
    spark.sql(f"""
    CREATE OR REPLACE VIEW `{CATALOG}`.`{SCHEMA}`.`gold_operational_health_iot`
    AS SELECT * FROM `{CATALOG}`.`{DLT_SCHEMA}`.`gold_operational_health_iot`
    """)
    spark.sql(f"""
    CREATE OR REPLACE VIEW `{CATALOG}`.`{SCHEMA}`.`gold_weather_attendance_impact`
    AS SELECT * FROM `{CATALOG}`.`{DLT_SCHEMA}`.`gold_weather_attendance_impact`
    """)
    spark.sql(f"""
    CREATE OR REPLACE VIEW `{CATALOG}`.`{SCHEMA}`.`gold_daily_sales_kpi`
    AS SELECT * FROM `{CATALOG}`.`{DLT_SCHEMA}`.`gold_daily_sales_kpi`
    """)
    print("✅ Views mirrored from DLT schema")
else:
    print("ℹ️  DLT schema matches target schema — no mirroring needed")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Column-Level Comments (helps Genie understand context)

# COMMAND ----------

# DBTITLE 1,Add column descriptions to gold_matchday_intelligence
for col, comment in [
    ("event_date",               "Calendar date (UTC) — join key across all tables"),
    ("temperature_c",            "Air temperature in Celsius at Old Trafford"),
    ("conditions",               "Weather classification: clear | cloudy | drizzle | rain"),
    ("attendance_impact_pct",    "Estimated % change in attendance vs average due to weather (negative = fewer fans)"),
    ("crm_region",               "Geographic CRM sales region: UK | Europe | Asia Pacific | Americas | Middle East"),
    ("revenue",                  "Total commercial revenue in GBP (£) for this date and region"),
    ("orders",                   "Number of commercial transactions (merchandise, hospitality, F&B)"),
    ("avg_order_value",          "Average spend per transaction in GBP (£)"),
    ("matchday_condition_rating","Summary weather quality: Excellent | Good | Fair | Poor"),
]:
    try:
        spark.sql(f"""
        ALTER VIEW `{CATALOG}`.`{SCHEMA}`.`gold_matchday_intelligence`
        ALTER COLUMN `{col}` COMMENT '{comment}'
        """)
    except Exception:
        pass  # ALTER COLUMN COMMENT not supported on all view types — metadata still set at create time

# COMMAND ----------

# MAGIC %md
# MAGIC ## Access Grants

# COMMAND ----------

# DBTITLE 1,Grant analyst access to all Genie tables
tables_to_grant = [
    "gold_matchday_intelligence",
    "gold_commercial_summary",
    "gold_daily_sales_kpi",
    "gold_weather_attendance_impact",
    "gold_operational_health_iot",
]

for table in tables_to_grant:
    try:
        spark.sql(f"""
        GRANT SELECT ON `{CATALOG}`.`{SCHEMA}`.`{table}`
        TO `{ANALYST_GROUP}`
        """)
        print(f"✅ Granted SELECT on {table} to {ANALYST_GROUP}")
    except Exception as e:
        print(f"⚠️  Grant on {table}: {e}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Verification

# COMMAND ----------

# DBTITLE 1,Smoke-test all Genie tables
import traceback

all_ok = True
for table in tables_to_grant:
    try:
        count = spark.sql(f"SELECT COUNT(*) AS n FROM `{CATALOG}`.`{SCHEMA}`.`{table}`").collect()[0]["n"]
        print(f"✅ {table}: {count:,} rows")
    except Exception as e:
        print(f"❌ {table}: {e}")
        all_ok = False

if all_ok:
    print("\n🟢 All Genie tables ready — deploy the Genie Space now:")
    print("   databricks bundle deploy --target dev")
else:
    print("\n🔴 Some tables failed — run the DLT pipelines first, then re-run this notebook")
