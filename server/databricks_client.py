"""Databricks SQL client for querying Delta Lake tables."""
import os
from typing import Any, Optional
from databricks.sdk import WorkspaceClient
from databricks.sdk.service.sql import StatementExecutionAPI
from server.config import get_workspace_client, get_catalog, get_schema


def get_warehouse_id() -> Optional[str]:
    """Get SQL warehouse ID from environment or default."""
    return os.environ.get("DATABRICKS_WAREHOUSE_ID")


def execute_sql(query: str, warehouse_id: Optional[str] = None) -> list[dict[str, Any]]:
    """Execute SQL query and return results as list of dicts."""
    w = get_workspace_client()
    wh_id = warehouse_id or get_warehouse_id()
    if not wh_id:
        return []

    api = StatementExecutionAPI(w.api_client)
    result = api.execute_statement(
        warehouse_id=wh_id,
        statement=query,
        wait_timeout="60s",
    )

    if not result.result or not result.result.data_array:
        return []

    columns = [c.name for c in result.result.schema.columns]
    return [dict(zip(columns, row)) for row in result.result.data_array]


def table_exists(table_name: str) -> bool:
    """Check if a table exists in the catalog."""
    catalog = get_catalog()
    schema = get_schema()
    try:
        result = execute_sql(
            f"SELECT 1 FROM {catalog}.{schema}.{table_name} LIMIT 1"
        )
        return True
    except Exception:
        return False
