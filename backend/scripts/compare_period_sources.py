import argparse
import json
import os
import sys
from datetime import datetime, timedelta
from typing import Dict, List

import pandas as pd


PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

BACKEND_ROOT = os.path.join(PROJECT_ROOT, "backend")
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

from backend.fetchers import AkShareFetcher  # noqa: E402
from backend.sync.prices import _normalize_period_ohlcv  # noqa: E402
from backend.logger import logger  # noqa: E402


STANDARD_RENAME_MAP = {
    "日期": "date",
    "开盘": "open",
    "最高": "high",
    "最低": "low",
    "收盘": "close",
    "成交量": "volume",
    "涨跌幅": "change_percent",
}

NUMERIC_COLS = ["open", "high", "low", "close", "volume"]
COMPARE_COLS = ["open", "high", "low", "close", "volume"]


def _to_standard_frame(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return pd.DataFrame(columns=["date", *COMPARE_COLS, "change_percent"])

    out = df.rename(columns=STANDARD_RENAME_MAP).copy()
    required = {"date", *COMPARE_COLS}
    if not required.issubset(out.columns):
        missing = sorted(required - set(out.columns))
        raise ValueError(f"missing required columns: {missing}")

    out["date"] = pd.to_datetime(out["date"], errors="coerce")
    out = out.dropna(subset=["date"]).sort_values("date")

    for col in NUMERIC_COLS:
        out[col] = pd.to_numeric(out[col], errors="coerce")

    out = out.dropna(subset=COMPARE_COLS)
    out = out.drop_duplicates(subset=["date"], keep="last")

    if "change_percent" not in out.columns:
        out["change_percent"] = out["close"].pct_change().fillna(0) * 100
    else:
        out["change_percent"] = pd.to_numeric(out["change_percent"], errors="coerce").fillna(0)

    out["date"] = out["date"].dt.strftime("%Y-%m-%d")
    return out[["date", *COMPARE_COLS, "change_percent"]].reset_index(drop=True)


def _derive_from_daily(daily_df: pd.DataFrame, period: str) -> pd.DataFrame:
    standardized = _to_standard_frame(daily_df)
    return _normalize_period_ohlcv(standardized, period)


def _normalize_provider_period(period_df: pd.DataFrame) -> pd.DataFrame:
    return _to_standard_frame(period_df)


def _compare_frames(remote_df: pd.DataFrame, derived_df: pd.DataFrame, tail_bars: int) -> Dict:
    if remote_df.empty or derived_df.empty:
        return {
            "status": "missing",
            "remote_rows": int(len(remote_df)),
            "derived_rows": int(len(derived_df)),
            "overlap_rows": 0,
        }

    remote_tail = remote_df.tail(tail_bars).copy()
    derived_tail = derived_df.tail(tail_bars).copy()

    merged = remote_tail.merge(
        derived_tail,
        on="date",
        how="inner",
        suffixes=("_remote", "_derived"),
    ).sort_values("date")

    if merged.empty:
        return {
            "status": "no_overlap",
            "remote_rows": int(len(remote_df)),
            "derived_rows": int(len(derived_df)),
            "overlap_rows": 0,
            "remote_tail_dates": remote_tail["date"].tolist(),
            "derived_tail_dates": derived_tail["date"].tolist(),
        }

    max_abs_diff = {}
    exact_match = {}
    for col in COMPARE_COLS:
        diff = (merged[f"{col}_remote"] - merged[f"{col}_derived"]).abs()
        max_abs_diff[col] = float(diff.max()) if not diff.empty else 0.0
        exact_match[col] = bool((diff <= 1e-6).all())

    latest_remote = merged.iloc[-1]
    latest_snapshot = {
        "date": latest_remote["date"],
        "remote": {col: float(latest_remote[f"{col}_remote"]) for col in COMPARE_COLS},
        "derived": {col: float(latest_remote[f"{col}_derived"]) for col in COMPARE_COLS},
    }

    return {
        "status": "compared",
        "remote_rows": int(len(remote_df)),
        "derived_rows": int(len(derived_df)),
        "overlap_rows": int(len(merged)),
        "date_match_ratio": float(len(merged)) / float(max(len(remote_tail), 1)),
        "max_abs_diff": max_abs_diff,
        "exact_match": exact_match,
        "latest_overlap": latest_snapshot,
    }


def compare_symbol(symbol: str, start_date: str, tail_bars: int) -> Dict:
    fetcher = AkShareFetcher()
    logger.info(f"🔎 Comparing period sources for {symbol} from {start_date}")

    daily_raw = fetcher.fetch_history(symbol, period="daily", start_date=start_date)
    if daily_raw.empty:
        return {
            "symbol": symbol,
            "status": "daily_fetch_failed",
        }

    result = {
        "symbol": symbol,
        "status": "ok",
        "daily_rows": int(len(daily_raw)),
        "periods": {},
    }

    for period in ("weekly", "monthly"):
        try:
            remote_raw = fetcher.fetch_history(symbol, period=period, start_date=start_date)
            remote_std = _normalize_provider_period(remote_raw)
            derived_std = _derive_from_daily(daily_raw, period)
            result["periods"][period] = _compare_frames(remote_std, derived_std, tail_bars=tail_bars)
        except Exception as exc:
            result["periods"][period] = {
                "status": "compare_error",
                "error": str(exc),
            }

    return result


def build_summary(results: List[Dict]) -> Dict:
    summary = {
        "symbols_total": len(results),
        "symbols_ok": 0,
        "daily_fetch_failed": 0,
        "weekly_exact": 0,
        "monthly_exact": 0,
        "weekly_missing": 0,
        "monthly_missing": 0,
    }

    for item in results:
        if item.get("status") != "ok":
            summary["daily_fetch_failed"] += 1
            continue

        summary["symbols_ok"] += 1
        weekly = item["periods"].get("weekly", {})
        monthly = item["periods"].get("monthly", {})

        if weekly.get("status") == "compared" and all(weekly.get("exact_match", {}).values()):
            summary["weekly_exact"] += 1
        elif weekly.get("status") != "compared":
            summary["weekly_missing"] += 1

        if monthly.get("status") == "compared" and all(monthly.get("exact_match", {}).values()):
            summary["monthly_exact"] += 1
        elif monthly.get("status") != "compared":
            summary["monthly_missing"] += 1

    return summary


def default_start_date() -> str:
    return (datetime.now() - timedelta(days=365 * 3)).strftime("%Y%m%d")


def main() -> int:
    parser = argparse.ArgumentParser(description="Compare remote weekly/monthly bars with daily-derived bars.")
    parser.add_argument("--symbols", nargs="+", required=True, help="Stock symbols to compare")
    parser.add_argument("--start-date", default=default_start_date(), help="Fetch start date in YYYYMMDD")
    parser.add_argument("--tail-bars", type=int, default=12, help="Number of tail bars to compare")
    parser.add_argument("--json", action="store_true", help="Print full JSON results")
    args = parser.parse_args()

    results = [compare_symbol(symbol, args.start_date, args.tail_bars) for symbol in args.symbols]
    summary = build_summary(results)

    print("=== Period Source Comparison Summary ===")
    print(json.dumps(summary, ensure_ascii=False, indent=2))

    if args.json:
        print("=== Full Results ===")
        print(json.dumps(results, ensure_ascii=False, indent=2))
    else:
        for item in results:
            if item.get("status") != "ok":
                print(f"- {item['symbol']}: daily fetch failed")
                continue

            weekly = item["periods"]["weekly"]
            monthly = item["periods"]["monthly"]
            print(
                f"- {item['symbol']}: "
                f"weekly={weekly.get('status')} "
                f"monthly={monthly.get('status')}"
            )
            if weekly.get("status") == "compared":
                print(
                    f"  weekly overlap={weekly['overlap_rows']} "
                    f"exact={all(weekly['exact_match'].values())} "
                    f"max_diff={weekly['max_abs_diff']}"
                )
            if monthly.get("status") == "compared":
                print(
                    f"  monthly overlap={monthly['overlap_rows']} "
                    f"exact={all(monthly['exact_match'].values())} "
                    f"max_diff={monthly['max_abs_diff']}"
                )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
