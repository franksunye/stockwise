"""hk_name_en_curated.json — bundled trusted HK English names (sync overlay)."""

import json
from pathlib import Path


def test_curated_hk_file_exists_and_covers_tencent():
    root = Path(__file__).resolve().parent.parent
    path = root / "data" / "hk_name_en_curated.json"
    assert path.is_file(), f"missing {path}"
    raw = json.loads(path.read_text(encoding="utf-8"))
    assert isinstance(raw, dict)
    assert raw.get("00700") == "Tencent Holdings"
