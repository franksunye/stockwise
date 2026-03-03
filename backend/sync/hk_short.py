"""
Hong Kong short selling data sync.
"""
import io
import os
import re
from datetime import datetime
from typing import Dict, List, Optional, Tuple

import pandas as pd
import requests
import urllib3

from backend.database import get_connection
from backend.logger import logger


HKEX_DAILY_MAIN_URL = "https://www.hkex.com.hk/eng/stat/smstat/ssturnover/ncms/ashtmain.htm"
HKEX_DAILY_GEM_URL = "https://www.hkex.com.hk/eng/stat/smstat/ssturnover/ncms/ashtgem.htm"
HKEX_ELIGIBLE_PAGE_URL = "https://www.hkex.com.hk/Services/Trading/Securities/Securities-Lists/Designated-Securities-Eligible-for-Short-Selling?sc_lang=en"
SFC_LATEST_CSV_URL = "https://www.sfc.hk/en/Regulatory-functions/Market/Short-position-reporting/Aggregated-reportable-short-positions-of-specified-shares/Latest-CSV"

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
ALLOW_INSECURE_SSL = os.getenv("HK_SHORT_ALLOW_INSECURE_SSL", "0") == "1"


def _http_get(url: str, timeout: int = 25, headers: Optional[Dict[str, str]] = None) -> requests.Response:
    last_err = None
    for attempt in range(3):
        try:
            return requests.get(url, timeout=timeout, headers=headers, allow_redirects=True)
        except requests.exceptions.SSLError as e:
            last_err = e
            if not ALLOW_INSECURE_SSL:
                logger.error(
                    f"SSL error on {url} attempt={attempt + 1}; insecure fallback disabled. "
                    "Set HK_SHORT_ALLOW_INSECURE_SSL=1 only for emergency workaround."
                )
                continue
            logger.warning(f"SSL error on {url} attempt={attempt + 1}, retrying with verify=False (emergency mode)")
            try:
                return requests.get(url, timeout=timeout, headers=headers, allow_redirects=True, verify=False)
            except Exception as e2:
                last_err = e2
        except Exception as e:
            last_err = e
    if last_err:
        raise last_err
    raise RuntimeError(f"HTTP GET failed: {url}")


def _normalize_hk_symbol(raw: object) -> Optional[str]:
    if raw is None:
        return None
    s = str(raw).strip()
    digits = re.sub(r"\D", "", s)
    if not digits:
        return None
    if len(digits) > 5:
        digits = digits[-5:]
    return digits.zfill(5)


def _to_float(raw: object) -> Optional[float]:
    if raw is None:
        return None
    s = str(raw).strip().replace(",", "")
    if s in ("", "-", "N/A", "n/a", "NA"):
        return None
    try:
        return float(s)
    except Exception:
        return None


def _extract_trade_date_from_hkex_report(text: str) -> Optional[str]:
    m = re.search(r"(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})", text)
    if not m:
        return None
    try:
        dt = datetime.strptime(m.group(1), "%d %b %Y")
        return dt.strftime("%Y-%m-%d")
    except Exception:
        return None


def _parse_hkex_daily_report(text: str, market: str) -> Tuple[Optional[str], pd.DataFrame]:
    trade_date = _extract_trade_date_from_hkex_report(text)
    lines = [ln.rstrip() for ln in text.splitlines() if ln.strip()]
    data_rows: List[Tuple[str, str, float, float]] = []

    row_re = re.compile(r"^\s*(\d{5})\s+(.+?)\s+([\d,]+(?:\.\d+)?)\s+([\d,]+)\s*$")
    for ln in lines:
        m = row_re.match(ln)
        if not m:
            continue
        symbol = _normalize_hk_symbol(m.group(1))
        if not symbol:
            continue
        name = m.group(2).strip()
        short_turnover = _to_float(m.group(3)) or 0.0
        short_volume = _to_float(m.group(4)) or 0.0
        data_rows.append((symbol, name, short_volume, short_turnover))

    if not data_rows:
        return trade_date, pd.DataFrame()

    df = pd.DataFrame(data_rows, columns=["symbol", "name", "short_volume", "short_turnover"])
    df["market"] = market
    return trade_date, df


def fetch_hkex_daily_short_selling() -> Tuple[Optional[str], pd.DataFrame]:
    headers = {"User-Agent": "Mozilla/5.0 (StockWise-HK-ShortSync)"}
    all_parts: List[pd.DataFrame] = []
    trade_dates: List[str] = []

    for market, url in (("MAIN", HKEX_DAILY_MAIN_URL), ("GEM", HKEX_DAILY_GEM_URL)):
        try:
            resp = _http_get(url, timeout=25, headers=headers)
            resp.raise_for_status()
            txt = resp.text
            if "available after day close" in txt.lower():
                logger.info(f"HKEX daily short report [{market}] not ready yet (before close).")
                continue
            td, part = _parse_hkex_daily_report(txt, market)
            if td:
                trade_dates.append(td)
            if not part.empty:
                all_parts.append(part)
            logger.info(f"HKEX daily short report [{market}] parsed rows={len(part)}")
        except Exception as e:
            logger.warning(f"HKEX daily short report [{market}] fetch/parse failed: {e}")
            continue

    if not all_parts:
        return (trade_dates[0] if trade_dates else None), pd.DataFrame()

    uniq_dates = sorted(set(trade_dates))
    if len(uniq_dates) > 1:
        logger.warning(f"HKEX MAIN/GEM trade dates mismatch: {uniq_dates}")
    trade_date = uniq_dates[-1] if uniq_dates else None
    return trade_date, pd.concat(all_parts, ignore_index=True)


def _extract_first_csv_link_from_hkex_eligible_page(html: str) -> Optional[str]:
    hrefs = re.findall(r'href=[\"\']([^\"\']+\.csv)[\"\']', html, flags=re.IGNORECASE)
    if not hrefs:
        return None
    candidates = [h for h in hrefs if "designated-securities-eligible-for-short-selling" in h.lower()]
    if not candidates:
        candidates = hrefs

    preferred = None
    for h in candidates:
        if "ds_list_int.csv" in h.lower():
            preferred = h
            break
    if not preferred:
        dated = []
        for h in candidates:
            m = re.search(r"ds_list(\d{8})\.csv", h, flags=re.IGNORECASE)
            if m:
                dated.append((m.group(1), h))
        preferred = sorted(dated, key=lambda x: x[0], reverse=True)[0][1] if dated else candidates[0]

    preferred = preferred.replace(" ", "%20")
    return preferred if preferred.startswith("http") else "https://www.hkex.com.hk" + preferred


def fetch_hkex_eligible_list() -> Tuple[str, pd.DataFrame]:
    headers = {"User-Agent": "Mozilla/5.0 (StockWise-HK-ShortSync)"}
    resp = _http_get(HKEX_ELIGIBLE_PAGE_URL, timeout=25, headers=headers)
    resp.raise_for_status()
    csv_url = _extract_first_csv_link_from_hkex_eligible_page(resp.text)
    if not csv_url:
        raise RuntimeError("Cannot find HKEX eligible CSV link from listing page")

    csv_resp = _http_get(csv_url, timeout=25, headers=headers)
    csv_resp.raise_for_status()
    raw = csv_resp.content.decode("utf-8-sig", errors="ignore")
    lines = [ln.strip() for ln in raw.splitlines() if ln.strip()]

    symbols: List[str] = []
    for ln in lines:
        # Skip metadata/header
        if ln.lower().startswith("list of designated securities"):
            continue
        if ln.lower().startswith("update date"):
            continue
        if ln.lower().startswith("note"):
            continue
        if ln.lower().startswith("no.,stock code"):
            continue
        parts = ln.split(",")
        if len(parts) < 2:
            continue
        sym = _normalize_hk_symbol(parts[1])
        if sym:
            symbols.append(sym)

    out = pd.DataFrame({"symbol": symbols})
    out = out.dropna(subset=["symbol"]).drop_duplicates(subset=["symbol"])
    snapshot_date = datetime.utcnow().strftime("%Y-%m-%d")
    logger.info(f"HKEX eligible list parsed rows={len(out)} url={csv_url}")
    return snapshot_date, out


def fetch_sfc_latest_short_interest() -> Tuple[Optional[str], pd.DataFrame]:
    headers = {"User-Agent": "Mozilla/5.0 (StockWise-HK-ShortSync)"}
    resp = _http_get(SFC_LATEST_CSV_URL, timeout=25, headers=headers)
    resp.raise_for_status()
    raw = resp.content.decode("utf-8-sig", errors="ignore")
    df = pd.read_csv(io.StringIO(raw), sep=None, engine="python", on_bad_lines="skip", dtype=str)
    if df.empty:
        return None, pd.DataFrame()

    col_map = {str(c).strip().lower(): c for c in df.columns}

    def _pick(*keys: str) -> Optional[str]:
        for k in keys:
            for ck, orig in col_map.items():
                if k in ck:
                    return orig
        return None

    symbol_col = _pick("stock code", "code")
    shares_col = _pick("number of shares", "shares")
    mv_col = _pick("market value")
    week_col = _pick("week ending", "week", "date")
    if not symbol_col:
        symbol_col = df.columns[0]

    out = pd.DataFrame()
    out["symbol"] = df[symbol_col].apply(_normalize_hk_symbol)
    out["short_interest_shares"] = df[shares_col].apply(_to_float) if shares_col else None
    out["short_interest_market_value"] = df[mv_col].apply(_to_float) if mv_col else None
    out["report_week"] = df[week_col].astype(str).str.strip() if week_col else None
    if "report_week" in out.columns:
        out["report_week"] = pd.to_datetime(out["report_week"], errors="coerce", dayfirst=True).dt.strftime("%Y-%m-%d")

    out = out.dropna(subset=["symbol"]).drop_duplicates(subset=["symbol", "report_week"])
    non_null_weeks = out["report_week"].dropna().unique().tolist() if "report_week" in out.columns else []
    report_week = sorted(non_null_weeks)[-1] if non_null_weeks else None
    logger.info(f"SFC short interest parsed rows={len(out)}")
    return report_week, out


def _fetch_hk_total_turnover_volume(symbols: List[str], trade_date: str) -> pd.DataFrame:
    if not symbols:
        return pd.DataFrame(columns=["symbol", "total_volume", "total_turnover"])
    conn = get_connection()
    try:
        placeholders = ",".join(["?"] * len(symbols))
        sql = f"""
            SELECT symbol, volume as total_volume, close * volume as total_turnover
            FROM daily_prices
            WHERE date = ? AND symbol IN ({placeholders})
        """
        return pd.read_sql_query(sql, conn, params=[trade_date, *symbols])
    finally:
        conn.close()


def sync_hk_short_poc(limit_symbols: Optional[int] = 50) -> Dict[str, object]:
    stats: Dict[str, object] = {"ok": True, "errors": []}
    try:
        trade_date, daily_df = fetch_hkex_daily_short_selling()
        snapshot_date, eligible_df = fetch_hkex_eligible_list()
        report_week, interest_df = fetch_sfc_latest_short_interest()

        scope_query_failed = False
        conn = get_connection()
        try:
            if limit_symbols is None:
                sql = """
                    SELECT symbol
                    FROM global_stock_pool
                    WHERE length(symbol) = 5
                    ORDER BY watchers_count DESC, symbol ASC
                """
                watched = pd.read_sql_query(sql, conn)
            else:
                sql = """
                    SELECT symbol
                    FROM global_stock_pool
                    WHERE length(symbol) = 5
                    ORDER BY watchers_count DESC, symbol ASC
                    LIMIT ?
                """
                watched = pd.read_sql_query(sql, conn, params=(limit_symbols,))
            hk_scope = watched["symbol"].astype(str).tolist() if not watched.empty else []
        except Exception as e:
            logger.error(f"Failed to load HK scope from global_stock_pool: {e}")
            scope_query_failed = True
            hk_scope = []
        finally:
            conn.close()

        if scope_query_failed:
            raise RuntimeError("Failed to load HK scope; aborting hk_short sync to prevent uncontrolled write scope")

        if not hk_scope:
            logger.warning("HK short sync scope is empty; skipping writes for safety.")
            daily_df = daily_df.iloc[0:0].copy()
            eligible_df = eligible_df.iloc[0:0].copy()
            interest_df = interest_df.iloc[0:0].copy()
        else:
            scope_set = set(hk_scope)
            if not daily_df.empty:
                daily_df = daily_df[daily_df["symbol"].isin(scope_set)].copy()
            if not eligible_df.empty:
                eligible_df = eligible_df[eligible_df["symbol"].isin(scope_set)].copy()
            if not interest_df.empty:
                interest_df = interest_df[interest_df["symbol"].isin(scope_set)].copy()

        if trade_date and not daily_df.empty:
            totals = _fetch_hk_total_turnover_volume(daily_df["symbol"].tolist(), trade_date)
            if not totals.empty:
                daily_df = daily_df.merge(totals, on="symbol", how="left")
            else:
                daily_df["total_volume"] = None
                daily_df["total_turnover"] = None
        else:
            daily_df["total_volume"] = None
            daily_df["total_turnover"] = None

        if not daily_df.empty:
            daily_df["short_volume_ratio"] = daily_df.apply(
                lambda r: (r["short_volume"] / r["total_volume"]) if r.get("total_volume") not in (None, 0) else None, axis=1
            )
            daily_df["short_turnover_ratio"] = daily_df.apply(
                lambda r: (r["short_turnover"] / r["total_turnover"]) if r.get("total_turnover") not in (None, 0) else None, axis=1
            )
            daily_df["quality_flag"] = daily_df.apply(
                lambda r: "OK" if (r["short_volume"] >= 0 and r["short_turnover"] >= 0) else "BAD_VALUE", axis=1
            )

        if not interest_df.empty:
            interest_df["quality_flag"] = interest_df.apply(
                lambda r: "OK" if (r.get("short_interest_shares") is None or r["short_interest_shares"] >= 0) else "BAD_VALUE", axis=1
            )

        conn = get_connection()
        cur = conn.cursor()
        try:
            if trade_date and not daily_df.empty:
                rows = []
                for _, r in daily_df.iterrows():
                    rows.append((
                        r["symbol"], trade_date, r["market"],
                        float(r["short_volume"]) if pd.notna(r["short_volume"]) else None,
                        float(r["short_turnover"]) if pd.notna(r["short_turnover"]) else None,
                        float(r["total_volume"]) if pd.notna(r["total_volume"]) else None,
                        float(r["total_turnover"]) if pd.notna(r["total_turnover"]) else None,
                        float(r["short_volume_ratio"]) if pd.notna(r["short_volume_ratio"]) else None,
                        float(r["short_turnover_ratio"]) if pd.notna(r["short_turnover_ratio"]) else None,
                        "HKEX_NCMS",
                        r.get("quality_flag", "OK"),
                    ))
                cur.executemany(
                    """
                    INSERT OR REPLACE INTO hk_short_selling_daily
                    (symbol, trade_date, market, short_volume, short_turnover, total_volume, total_turnover,
                     short_volume_ratio, short_turnover_ratio, source, quality_flag)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    rows,
                )

            if snapshot_date and not eligible_df.empty:
                cur.executemany(
                    """
                    INSERT OR REPLACE INTO hk_short_eligible_list
                    (snapshot_date, symbol, is_eligible, source)
                    VALUES (?, ?, ?, ?)
                    """,
                    [(snapshot_date, sym, 1, "HKEX_ELIGIBLE") for sym in eligible_df["symbol"].tolist()],
                )

            if report_week and not interest_df.empty:
                rows = []
                for _, r in interest_df.iterrows():
                    rows.append((
                        r["symbol"], r["report_week"],
                        float(r["short_interest_shares"]) if pd.notna(r["short_interest_shares"]) else None,
                        float(r["short_interest_market_value"]) if pd.notna(r["short_interest_market_value"]) else None,
                        "SFC_LATEST_CSV",
                        r.get("quality_flag", "OK"),
                    ))
                cur.executemany(
                    """
                    INSERT OR REPLACE INTO hk_short_interest_weekly
                    (symbol, report_week, short_interest_shares, short_interest_market_value, source, quality_flag)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    rows,
                )
            conn.commit()
        finally:
            conn.close()

        stats.update({
            "trade_date": trade_date,
            "snapshot_date": snapshot_date,
            "report_week": report_week,
            "daily_rows": int(len(daily_df)),
            "eligible_rows": int(len(eligible_df)),
            "weekly_rows": int(len(interest_df)),
            "scope_symbols": int(len(hk_scope)) if hk_scope else None,
            "daily_ok_ratio": float((daily_df["quality_flag"] == "OK").mean()) if not daily_df.empty else None,
            "weekly_ok_ratio": float((interest_df["quality_flag"] == "OK").mean()) if not interest_df.empty else None,
            "daily_status": "NOT_READY_OR_EMPTY" if daily_df.empty else "OK",
        })
        logger.info(f"HK short sync done: {stats}")
        return stats
    except Exception as e:
        logger.error(f"HK short sync failed: {e}")
        stats["ok"] = False
        stats["errors"].append(str(e))
        return stats


def sync_hk_short_data(limit_symbols: Optional[int] = None) -> Dict[str, object]:
    """
    Production entrypoint for HK short-selling sync.
    Defaults to full HK scope in global_stock_pool (no hard cap).
    """
    return sync_hk_short_poc(limit_symbols=limit_symbols)
