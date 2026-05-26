"""
Create a Databricks external model endpoint for OpenAI GPT.
Run in a Databricks notebook (with databricks context) or with Databricks Connect.

Prerequisites:
1. Create a secret scope and store your OpenAI API key:
   databricks secrets create-scope my_openai_secret_scope
   databricks secrets put-secret my_openai_secret_scope openai_api_key

2. Set SECRET_SCOPE and ENDPOINT_NAME via env vars (or edit below).
"""
import os

SECRET_SCOPE = os.environ.get("OPENAI_SECRET_SCOPE", "my_openai_secret_scope")
SECRET_KEY = os.environ.get("OPENAI_SECRET_KEY", "openai_api_key")
ENDPOINT_NAME = os.environ.get("OPENAI_ENDPOINT_NAME", "openai-gpt-4o-mini")


def create_openai_external_endpoint():
    """Create external model endpoint for OpenAI GPT-4o-mini via Databricks."""
    import mlflow.deployments

    client = mlflow.deployments.get_deploy_client("databricks")

    # Use {{secrets/scope/key}} format for Databricks secrets
    secret_ref = f"{{{{secrets/{SECRET_SCOPE}/{SECRET_KEY}}}}}"

    config = {
        "served_entities": [
            {
                "name": "openai-gpt-chat",
                "external_model": {
                    "name": "gpt-4o-mini",
                    "provider": "openai",
                    "task": "llm/v1/chat",
                    "openai_config": {
                        "openai_api_key": secret_ref,
                    },
                },
            }
        ]
    }

    try:
        client.create_endpoint(name=ENDPOINT_NAME, config=config)
        print(f"Created endpoint: {ENDPOINT_NAME}")
        print(f"Set GPT_FALLBACK_ENDPOINT={ENDPOINT_NAME} in your app environment.")
    except Exception as e:
        if "already exists" in str(e).lower() or "RESOURCE_ALREADY_EXISTS" in str(e):
            print(f"Endpoint {ENDPOINT_NAME} already exists. Update it via the Databricks UI if needed.")
        else:
            raise


if __name__ == "__main__":
    create_openai_external_endpoint()
