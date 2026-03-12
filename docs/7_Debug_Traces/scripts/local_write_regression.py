import argparse
import json
import os
import sqlite3
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List


WORKSPACE_ROOT = Path("/Users/yesun/Code/stockwise")
RESULTS_DIR = WORKSPACE_ROOT / "docs" / "7_Debug_Traces" / "results" / "local_write_regressions"
LOCAL_DB_PATH = WORKSPACE_ROOT / "data" / "stockwise.db"


def _run_analysis(symbol: str, as_of_date: str, model: str, variant: str | None) -> Dict[str, Any]:
    env = os.environ.copy()
    env["DB_SOURCE"] = "local"
    if variant:
        env["STOCK_ANALYSIS_PROMPT_VARIANT"] = variant
    else:
        env.pop("STOCK_ANALYSIS_PROMPT_VARIANT", None)

    cmd = [
        str(WORKSPACE_ROOT / ".venv" / "bin" / "python"),
        "backend/main.py",
        "--analyze",
        "--symbol",
        symbol,
        "--date",
        as_of_date,
        "--model",
        model,
        "--force",
    ]
    started = time.time()
    proc = subprocess.run(
        cmd,
        cwd=str(WORKSPACE_ROOT),
        env=env,
        capture_output=True,
        text=True,
    )
    elapsed = round(time.time() - started, 3)
    return {
        "model": model,
        "returncode": proc.returncode,
        "elapsed_s": elapsed,
        "stdout_tail": proc.stdout[-3000:],
        "stderr_tail": proc.stderr[-3000:],
    }


def _fetch_saved_row(symbol: str, as_of_date: str, model: str) -> Dict[str, Any] | None:
    conn = sqlite3.connect(str(LOCAL_DB_PATH))
    try:
        conn.row_factory = sqlite3.Row
        row = conn.execute(
            """
            SELECT
              symbol,
              date,
              model_id,
              prompt_version,
              signal,
              confidence,
              token_usage_input,
              token_usage_output,
              execution_time_ms,
              is_primary,
              json_extract(ai_reasoning, '$.summary') AS summary,
              json_extract(ai_reasoning, '$.tomorrow_focus') AS tomorrow_focus
            FROM ai_predictions_v2
            WHERE symbol = ? AND date = ? AND model_id = ?
            """,
            (symbol, as_of_date, model),
        ).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def main() -> int:
    parser = argparse.ArgumentParser(description="Run local production-path write regression for one or more models.")
    parser.add_argument("--symbol", default="300502")
    parser.add_argument("--date", default="2026-03-12")
    parser.add_argument(
        "--models",
        nargs="+",
        default=["gemini-3-flash"],
        help="Model ids to run in sequence.",
    )
    parser.add_argument(
        "--variant",
        default=None,
        choices=["legacy", "b2", None],
        help="Force prompt variant. Omit to use current default.",
    )
    parser.add_argument("--cooldown-s", type=float, default=5.0)
    args = parser.parse_args()

    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    run_id = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_dir = RESULTS_DIR / run_id
    output_dir.mkdir(parents=True, exist_ok=True)

    results: List[Dict[str, Any]] = []
    for index, model in enumerate(args.models):
        run_meta = _run_analysis(args.symbol, args.date, model, args.variant)
        saved_row = _fetch_saved_row(args.symbol, args.date, model)
        results.append(
            {
                "model": model,
                "run": run_meta,
                "saved_row": saved_row,
            }
        )
        if index < len(args.models) - 1 and args.cooldown_s > 0:
            time.sleep(args.cooldown_s)

    summary = {
        "symbol": args.symbol,
        "date": args.date,
        "variant": args.variant or "default",
        "models": [
            {
                "model": item["model"],
                "returncode": item["run"]["returncode"],
                "prompt_version": (item["saved_row"] or {}).get("prompt_version"),
                "signal": (item["saved_row"] or {}).get("signal"),
                "confidence": (item["saved_row"] or {}).get("confidence"),
                "execution_time_ms": (item["saved_row"] or {}).get("execution_time_ms"),
                "token_usage_input": (item["saved_row"] or {}).get("token_usage_input"),
                "token_usage_output": (item["saved_row"] or {}).get("token_usage_output"),
            }
            for item in results
        ],
    }

    (output_dir / "results.json").write_text(
        json.dumps({"summary": summary, "details": results}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    (output_dir / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    print(f"\nSaved local write regression to {output_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
