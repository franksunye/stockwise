"""
AI 分析主入口模块
"""
import time
import os
import asyncio
from datetime import datetime

import pandas as pd

from config import BEIJING_TZ
from database import get_connection, get_stock_pool
from utils import send_wecom_notification
from helpers import check_trading_day_skip
from logger import logger


from trading_calendar import get_market_from_symbol, is_market_closed
from utils import get_market
from backend.analysis.sharding import normalize_shard_args, select_shard


def _normalize_locale(value: str) -> str:
    loc = (value or "auto").strip().lower()
    return loc if loc in ("auto", "cn", "en") else "auto"


def _build_target_locale_map(conn, targets: list[str], forced_locale: str) -> dict[str, list[str]]:
    """
    Derive required locales for each symbol from active watchlist users.
    - forced_locale in {"cn","en"}: use that locale for all targets.
    - forced_locale == "auto": use watchers' locale set per symbol.
    """
    mode = _normalize_locale(forced_locale)
    if mode in ("cn", "en"):
        return {s: [mode] for s in targets}

    if not targets:
        return {}

    cursor = conn.cursor()
    placeholders = ",".join(["?"] * len(targets))
    query = f"""
        SELECT uw.symbol,
               CASE WHEN lower(COALESCE(u.locale, 'cn')) = 'en' THEN 'en' ELSE 'cn' END AS content_locale
        FROM user_watchlist uw
        JOIN users u ON u.user_id = uw.user_id
        WHERE uw.symbol IN ({placeholders})
        GROUP BY uw.symbol, content_locale
    """
    cursor.execute(query, list(targets))
    rows = cursor.fetchall()

    out: dict[str, list[str]] = {s: [] for s in targets}
    for sym, loc in rows:
        loc_norm = "en" if str(loc).lower() == "en" else "cn"
        if loc_norm not in out[sym]:
            out[sym].append(loc_norm)

    # Keep production behavior stable for uncovered symbols.
    for s in targets:
        if not out[s]:
            out[s] = ["cn"]
    return out


def _symbol_effective_tiers(conn, symbol: str) -> list[str]:
    """
    Resolve effective tiers from watchers for a symbol.
    Expired paid subscriptions degrade to free.
    """
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT DISTINCT
            CASE
                WHEN lower(COALESCE(u.subscription_tier, 'free')) IN ('go', 'plus', 'pro', 'alpha')
                     AND u.subscription_expires_at IS NOT NULL
                     AND u.subscription_expires_at <= datetime('now')
                    THEN 'free'
                WHEN lower(COALESCE(u.subscription_tier, 'free')) IN ('free', 'go', 'plus', 'pro', 'alpha')
                    THEN lower(COALESCE(u.subscription_tier, 'free'))
                ELSE 'free'
            END AS effective_tier
        FROM user_watchlist w
        JOIN users u ON u.user_id = w.user_id
        WHERE w.symbol = ?
        LIMIT 50
        """,
        (symbol,),
    )
    tiers = []
    for row in cursor.fetchall():
        tier = str(row[0] if isinstance(row, (tuple, list)) else row["effective_tier"]).strip().lower()
        if tier and tier not in tiers:
            tiers.append(tier)
    return tiers or ["free"]


async def _run_stock_locale_analysis(
    *,
    stock: str,
    target_locale: str,
    market_filter: str = None,
    force: bool = False,
    model_filter: str = None,
    now_date: datetime,
    notif_manager=None,
    stock_subscribers: dict | None = None,
    batch_symbol: str | None = None,
) -> dict:
    try:
        if not batch_symbol and not force:
            market = get_market_from_symbol(stock)
            if is_market_closed(now_date, market):
                logger.debug(f"💤 {stock}: {market} 市场休市，跳过")
                return {"status": "skipped_closed", "stock": stock, "locale": target_locale}

        conn = get_connection()
        try:
            cursor = conn.cursor()
            query = "SELECT * FROM daily_prices WHERE symbol = ? ORDER BY date DESC LIMIT 1"
            df = pd.read_sql_query(query, conn, params=(stock,))

            if df.empty:
                logger.warning(f"⚠️ {stock}: 无行情数据，跳过")
                return {"status": "no_data", "stock": stock, "locale": target_locale}

            today_data = df.iloc[0]
            today_str = today_data['date']

            if not force and model_filter and model_filter != 'all':
                cursor.execute(
                    """
                    SELECT 1
                    FROM ai_predictions_v2
                    WHERE symbol = ? AND date = ? AND model_id = ? AND COALESCE(content_locale, 'cn') = ?
                    LIMIT 1
                    """,
                    (stock, today_str, model_filter, target_locale)
                )
                if cursor.fetchone():
                    logger.info(f"⏩ {stock}: {today_str} ({model_filter}/{target_locale}) 预测已存在，跳过")
                    return {
                        "status": "skipped_existing",
                        "stock": stock,
                        "locale": target_locale,
                        "success": 1,
                        "ai": 0,
                        "rule": 0,
                    }

            effective_tiers = _symbol_effective_tiers(conn, stock)
        finally:
            conn.close()

        logger.info(f">>> 分析 {stock} ({today_str}, locale={target_locale})")

        from backend.engine.runner import PredictionRunner

        runner = PredictionRunner(
            model_filter=model_filter,
            force=force,
            effective_tiers=effective_tiers,
        )
        analysis_result = await runner.run_analysis(stock, today_str, locale=target_locale)

        if not analysis_result:
            logger.warning(f"⚠️ {stock}: Analysis failed or returned no results (locale={target_locale}).")
            return {"status": "failed", "stock": stock, "locale": target_locale}

        primary_result = analysis_result.get('primary')
        all_models = analysis_result.get('models', [])

        if notif_manager and isinstance(primary_result, dict) and target_locale == "cn":
            subscribers = (stock_subscribers or {}).get(stock, set())
            for uid in subscribers:
                notif_manager.check_signal_flip(
                    uid, stock,
                    primary_result.get('signal'),
                    primary_result.get('confidence')
                )
                notif_manager.queue_notification(
                    uid,
                    "prediction_updated",
                    {"symbol": stock, "market": market_filter or get_market(stock)}
                )

        return {
            "status": "success",
            "stock": stock,
            "locale": target_locale,
            "success": 1,
            "ai": 1 if any(m != 'rule-engine' for m in all_models) else 0,
            "rule": 1 if 'rule-engine' in all_models else 0,
        }
    except Exception as e:
        logger.error(f"❌ {stock} AI Engine Failed (locale={target_locale}): {e}")
        return {"status": "exception", "stock": stock, "locale": target_locale}


async def _run_analysis_jobs(jobs: list[tuple[str, str]], max_symbol_concurrency: int, **kwargs) -> list[dict]:
    semaphore = asyncio.Semaphore(max(1, int(max_symbol_concurrency or 1)))

    async def _guarded(stock: str, target_locale: str) -> dict:
        async with semaphore:
            return await _run_stock_locale_analysis(stock=stock, target_locale=target_locale, **kwargs)

    return await asyncio.gather(*[_guarded(stock, target_locale) for stock, target_locale in jobs])


def run_ai_analysis(
    symbol: str = None,
    market_filter: str = None,
    force: bool = False,
    model_filter: str = None,
    locale: str = 'auto',
    shard_index: int = 0,
    shard_total: int = 1,
    max_symbol_concurrency: int = 1,
):
    """独立运行 AI 预测任务
    
    Args:
        model_filter: 指定使用的模型 ID (deepseek-v3, gemini-3-flash, rule-engine)
    """
    # Logic to skip execution on market holidays
    # This prevents wasted API calls and compute resources when markets are closed (e.g. Lunar New Year)
    if not symbol and not force and check_trading_day_skip(market_filter):
        return
        
    targets = []
    if symbol:
        targets = [symbol]
    else:
        pool = get_stock_pool()
        if not pool:
            logger.warning("⚠️ 股票池为空")
            return
        
        # 按市场过滤
        if market_filter:
            targets = [s for s in pool if get_market(s) == market_filter]
        else:
            targets = pool
    
    shard_index, shard_total = normalize_shard_args(shard_index, shard_total)
    max_symbol_concurrency = max(1, int(max_symbol_concurrency or 1))
    total_before_shard = len(targets)
    targets = select_shard(targets, shard_index=shard_index, shard_total=shard_total)
    if not targets:
        logger.warning(f"⚠️ 分片 {shard_index}/{shard_total} 无目标股票")
        return {
            "total": 0,
            "success": 0,
            "ai_models": 0,
            "rule_engine": 0,
            "failed": 0,
            "duration": 0,
            "shard_index": shard_index,
            "shard_total": shard_total,
            "shard_targets": 0,
            "total_before_shard": total_before_shard,
            "locale_jobs": 0,
            "total_jobs": 0,
            "max_symbol_concurrency": max_symbol_concurrency,
        }

    logger.info(
        f"🧠 开始执行 AI 分析任务，共 {len(targets)} 只股票 "
        f"(shard {shard_index}/{shard_total}, total_before_shard={total_before_shard}, "
        f"max_symbol_concurrency={max_symbol_concurrency})..."
    )
    start_time = time.time()
    
    # [NEW] Initialize Smart Notification Manager if enabled
    from backend.config import ENABLE_SMART_NOTIFICATIONS
    from backend.notification_service import NotificationManager
    
    effective_locale = _normalize_locale(locale)
    notif_manager = None
    stock_subscribers = {} # symbol -> set[uid]
    
    if ENABLE_SMART_NOTIFICATIONS:
        notif_manager = NotificationManager()
        
        # Pre-load signal states and subscribers for optimization
        # We need to know which users are watching the target stocks
        # [Precision Fix] Ensure targets exists before query to avoid invalid SQL 'IN ()'
        if targets:
            try:
                conn = get_connection()
                cursor = conn.cursor()
                
                # Optimization: If targets list is too long (e.g. full market), don't use IN clause
                # Just fetch all relevant watchlists.
                if len(targets) > 500:
                    query = """
                        SELECT w.symbol, w.user_id
                        FROM user_watchlist w
                        WHERE EXISTS (SELECT 1 FROM push_subscriptions s WHERE s.user_id = w.user_id)
                    """
                    cursor.execute(query)
                else:
                    placeholders = ','.join(['?'] * len(targets))
                    query = f"""
                        SELECT w.symbol, w.user_id
                        FROM user_watchlist w
                        WHERE w.symbol IN ({placeholders})
                        AND EXISTS (SELECT 1 FROM push_subscriptions s WHERE s.user_id = w.user_id)
                    """
                    cursor.execute(query, list(targets))
                    
                rows = cursor.fetchall()
                involved_users = set()
                
                for sym, uid in rows:
                    if sym not in stock_subscribers:
                        stock_subscribers[sym] = set()
                    stock_subscribers[sym].add(uid)
                    involved_users.add(uid)
                
                # Pre-load previous signal states for these users/stocks
                if involved_users:
                     notif_manager.load_signal_states(list(involved_users), targets)
                
                conn.close()
                logger.info(f"🔔 [SmartNotif] Loaded subscribers for {len(stock_subscribers)} stocks.")
                
            except Exception as e:
                logger.warning(f"⚠️ [SmartNotif] Failed to load subscribers: {e}")
                stock_subscribers = {} # Fallback: No notifications will send
    
    conn = get_connection()
    try:
        target_locale_map = _build_target_locale_map(conn, targets, effective_locale)
    finally:
        conn.close()
    
    # 获取当前北京时间用于判断休市
    now_date = datetime.now(BEIJING_TZ)
    jobs = [
        (stock, target_locale)
        for stock in targets
        for target_locale in target_locale_map.get(stock, ["cn"])
    ]

    if os.name == 'nt':
        try:
            asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
        except Exception:
            pass

    results = asyncio.run(
        _run_analysis_jobs(
            jobs,
            max_symbol_concurrency=max_symbol_concurrency,
            market_filter=market_filter,
            force=force,
            model_filter=model_filter,
            now_date=now_date,
            notif_manager=notif_manager,
            stock_subscribers=stock_subscribers,
            batch_symbol=symbol,
        )
    ) if jobs else []

    success_count = sum(int(r.get("success", 0)) for r in results)
    ai_count = sum(int(r.get("ai", 0)) for r in results)
    rule_count = sum(int(r.get("rule", 0)) for r in results)
    failed_count = sum(1 for r in results if r.get("status") in {"failed", "exception", "no_data"})
    skipped_existing_count = sum(1 for r in results if r.get("status") == "skipped_existing")
    skipped_closed_count = sum(1 for r in results if r.get("status") == "skipped_closed")

    # [NEW] Finalize Smart Notifications (Flush updates and send aggregated)
    if notif_manager:
        notif_manager.flush()
        logger.info("📢 [Runner] Smart notification flush completed")
            
    duration = round(time.time() - start_time, 1)
    
    # [Refactored] Gather stats for JobGuard
    stats = {
        "total": len(targets),
        "success": success_count,
        "ai_models": ai_count,
        "rule_engine": rule_count,
        "failed": failed_count,
        "duration": duration,
        "shard_index": shard_index,
        "shard_total": shard_total,
        "shard_targets": len(targets),
        "total_before_shard": total_before_shard,
        "locale_jobs": len(jobs),
        "total_jobs": len(jobs),
        "skipped_existing": skipped_existing_count,
        "skipped_closed": skipped_closed_count,
        "max_symbol_concurrency": max_symbol_concurrency,
    }

    # Add Data Health Diagnostics to stats
    try:
        from backend.context.provider import MarketContextProvider
        diag = MarketContextProvider().get_diagnostics()
        
        health_warnings = []
        if diag.get('macro_attempts', 0) > 0 and diag.get('macro_success', 0) == 0:
            health_warnings.append("Macro Data Unavailable")
        
        flow_attempts = diag.get('stock_flow_attempts', 0)
        flow_success = diag.get('stock_flow_success', 0)
        if flow_attempts > 0:
            fail_rate = (flow_attempts - flow_success) / flow_attempts
            if fail_rate > 0.5:
                health_warnings.append(f"High Flow Data Failure ({fail_rate:.0%})")
        
        if health_warnings:
            stats["data_health"] = ", ".join(health_warnings)
            
    except Exception as stat_e:
        logger.warning(f"Failed to gather diagnostics: {stat_e}")

    return stats
