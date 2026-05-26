"""Vision scouting API — football computer vision analysis."""
import os
import tempfile
import logging

from fastapi import APIRouter, UploadFile, File

from server.vision.analyzer import analyze_video

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/vision", tags=["vision"])


@router.post("/analyze")
async def analyze(video: UploadFile | None = File(None)):
    """
    Analyze an uploaded football mp4.
    If no file is provided (or CV deps missing), returns mock analysis.
    """
    video_path = None

    if video and video.filename:
        try:
            suffix = os.path.splitext(video.filename)[1] or ".mp4"
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                content = await video.read()
                tmp.write(content)
                video_path = tmp.name
        except Exception as e:
            logger.warning("Failed to save uploaded video: %s", e)

    try:
        result = await analyze_video(video_path)
    finally:
        if video_path and os.path.isfile(video_path):
            try:
                os.unlink(video_path)
            except OSError:
                pass

    return result


@router.get("/status")
async def vision_status():
    """Check whether real CV processing is available."""
    try:
        from ultralytics import YOLO  # noqa: F401
        import cv2  # noqa: F401
        real = True
    except ImportError:
        real = False
    return {"real_cv_available": real, "mock_fallback": True}
