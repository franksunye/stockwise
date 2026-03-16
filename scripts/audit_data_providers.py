import os
import time
from dataclasses import dataclass, asdict
from typing import Any, Callable, Dict, List, Optional, Tuple

import akshare as ak
import pandas as pd


@dataclass
class EndpointResult:
    name: str
    func: str
    mode: str  # "normal" | "isolated"
    ok: bool
    empty: bool
    error: Optional[str]
    latency_sec: float
    row_count: Optional[int]
    columns: List[str]


def _timed_call(func: Callable[..., Any], **kwargs) -> Tuple[Any, float, Optional[str]]:
    start = time.time()
    try:
        res = func(**kwargs)
        return res, time.time() - start, None
    except Exception as e:  # noqa: BLE001
        return None, time.time() - start, f"{type(e).__name__}: {str(e)[:200]}"


def _isolated_env_call(func: Callable[..., Any], **kwargs) -> Tuple[Any, float, Optional[str]]:
    proxy_keys = [
        # lowercase (common in unix tooling)
        "http_proxy",
        "https_proxy",
        "all_proxy",
        "no_proxy",
        # uppercase (requests/urllib3 will also read these)
        "HTTP_PROXY",
        "HTTPS_PROXY",
        "ALL_PROXY",
        "NO_PROXY",
        # socks variants (some setups use these)
        "socks_proxy",
        "socks5_proxy",
        "SOCKS_PROXY",
        "SOCKS5_PROXY",
    ]
    orig = {k: os.environ.get(k) for k in proxy_keys}
    try:
        for k in proxy_keys:
            os.environ.pop(k, None)
        # Force direct connections for all hosts
        os.environ["NO_PROXY"] = "*"
        os.environ["no_proxy"] = "*"
        return _timed_call(func, **kwargs)
    finally:
        for k, v in orig.items():
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = v


def _summarize_df(df: Any) -> Tuple[bool, bool, Optional[int], List[str]]:
    if df is None:
        return False, True, None, []
    if isinstance(df, pd.DataFrame):
        empty = df.empty
        return True, empty, int(len(df)), list(map(str, df.columns))
    # Unknown type – treat as non-empty object
    return True, False, None, []


def audit_providers() -> List[EndpointResult]:
    """
    Local PoC to audit key AkShare endpoints used by the Almanac/Yellow Pages.

    It does NOT write to DB; just prints a concise table and returns structured results
    so we can later wire it into more formal logging if needed.
    """
    endpoints: List[Tuple[str, Callable[..., Any], Dict[str, Any]]] = [
        ("breadth_legu", ak.stock_market_activity_legu, {}),
        ("market_fund_flow", ak.stock_market_fund_flow, {}),
        ("index_spot_em", ak.stock_zh_index_spot_em, {}),
        ("index_daily_SH", ak.stock_zh_index_daily_em, {"symbol": "sh000001"}),
        ("index_daily_SZ", ak.stock_zh_index_daily_em, {"symbol": "sz399001"}),
        ("index_daily_CYB", ak.stock_zh_index_daily_em, {"symbol": "sz399006"}),
        ("zt_pool_up", ak.stock_zt_pool_em, {"date": time.strftime("%Y%m%d")}),
        ("zt_pool_down", ak.stock_zt_pool_dtgc_em, {"date": time.strftime("%Y%m%d")}),
        ("zt_pool_broken", ak.stock_zt_pool_zbgc_em, {"date": time.strftime("%Y%m%d")}),
    ]

    print("🔬 AkShare Data Provider PoC (Yellow Pages Core)")
    print("-" * 72)
    proxies = {k: v for k, v in os.environ.items() if "proxy" in k.lower()}
    if proxies:
        print(f"🌐 Current proxy env: {proxies}")
    else:
        print("🌐 No proxy detected in environment.")

    all_results: List[EndpointResult] = []

    for name, func, kwargs in endpoints:
        print(f"\n=== {name} ===")

        # normal mode
        res, latency, err = _timed_call(func, **kwargs)
        ok, empty, rows, cols = _summarize_df(res)
        r_normal = EndpointResult(
            name=name,
            func=func.__name__,
            mode="normal",
            ok=ok and err is None and not empty,
            empty=empty,
            error=err,
            latency_sec=round(latency, 2),
            row_count=rows,
            columns=cols,
        )
        all_results.append(r_normal)
        status = "✅" if r_normal.ok else "❌"
        print(f"{status} normal  | {r_normal.latency_sec:5.2f}s | rows={rows} | empty={empty} | err={err or '-'}")

        # isolated mode
        res_i, latency_i, err_i = _isolated_env_call(func, **kwargs)
        ok_i, empty_i, rows_i, cols_i = _summarize_df(res_i)
        r_iso = EndpointResult(
            name=name,
            func=func.__name__,
            mode="isolated",
            ok=ok_i and err_i is None and not empty_i,
            empty=empty_i,
            error=err_i,
            latency_sec=round(latency_i, 2),
            row_count=rows_i,
            columns=cols_i,
        )
        all_results.append(r_iso)
        status_i = "✅" if r_iso.ok else "❌"
        print(f"{status_i} isolated | {r_iso.latency_sec:5.2f}s | rows={rows_i} | empty={empty_i} | err={err_i or '-'}")

    print("\nSummary (JSON-like):")
    for r in all_results:
        print(asdict(r))

    return all_results


if __name__ == "__main__":
    audit_providers()
