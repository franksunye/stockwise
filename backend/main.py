"""
StockWise ETL Pipeline - CLI 入口
工业级重构版
"""

import sys
import os
import argparse
import io

# 修复 Windows 控制台编码问题
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    except (AttributeError, io.UnsupportedOperation):
        pass

# 环境路径注入
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import init_db, get_stock_pool
from fetchers import sync_stock_meta, sync_profiles
from sync.prices import process_stock_period, run_full_sync
from sync.realtime import sync_spot_prices
from backend.analysis.runner import run_ai_analysis
from backend.analysis.backfill import run_ai_analysis_backfill
from backend.logger import logger
from backend.engine import register_all_models
from backend.job_guard import JobGuard
from utils import get_market


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='StockWise ETL Pipeline')
    parser.add_argument('--realtime', action='store_true', help='执行盘中实时同步')
    parser.add_argument('--sync', action='store_true', help='执行行情同步 (配合 --symbol 使用)')
    parser.add_argument('--sync-meta', action='store_true', help='仅同步股票元数据')
    parser.add_argument('--analyze', action='store_true', help='执行 AI 预测分析 (独立任务)')
    parser.add_argument('--verify', action='store_true', help='执行预测结果验证 (独立任务)')
    parser.add_argument('--mode-pipeline', action='store_true', help='执行 Investment Mode 后台数据管线')
    parser.add_argument('--sync-hk-short', action='store_true', help='执行港股做空数据同步 (生产任务)')
    parser.add_argument('--sync-hk-short-poc', action='store_true', help='执行港股做空数据 POC 同步')
    parser.add_argument('--symbol', type=str, help='指定股票代码')
    parser.add_argument(
        '--sync-mode',
        type=str,
        default='core',
        choices=['core', 'periods', 'full'],
        help='单票按需同步模式: core=daily+realtime, periods=weekly+monthly, full=daily+weekly+monthly+realtime'
    )
    parser.add_argument('--market', type=str, choices=['CN', 'HK', 'US'], help='只同步/分析/验证特定市场')
    parser.add_argument(
        '--model',
        type=str,
        default='rule-engine',
        choices=['all', 'deepseek-aliyun', 'deepseek-v3', 'deepseek-v3.2-exp', 'gemini-3-flash', 'hunyuan-lite', 'rule-engine'],
        help='指定 AI 模型'
    )

    parser.add_argument('--date', type=str, help='指定分析日期 (YYYY-MM-DD)')
    _default_prediction_locale = os.getenv("PREDICTION_CONTENT_LOCALE", "auto").strip().lower()
    if _default_prediction_locale not in ("auto", "en", "cn"):
        _default_prediction_locale = "auto"
    parser.add_argument(
        '--locale',
        type=str,
        default=_default_prediction_locale,
        choices=['auto', 'cn', 'en'],
        help='分析语言：auto=按关注用户语言集合产出；cn/en=强制单语言',
    )
    parser.add_argument('--start-date', type=str, help='日期范围起始 (YYYY-MM-DD)')
    parser.add_argument('--end-date', type=str, help='日期范围结束 (YYYY-MM-DD)')
    parser.add_argument('--days', type=int, help='回填最近N天')
    parser.add_argument('--auto-fill', action='store_true', help='智能检测并补全缺失分析')
    parser.add_argument('--force', action='store_true', help='强制重新分析')
    parser.add_argument('--full-periods', action='store_true', help='强制同步周线和月线')
    parser.add_argument('--skip-mode-pipeline', action='store_true', help='跳过 analyze 后的 mode 数据管线')
    parser.add_argument('--shard-index', type=int, default=0, help='AI 分析分片索引（0-based）')
    parser.add_argument('--shard-total', type=int, default=1, help='AI 分析分片总数')
    parser.add_argument('--max-symbol-concurrency', type=int, default=1, help='AI 分析单 shard 内股票并发数')

    args = parser.parse_args()
    init_db()
    register_all_models()
    is_backfill_mode = args.date or args.start_date or args.end_date or args.days or args.auto_fill

    # 1. Prediction Verification
    if args.verify:
        with JobGuard("Prediction Verification", task_type="maintenance", rerun_workflow="verify_predictions.yml") as job:
            from backend.engine.validator import verify_all_pending
            if args.market:
                job.set_dimensions(market=args.market)
            stats = verify_all_pending(force=args.force, target_date=args.date, market_filter=args.market)
            if stats:
                job.set_stats(**stats)
        sys.exit(0)

    # 1a. Investment Mode Pipeline
    elif args.mode_pipeline:
        with JobGuard("Investment Mode Pipeline", task_type="maintenance", triggered_by="scheduler") as job:
            from backend.analysis.mode_pipeline import run_mode_pipeline
            stats = run_mode_pipeline(
                as_of_date=args.date,
                job_id=job.get_pipeline_run_id(),
                rule_version="mode_sim_v1",
                triggered_by=f"{job.agent_id}:mode-pipeline",
            )
            if stats:
                job.set_stats(**stats)
        sys.exit(0)

    # 1b. HK Short Selling Sync (Production)
    elif args.sync_hk_short:
        with JobGuard("HK Short Selling Sync", task_type="ingestion", rerun_workflow="data_sync_hk.yml") as job:
            from backend.sync.hk_short import sync_hk_short_data
            stats = sync_hk_short_data(limit_symbols=None)
            if stats:
                job.set_stats(**stats)
            if not stats or not stats.get("ok", False):
                raise RuntimeError(f"HK short sync failed: {stats}")
        sys.exit(0)

    # 1c. HK Short Selling POC Sync (Backward-compatible)
    elif args.sync_hk_short_poc:
        with JobGuard("HK Short Selling POC Sync", task_type="ingestion", triggered_by="user", channel_alert=False) as job:
            from backend.sync.hk_short import sync_hk_short_poc
            stats = sync_hk_short_poc(limit_symbols=50)
            if stats:
                job.set_stats(**stats)
            if not stats or not stats.get("ok", False):
                raise RuntimeError(f"HK short POC sync failed: {stats}")
        sys.exit(0)

    # 2. Realtime Sync
    elif args.realtime:
        market_code = args.market if args.market else "ALL"
        with JobGuard(f"Realtime Sync ({market_code})", task_type="ingestion", rerun_workflow="data_sync_realtime.yml") as job:
            job.set_dimensions(market=market_code)
            all_stocks = get_stock_pool()
            if args.symbol:
                target_stocks = [args.symbol]
            elif args.market:
                target_stocks = [s for s in all_stocks if get_market(s) == args.market]
            else:
                target_stocks = all_stocks

            stats = sync_spot_prices(target_stocks)
            if stats:
                job.set_stats(**stats)
        sys.exit(0)

    # 3. Meta Sync
    elif args.sync_meta:
        with JobGuard("Metadata Sync", task_type="ingestion", rerun_workflow="meta_sync.yml") as job:
            meta_stats = sync_stock_meta()
            if meta_stats:
                job.set_stats(**meta_stats)
            sync_profiles(limit=20)
            job.set_stats(profile_sync_limit=20)
        sys.exit(0)

    # 4. AI Backfill
    elif args.analyze and is_backfill_mode:
        with JobGuard("AI Analysis (Backfill)", task_type="prediction", triggered_by="user") as job:
            stats = run_ai_analysis_backfill(
                symbol=args.symbol,
                market_filter=args.market,
                date=args.date,
                start_date=args.start_date,
                end_date=args.end_date,
                days=args.days,
                auto_fill=args.auto_fill,
                model_filter=args.model,
                force=args.force,
                locale=args.locale,
                shard_index=args.shard_index,
                shard_total=args.shard_total,
            )
            if stats:
                job.set_stats(**stats)
        sys.exit(0)

    # 5. Daily AI Analysis
    elif args.analyze:
        market_dim = args.market if args.market else "ALL"
        rerun_workflow = "ai_analyze_cn.yml"
        if args.market == "HK":
            rerun_workflow = "ai_analyze_hk.yml"
        elif args.market == "US":
            rerun_workflow = "ai_analyze_us.yml"
        with JobGuard(f"AI Analysis ({market_dim})", task_type="prediction", rerun_workflow=rerun_workflow) as job:
            job.set_dimensions(
                market=market_dim,
                model=args.model,
                locale=args.locale,
                shard_index=args.shard_index,
                shard_total=args.shard_total,
                max_symbol_concurrency=args.max_symbol_concurrency,
            )
            stats = run_ai_analysis(
                symbol=args.symbol,
                market_filter=args.market,
                force=args.force,
                model_filter=args.model,
                locale=args.locale,
                shard_index=args.shard_index,
                shard_total=args.shard_total,
                max_symbol_concurrency=args.max_symbol_concurrency,
            )
            if stats:
                job.set_stats(**stats)
            if not args.skip_mode_pipeline:
                from backend.analysis.mode_pipeline import run_mode_pipeline
                mode_stats = run_mode_pipeline(
                    as_of_date=args.date,
                    job_id=job.get_pipeline_run_id(),
                    rule_version="mode_sim_v1",
                    triggered_by=f"{job.agent_id}:analyze",
                )
                if mode_stats:
                    job.set_stats(mode_decisions=mode_stats.get("decision_rows", 0),
                                  mode_ledger=mode_stats.get("ledger_rows", 0),
                                  mode_snapshots=mode_stats.get("snapshot_rows", 0))
        sys.exit(0)

    # 6. Manual Symbol Sync
    elif args.symbol:
        with JobGuard(f"Manual Sync ({args.symbol})", task_type="ingestion", triggered_by="user", channel_alert=False) as job:
            sync_mode = args.sync_mode or "core"
            job.set_dimensions(symbol=args.symbol, sync_mode=sync_mode)

            daily_ok = True
            weekly_ok = True
            monthly_ok = True
            realtime_ok = True

            if sync_mode in ("core", "full"):
                daily_ok = process_stock_period(args.symbol, period="daily")

            if sync_mode in ("periods", "full"):
                weekly_ok = process_stock_period(args.symbol, period="weekly")
                monthly_ok = process_stock_period(args.symbol, period="monthly")

            job.set_stats(
                sync_mode=sync_mode,
                daily_ok=bool(daily_ok),
                weekly_ok=bool(weekly_ok),
                monthly_ok=bool(monthly_ok),
            )

            if sync_mode in ("core", "full") and not daily_ok:
                raise RuntimeError(f"Manual sync failed: daily period could not be updated for {args.symbol}")

            degraded_periods = [
                period for period, ok in [("weekly", weekly_ok), ("monthly", monthly_ok)] if not ok
            ]
            if sync_mode in ("periods", "full") and degraded_periods:
                logger.warning(
                    f"⚠️ [On-Demand] {args.symbol} completed with degraded periods: {', '.join(degraded_periods)}"
                )

            if sync_mode in ("core", "full"):
                logger.info(f"⚡ [On-Demand] Fetching realtime snapshot for {args.symbol}...")
                stats = sync_spot_prices(
                    [args.symbol],
                    ignore_session_filter=True,
                    ignore_trading_day_gate=True,
                )
                realtime_ok = bool(stats)
                if stats:
                    job.set_stats(**stats)
                else:
                    job.set_stats(realtime_ok=False)

            if sync_mode == "periods" and not (weekly_ok or monthly_ok):
                raise RuntimeError(f"Manual sync failed: no period data could be updated for {args.symbol}")

            if sync_mode in ("core", "full") and not realtime_ok:
                logger.warning(f"⚠️ [On-Demand] {args.symbol} daily sync succeeded but realtime snapshot was unavailable.")
        sys.exit(0)

    # 7. Default Full Market Sync
    else:
        market_dim = args.market if args.market else "ALL"
        rerun_workflow = "data_sync_cn.yml"
        if args.market == "HK":
            rerun_workflow = "data_sync_hk.yml"
        elif args.market == "US":
            rerun_workflow = "data_sync_us.yml"
        with JobGuard(f"Full Market Sync ({market_dim})", task_type="ingestion", rerun_workflow=rerun_workflow) as job:
            job.set_dimensions(market=market_dim)
            stats = run_full_sync(market_filter=args.market, force_full=args.full_periods)
            if stats:
                job.set_stats(**stats)
        if not stats or not stats.get("success"):
            sys.exit(1)
        sys.exit(0)
