"""
Download / prepare football CV demo data.

Priority order:
  1. SoccerTrack v2 — free tracking annotations (no video, but usable for overlay demos)
  2. SoccerNet — broadcast video, BUT requires NDA / manual approval
  3. Local sample mp4 — drop any football clip into data/sample_videos/
  4. Generated mock JSON — always works

Run: python scripts/get_football_cv_data.py
"""
import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
RAW = DATA / "raw"
SAMPLE_VIDEOS = DATA / "sample_videos"
PROCESSED = DATA / "processed"
MOCK = DATA / "mock"

DIRS = [RAW, SAMPLE_VIDEOS, PROCESSED, MOCK]


def ensure_dirs():
    for d in DIRS:
        d.mkdir(parents=True, exist_ok=True)
        (d / ".gitkeep").touch(exist_ok=True)
    print("✓ Created data directories")


def try_soccertrack():
    """SoccerTrack v2: free annotations on GitHub. No raw video but tracking CSVs."""
    print("\n── SoccerTrack v2 ──")
    print("  SoccerTrack v2 provides bounding-box tracking annotations (CSV/JSON).")
    print("  Repo: https://github.com/AtomScott/SoccerTrack")
    print("  These annotations can enrich the overlay demo but do not include raw video.")
    print("  STATUS: Freely accessible, no NDA needed.")
    print("  → To use: clone the repo into data/raw/soccertrack and parse MOT-format CSVs.\n")


def try_soccernet():
    """SoccerNet: broadcast video — requires NDA."""
    print("── SoccerNet ──")
    print("  ⚠️  SoccerNet video data REQUIRES an NDA / manual approval request.")
    print("  Apply at: https://www.soccer-net.org/")
    print("  Until approved, the pipeline uses local sample video or mock data.")
    print("  STATUS: Blocked until NDA is signed.\n")


def try_statsbomb():
    """StatsBomb open data — event metadata only, no video."""
    print("── StatsBomb Open Data ──")
    print("  StatsBomb provides free event-level JSON (passes, shots, formations).")
    print("  Repo: https://github.com/statsbomb/open-data")
    print("  Useful for enrichment / tactical overlays, NOT for raw video.")
    print("  STATUS: Freely accessible.\n")


def check_sample_video():
    print("── Local sample video ──")
    vids = list(SAMPLE_VIDEOS.glob("*.mp4"))
    if vids:
        print(f"  ✓ Found {len(vids)} video(s): {[v.name for v in vids]}")
        print("  The analysis pipeline will use these for real CV processing.")
    else:
        print("  No mp4 files in data/sample_videos/.")
        print("  Drop any football clip there and re-run, or use mock data.")
    print()


def generate_mock():
    print("── Mock data ──")
    mock_file = MOCK / "vision_mock.json"
    sys.path.insert(0, str(ROOT))
    from server.vision.analyzer import _generate_inline_mock
    players = _generate_inline_mock()
    payload = {"players": players, "source": "mock_data"}
    mock_file.write_text(json.dumps(payload, indent=2))
    print(f"  ✓ Generated {len(players)} mock players → {mock_file}")
    print("  The app works end-to-end with this data even without real video.\n")


def main():
    print("=" * 60)
    print("  Football CV Data Preparation")
    print("=" * 60)
    ensure_dirs()
    try_soccertrack()
    try_soccernet()
    try_statsbomb()
    check_sample_video()
    generate_mock()
    print("=" * 60)
    print("  Done. The app will use real CV when ultralytics + opencv")
    print("  are installed and a video is uploaded. Otherwise → mock.")
    print("=" * 60)


if __name__ == "__main__":
    main()
