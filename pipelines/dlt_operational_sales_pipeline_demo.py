# Databricks Delta Live Tables — ADF → DLT migration demo
# Operational / sales use case: CRM API + ERP SQL + IoT telemetry → medallion → governed serving
#
# Run as a Delta Live Tables pipeline in Databricks (Pipeline UI or bundle).
# Comments explain each layer for customer-facing walkthroughs.
#
# `spark` is provided by the Databricks / DLT runtime when deployed (not required locally).

import dlt
from pyspark.sql import functions as F
from pyspark.sql.types import *

# -----------------------------------------------------------------------------
# BRONZE — raw ingestion (append, schema drift tolerant, near real-time)
# Sources: cloud storage landing (API/IoT JSON), JDBC snapshot (ERP)
# -----------------------------------------------------------------------------


@dlt.table(
    name="bronze_crm_events",
    comment="RAW: CRM webhook / API exports landed as JSON — immutable audit trail",
)
def bronze_crm_events():
    return (
        spark.readStream.format("cloudFiles")
        .option("cloudFiles.format", "json")
        .option("cloudFiles.schemaLocation", "/Volumes/catalog/schema/pipeline/checkpoints/crm")
        .load("/Volumes/catalog/schema/landing/crm/")
    )


@dlt.table(
    name="bronze_erp_orders",
    comment="RAW: ERP order headers — batch or incremental from SQL via Auto Loader / JDBC in production",
)
def bronze_erp_orders():
    # Demo: replace with cloudFiles(CSV) or streaming JDBC pattern your customer uses
    return (
        spark.readStream.format("cloudFiles")
        .option("cloudFiles.format", "csv")
        .option("header", "true")
        .option("cloudFiles.schemaLocation", "/Volumes/catalog/schema/pipeline/checkpoints/erp")
        .load("/Volumes/catalog/schema/landing/erp/orders/")
    )


@dlt.table(
    name="bronze_iot_telemetry",
    comment="RAW: IoT device readings (high volume) — append-only stream",
)
def bronze_iot_telemetry():
    return (
        spark.readStream.format("cloudFiles")
        .option("cloudFiles.format", "json")
        .option("cloudFiles.schemaLocation", "/Volumes/catalog/schema/pipeline/checkpoints/iot")
        .load("/Volumes/catalog/schema/landing/iot/")
    )


# -----------------------------------------------------------------------------
# SILVER — cleansed, conformed, joins + DATA QUALITY (expectations)
# -----------------------------------------------------------------------------


@dlt.table(
    name="silver_orders_enriched",
    comment="CLEAN: Standardised keys, types, deduped order lines joined to CRM account",
)
@dlt.expect("order_id_present", "order_id IS NOT NULL")
@dlt.expect("valid_amount", "order_amount >= 0")
@dlt.expect_or_drop("currency_iso", "length(currency) = 3")
def silver_orders_enriched():
    erp = dlt.read_stream("bronze_erp_orders")
    crm = dlt.read_stream("bronze_crm_events")
    return (
        erp.filter(F.col("order_id").isNotNull())
        .withColumn("order_amount", F.col("order_amount").cast("decimal(18,2)"))
        .withColumn("event_ts", F.to_timestamp("event_ts"))
        .join(
            F.broadcast(crm.select("account_id", "crm_region").dropDuplicates(["account_id"])),
            "account_id",
            "left",
        )
    )


@dlt.table(
    name="silver_iot_device_day",
    comment="CLEAN: IoT rolled to device-day with basic validation",
)
@dlt.expect("device_id_present", "device_id IS NOT NULL")
@dlt.expect("reading_in_range", "reading BETWEEN -50 AND 200")
def silver_iot_device_day():
    return (
        dlt.read_stream("bronze_iot_telemetry")
        .withColumn("event_date", F.to_date("ts"))
        .groupBy("device_id", "event_date")
        .agg(F.avg("reading").alias("avg_reading"), F.count("*").alias("reading_count"))
    )


# -----------------------------------------------------------------------------
# GOLD — business-ready aggregates for BI / ML / reverse ETL
# -----------------------------------------------------------------------------


@dlt.table(
    name="gold_daily_sales_kpi",
    comment="CURATED: Daily revenue and order KPIs for exec dashboards & Genie",
)
def gold_daily_sales_kpi():
    o = dlt.read_stream("silver_orders_enriched")
    return (
        o.withColumn("order_date", F.to_date("event_ts"))
        .groupBy("order_date", "crm_region")
        .agg(
            F.sum("order_amount").alias("revenue"),
            F.countDistinct("order_id").alias("orders"),
            F.avg("order_amount").alias("avg_order_value"),
        )
    )


@dlt.table(
    name="gold_operational_health_iot",
    comment="CURATED: IoT health signals joined to sales regions for ops + commercial storytelling",
)
def gold_operational_health_iot():
    sales = dlt.read("gold_daily_sales_kpi")
    iot = dlt.read_stream("silver_iot_device_day")
    return (
        iot.join(sales, iot.event_date == sales.order_date, "left")
        .select(
            "device_id",
            "event_date",
            "avg_reading",
            "reading_count",
            "crm_region",
            "revenue",
        )
    )

# Unity Catalog: grant SELECT on catalog.schema.gold_* to analysts group; use row filters / tags in UC UI.
# Databricks Workflows: schedule this DLT pipeline; downstream job refreshes warehouse + sends DQ alerts on failure.
