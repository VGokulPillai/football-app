"""
Football video analysis pipeline.

Modes:
  1. Real: YOLO detection + centroid tracking on uploaded mp4
  2. Mock: Precomputed JSON from data/mock/vision_mock.json

The pipeline detects players, tracks them across frames, computes trajectories,
distance, speed, sprint counts, and a deterministic tactical-fit score.
"""
from __future__ import annotations

import json
import math
import os
import logging
from pathlib import Path
from typing import Any, Optional

import numpy as np

logger = logging.getLogger(__name__)

MOCK_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "mock" / "vision_mock.json"

# ── Tactical fit scoring (deterministic, no ML model needed) ────────────────

PITCH_WIDTH = 1920
PITCH_HEIGHT = 1080
PITCH_MID_X = PITCH_WIDTH / 2
PITCH_THIRD_X = PITCH_WIDTH / 3

ROLES = {
    "Attacking Winger": {
        "wide_weight": 0.35,
        "speed_weight": 0.30,
        "forward_weight": 0.20,
        "sprint_weight": 0.15,
    },
    "Defensive Midfielder": {
        "central_weight": 0.40,
        "stability_weight": 0.30,
        "defensive_zone_weight": 0.20,
        "distance_weight": 0.10,
    },
    "Overlapping Fullback": {
        "flank_weight": 0.30,
        "updown_weight": 0.30,
        "wide_channel_weight": 0.25,
        "sprint_weight": 0.15,
    },
}


def _score_winger(stats: dict) -> int:
    avg_x, avg_y = stats["avg_position"]
    wide = min(100, (abs(avg_y - PITCH_HEIGHT / 2) / (PITCH_HEIGHT / 2)) * 100)
    speed = min(100, stats["avg_speed"] / 4.0 * 100)
    forward = min(100, (avg_x / PITCH_WIDTH) * 100)
    sprint = min(100, stats["sprint_count"] / 15.0 * 100)
    w = ROLES["Attacking Winger"]
    return int(wide * w["wide_weight"] + speed * w["speed_weight"] +
               forward * w["forward_weight"] + sprint * w["sprint_weight"])


def _score_dm(stats: dict) -> int:
    avg_x, avg_y = stats["avg_position"]
    central = min(100, max(0, 100 - abs(avg_y - PITCH_HEIGHT / 2) / (PITCH_HEIGHT / 2) * 100))
    stability = min(100, max(0, 100 - stats["distance"] / 15.0 * 100))
    defensive = min(100, max(0, (1 - avg_x / PITCH_WIDTH) * 100))
    dist = min(100, stats["distance"] / 12.0 * 100)
    w = ROLES["Defensive Midfielder"]
    return int(central * w["central_weight"] + stability * w["stability_weight"] +
               defensive * w["defensive_zone_weight"] + dist * w["distance_weight"])


def _score_fullback(stats: dict) -> int:
    avg_x, avg_y = stats["avg_position"]
    positions = stats.get("positions", [])
    flank = min(100, (abs(avg_y - PITCH_HEIGHT / 2) / (PITCH_HEIGHT / 2)) * 100)
    if len(positions) > 2:
        ys = [p[1] for p in positions]
        updown = min(100, (max(ys) - min(ys)) / PITCH_HEIGHT * 150)
    else:
        updown = 40
    wide_channel = min(100, flank * 0.8 + (abs(avg_y - PITCH_HEIGHT / 2) > PITCH_HEIGHT * 0.3) * 30)
    sprint = min(100, stats["sprint_count"] / 12.0 * 100)
    w = ROLES["Overlapping Fullback"]
    return int(flank * w["flank_weight"] + updown * w["updown_weight"] +
               wide_channel * w["wide_channel_weight"] + sprint * w["sprint_weight"])


def _compute_fit_scores(stats: dict) -> dict[str, int]:
    return {
        "Attacking Winger": max(0, min(100, _score_winger(stats))),
        "Defensive Midfielder": max(0, min(100, _score_dm(stats))),
        "Overlapping Fullback": max(0, min(100, _score_fullback(stats))),
    }


def _generate_reasoning(fit: dict[str, int], stats: dict) -> str:
    best_role = max(fit, key=fit.get)
    if best_role == "Attacking Winger":
        return f"Wide advanced positioning (avg Y offset {abs(stats['avg_position'][1] - PITCH_HEIGHT/2):.0f}px) and {stats['sprint_count']} sprints suggest winger profile"
    elif best_role == "Defensive Midfielder":
        return f"Central positioning and measured movement ({stats['distance']:.1f}km) indicate defensive midfield suitability"
    else:
        return f"Repeated flank runs ({stats['sprint_count']} sprints, {stats['distance']:.1f}km) match overlapping fullback profile"


# ── Real video analysis (YOLO + centroid tracker) ──────────────────────────

def _try_real_analysis(video_path: str, sample_rate: int = 5) -> list[dict] | None:
    """
    Attempt real CV analysis using ultralytics YOLO.
    Returns None if dependencies are missing or processing fails.
    sample_rate: process every Nth frame for speed.
    """
    try:
        from ultralytics import YOLO
        import cv2
    except ImportError:
        logger.info("ultralytics or cv2 not installed — falling back to mock")
        return None

    try:
        model = YOLO("yolov8n.pt")
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            logger.warning("Cannot open video: %s", video_path)
            return None

        fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
        tracks: dict[int, list[tuple[float, float, int]]] = {}
        next_id = 1
        prev_centroids: list[tuple[int, float, float]] = []
        frame_idx = 0

        while True:
            ret, frame = cap.read()
            if not ret:
                break
            frame_idx += 1
            if frame_idx % sample_rate != 0:
                continue

            results = model(frame, classes=[0], verbose=False)
            current_centroids: list[tuple[float, float]] = []
            for box in results[0].boxes:
                x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                cx, cy = (x1 + x2) / 2, (y1 + y2) / 2
                current_centroids.append((float(cx), float(cy)))

            # Simple centroid matching
            used_prev = set()
            matched: list[tuple[int, float, float]] = []
            for cx, cy in current_centroids:
                best_id = None
                best_dist = 80.0  # max matching distance in pixels
                for pid, px, py in prev_centroids:
                    if pid in used_prev:
                        continue
                    d = math.hypot(cx - px, cy - py)
                    if d < best_dist:
                        best_dist = d
                        best_id = pid
                if best_id is not None:
                    used_prev.add(best_id)
                    matched.append((best_id, cx, cy))
                else:
                    matched.append((next_id, cx, cy))
                    next_id += 1

            for tid, cx, cy in matched:
                tracks.setdefault(tid, []).append((cx, cy, frame_idx))
            prev_centroids = matched

        cap.release()

        # Build player stats from tracks
        players = []
        for tid, points in tracks.items():
            if len(points) < 3:
                continue
            positions = [[p[0], p[1]] for p in points]
            total_dist_px = sum(
                math.hypot(positions[i][0] - positions[i-1][0], positions[i][1] - positions[i-1][1])
                for i in range(1, len(positions))
            )
            # Rough px-to-km conversion (pitch ~105m mapped to frame width)
            frame_w = PITCH_WIDTH
            px_per_m = frame_w / 105.0
            dist_km = (total_dist_px / px_per_m) / 1000.0
            duration_s = len(points) * sample_rate / fps
            avg_speed = dist_km / (duration_s / 3600) if duration_s > 0 else 0

            # Count sprints (speed bursts > 6 m/s between consecutive detections)
            sprint_count = 0
            for i in range(1, len(positions)):
                seg_px = math.hypot(positions[i][0] - positions[i-1][0], positions[i][1] - positions[i-1][1])
                seg_m = seg_px / px_per_m
                seg_t = sample_rate / fps
                if seg_t > 0 and seg_m / seg_t > 6.0:
                    sprint_count += 1

            avg_x = np.mean([p[0] for p in positions])
            avg_y = np.mean([p[1] for p in positions])

            stats = {
                "id": tid,
                "positions": positions[::max(1, len(positions) // 30)],  # subsample for JSON size
                "distance": round(dist_km, 2),
                "avg_speed": round(avg_speed, 2),
                "sprint_count": sprint_count,
                "avg_position": [round(avg_x, 1), round(avg_y, 1)],
            }
            stats["fit_scores"] = _compute_fit_scores(stats)
            stats["reasoning"] = _generate_reasoning(stats["fit_scores"], stats)
            players.append(stats)

        players.sort(key=lambda p: p["distance"], reverse=True)
        return players[:22] if players else None

    except Exception as e:
        logger.warning("Real analysis failed: %s", e)
        return None


# ── Mock fallback ──────────────────────────────────────────────────────────

def _load_mock() -> list[dict]:
    if MOCK_PATH.exists():
        data = json.loads(MOCK_PATH.read_text())
        return data.get("players", data) if isinstance(data, dict) else data

    # Inline minimal fallback if mock file doesn't exist yet
    return _generate_inline_mock()


def _generate_inline_mock() -> list[dict]:
    """Generate mock player tracking data on the fly."""
    rng = np.random.default_rng(42)
    players = []
    templates = [
        ("Winger", 1500, 200, 11.5, 3.2, 12),
        ("Winger", 1600, 880, 10.8, 3.0, 10),
        ("CDM", 900, 540, 9.2, 2.4, 4),
        ("CDM", 850, 500, 8.8, 2.2, 3),
        ("LB", 600, 150, 10.1, 2.8, 9),
        ("RB", 600, 930, 9.8, 2.7, 8),
        ("ST", 1700, 540, 10.5, 2.9, 11),
        ("CAM", 1300, 520, 10.0, 2.6, 7),
        ("CB", 400, 450, 7.5, 1.8, 2),
        ("CB", 400, 630, 7.2, 1.7, 1),
        ("GK", 100, 540, 3.0, 0.5, 0),
    ]
    for i, (role, base_x, base_y, dist, speed, sprints) in enumerate(templates, 1):
        n_pts = 25
        positions = []
        for j in range(n_pts):
            x = base_x + rng.normal(0, 60)
            y = base_y + rng.normal(0, 40)
            positions.append([round(max(0, min(PITCH_WIDTH, x)), 1),
                              round(max(0, min(PITCH_HEIGHT, y)), 1)])

        stats = {
            "id": i,
            "positions": positions,
            "distance": round(dist + rng.normal(0, 0.3), 2),
            "avg_speed": round(speed + rng.normal(0, 0.15), 2),
            "sprint_count": max(0, sprints + int(rng.normal(0, 1))),
            "avg_position": [round(base_x + rng.normal(0, 10), 1),
                             round(base_y + rng.normal(0, 10), 1)],
        }
        stats["fit_scores"] = _compute_fit_scores(stats)
        stats["reasoning"] = _generate_reasoning(stats["fit_scores"], stats)
        players.append(stats)

    return players


# ── Public API ──────────────────────────────────────────────────────────────

async def analyze_video(video_path: str | None = None) -> dict[str, Any]:
    """
    Run the full analysis pipeline.
    Returns {"players": [...], "source": "real_video" | "mock_data"}.
    """
    if video_path and os.path.isfile(video_path):
        players = _try_real_analysis(video_path)
        if players:
            return {"players": players, "source": "real_video"}

    players = _load_mock()
    return {"players": players, "source": "mock_data"}
