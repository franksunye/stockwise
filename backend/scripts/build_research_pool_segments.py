"""
Build grouped research-pool manifests from a base research-pool manifest.

Current segment dimensions:
1) board_group
2) price_band
"""

from __future__ import annotations

import argparse
import json
from collections import defaultdict
from datetime import datetime
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser(description="Build grouped manifests from a research-pool manifest.")
    parser.add_argument("--manifest", required=True, help="Base research-pool manifest path")
    parser.add_argument("--output-dir", required=True, help="Directory for grouped manifests")
    args = parser.parse_args()

    manifest_path = Path(args.manifest)
    payload = json.loads(manifest_path.read_text(encoding="utf-8"))
    symbols = payload.get("symbols") or []
    if not isinstance(symbols, list) or not symbols:
        raise ValueError(f"No symbols found in manifest: {manifest_path}")

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    grouped: dict[str, dict[str, list[dict]]] = {
        "board_group": defaultdict(list),
        "price_band": defaultdict(list),
    }

    for item in symbols:
        if not isinstance(item, dict):
            continue
        board = str(item.get("board_group") or "unknown")
        band = str(item.get("price_band") or "unknown")
        grouped["board_group"][board].append(item)
        grouped["price_band"][band].append(item)

    written: list[str] = []
    for dimension, buckets in grouped.items():
        for bucket, items in buckets.items():
            segment_payload = {
                "market": payload.get("market"),
                "purpose": "online_research_pool_segment",
                "pool_name": f"{payload.get('pool_name', 'research_pool')}_{dimension}_{bucket}",
                "generated_at": datetime.now().isoformat(timespec="seconds"),
                "base_manifest": str(manifest_path),
                "dimension": dimension,
                "segment": bucket,
                "target_size": len(items),
                "actual_size": len(items),
                "latest_reference_date": payload.get("latest_reference_date"),
                "symbols": items,
            }
            file_name = f"{dimension}_{bucket}.json"
            out_path = output_dir / file_name
            out_path.write_text(json.dumps(segment_payload, ensure_ascii=False, indent=2), encoding="utf-8")
            written.append(str(out_path))

    print(json.dumps({"written": written, "count": len(written)}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
