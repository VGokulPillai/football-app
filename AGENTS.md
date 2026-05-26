# Agent notes — Man United Football Intelligence

After **any** change under `mufc/` (frontend, `app.py`, `server/`, bundles), run deploy so the Databricks App matches the repo:

```bash
cd mufc && ./scripts/deploy-dev.sh
```

Requires Databricks CLI auth for the `dev` target profile in `databricks.yml`.
