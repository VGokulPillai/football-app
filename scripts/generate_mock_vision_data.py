"""
Generate mock football CV analysis data and save to data/mock/vision_mock.json.

Run: python scripts/generate_mock_vision_data.py
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from server.vision.analyzer import _generate_inline_mock  # noqa: E402

OUT = Path(__file__).resolve().parent.parent / "data" / "mock" / "vision_mock.json"


def main():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    players = _generate_inline_mock()
    payload = {"players": players, "source": "mock_data"}
    OUT.write_text(json.dumps(payload, indent=2))
    print(f"Wrote {len(players)} players to {OUT}")


if __name__ == "__main__":
    main()
