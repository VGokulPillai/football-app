"""FC Barcelona Football Intelligence Platform - FastAPI application."""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os
import logging

from server.routes import executive, audience, revenue, players, transfers, media, copilot, simulation, weather, football, ml, vision

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

try:
    from server.routes import squad_value
except Exception as e:
    logger.warning("squad_value route skipped: %s", e)
    squad_value = None

app = FastAPI(
    title="FC Barcelona Football Intelligence Platform",
    description="AI-powered control center for sporting and commercial decision-making",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API routes
app.include_router(executive.router, prefix="/api")
app.include_router(audience.router, prefix="/api")
app.include_router(revenue.router, prefix="/api")
app.include_router(players.router, prefix="/api")
app.include_router(transfers.router, prefix="/api")
app.include_router(media.router, prefix="/api")
app.include_router(copilot.router, prefix="/api")
app.include_router(simulation.router, prefix="/api")
app.include_router(weather.router, prefix="/api")
app.include_router(football.router, prefix="/api")
app.include_router(ml.router, prefix="/api")
app.include_router(vision.router, prefix="/api")
if squad_value:
    app.include_router(squad_value.router, prefix="/api")


@app.get("/api/health")
async def health():
    """Health check - Databricks Apps uses this to verify app is running."""
    return {"status": "ok", "app": "fcb"}


# Serve React frontend
frontend_dir = os.path.join(os.path.dirname(__file__), "frontend_dist")
logger.info("Frontend dir: %s (exists=%s)", frontend_dir, os.path.exists(frontend_dir))
if os.path.exists(frontend_dir):
    assets_dir = os.path.join(frontend_dir, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    # public/ images (e.g. /images/...) — SPA catch-all would otherwise return index.html
    images_dir = os.path.join(frontend_dir, "images")
    if os.path.exists(images_dir):
        app.mount("/images", StaticFiles(directory=images_dir), name="images")

    favicon_path = os.path.join(frontend_dir, "favicon.svg")
    if os.path.exists(favicon_path):

        @app.get("/favicon.svg")
        async def favicon():
            return FileResponse(favicon_path, media_type="image/svg+xml")

    crest_path = os.path.join(frontend_dir, "fcb-crest.png")
    if os.path.exists(crest_path):

        @app.get("/fcb-crest.png")
        async def crest():
            return FileResponse(crest_path, media_type="image/png")

    @app.get("/")
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str = ""):
        if full_path.startswith("api/") or full_path == "api":
            raise HTTPException(status_code=404, detail="Not found")
        if full_path.startswith("assets/"):
            raise HTTPException(status_code=404, detail="Not found")
        if full_path.startswith("images/") or full_path == "images":
            raise HTTPException(status_code=404, detail="Not found")
        index_path = os.path.join(frontend_dir, "index.html")
        if os.path.exists(index_path):
            # Avoid stale SPA shells (old index.html keeps pointing at previous hashed JS).
            return FileResponse(
                index_path,
                media_type="text/html",
                headers={
                    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
                    "Pragma": "no-cache",
                },
            )
        return {"message": "Frontend not built. Run: cd frontend && npm run build"}
else:

    @app.get("/")
    async def fallback_root():
        return {"message": "Frontend not found", "hint": "Ensure frontend/dist exists. Run: cd frontend && npm run build"}
