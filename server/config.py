"""Configuration for FC Barcelona Intelligence Platform - dual-mode auth for Databricks Apps vs local."""
import os
from databricks.sdk import WorkspaceClient

IS_DATABRICKS_APP = bool(os.environ.get("DATABRICKS_APP_NAME"))


def get_workspace_client() -> WorkspaceClient:
    """Get authenticated WorkspaceClient."""
    if IS_DATABRICKS_APP:
        return WorkspaceClient()
    profile = os.environ.get("DATABRICKS_PROFILE", "DEFAULT")
    return WorkspaceClient(profile=profile)


def get_oauth_token() -> str:
    """Get OAuth token for API authentication."""
    client = get_workspace_client()
    auth = client.config.authenticate()
    if auth and "Authorization" in auth:
        return auth["Authorization"].replace("Bearer ", "")
    return ""


def get_workspace_host() -> str:
    """Get workspace host URL with https:// prefix."""
    if IS_DATABRICKS_APP:
        host = os.environ.get("DATABRICKS_HOST", "")
        if host and not host.startswith("http"):
            host = f"https://{host}"
        return host
    client = get_workspace_client()
    return client.config.host or ""


def get_catalog() -> str:
    return os.environ.get("CATALOG", "fcb")


def get_schema() -> str:
    return os.environ.get("SCHEMA", "default")
