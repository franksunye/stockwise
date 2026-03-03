"""
StockWise ETL Pipeline - CLI 入口
工业级重构版
"""

import sys
import os
import argparse
import time
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
from utils import send_wecom_notification
from sync.prices import process_stock_period, run_full_sync
from sync.realtime import sync_spot_prices
from backend.analysis.runner import run_ai_analysis
from backend.analysis.backfill import run_ai_analysis_backfill
from backend.logger import logger
from backend.engine import register_all_models
from backend.job_guard import JobGuard


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='StockWise ETL Pipeline')
    parser.add_argument('--realtime', action='store_true', help='执行盘中实时同步')
    parser.add_argument('--sync', action='store_true', help='执行行情同步 (配合 --symbol 使用)')
    parser.add_argument('--sync-meta', action='store_true', help='仅同步股票元数据')
    parser.add_argument('--analyze', action='store_true', help='执行 AI 预测分析 (独立任务)')
    parser.add_argument('--verify', action='store_true', help='执行预测结果验证 (独立任务)')
    parser.add_argument('--symbol', type=str, help='指定股票代码')
    parser.add_argument('--market', type=str, choices=['CN', 'HK'], help='只同步/分析特定市场')
    parser.add_argument('--model', type=str, default='rule-engine', 
                        choices=['all', 'deepseek-v3', 'deepseek-v3.2-exp', 'gemini-3-flash', 'hunyuan-lite', 'rule-engine'],
                        help='指定 AI 模型')
    
    parser.add_argument('--date', type=str, help='指定分析日期 (YYYY-MM-DD)')
    parser.add_argument('--start-date', type=str, help='日期范围起始 (YYYY-MM-DD)')
    parser.add_argument('--end-date', type=str, help='日期范围结束 (YYYY-MM-DD)')
    parser.add_argument('--days', type=int, help='回填最近N天')
    parser.add_argument('--auto-fill', action='store_true', help='智能检测并补充缺失分析')
    parser.add_argument('--force', action='store_true', help='强制重新分析')
    parser.add_argument('--full-periods', action='store_true', help='强制同步周线和月线')
    
    args = parser.parse_args()
    init_db()
    register_all_models()

    from backend.engine.task_logger import get_task_logger
    
    # 确定触发者: 通过环境变量或 CLI 参数 (默认 scheduler)
    trigger = os.environ.get("TASK_TRIGGER", "scheduler") 
    is_backfill_mode = args.date or args.start_date or args.end_date or args.days or args.auto_fill

    # 1. Prediction Verification
    if args.verify:
        with JobGuard("Prediction Verification", task_type="maintenance", rerun_workflow="verify_predictions.yml") as job:
            from backend.engine.validator import verify_all_pending
            stats = verify_all_pending(force=args.force, target_date=args.date)
            if stats: job.set_stats(**stats)
        sys.exit(0)
    
    # 2. Realtime Sync
    elif args.realtime:
        market_code = args.market if args.market else "ALL"
        with JobGuard(f"Realtime Sync ({market_code})", task_type="ingestion", rerun_workflow="realtime_sync.yml") as job:
            job.set_dimensions(market=market_code)
            all_stocks = get_stock_pool()
            if args.symbol:
                target_stocks = [args.symbol]
            elif args.market:
                target_stocks = [s for s in all_stocks if (args.market == 'HK' and len(s) == 5) or (args.market == 'CN' and len(s) != 5)]
            else:
                target_stocks = all_stocks
            
            stats = sync_spot_prices(target_stocks)
            if stats: job.set_stats(**stats)
        sys.exit(0)
            
    # 3. Meta Sync
    elif args.sync_meta:
        with JobGuard("Metadata Sync", task_type="ingestion", rerun_workflow="sync_meta.yml") as job:
            meta_stats = sync_stock_meta()
            if meta_stats: job.set_stats(**meta_stats)
            sync_profiles(limit=20)
            job.set_stats(profile_sync_limit=20)
        sys.exit(0)

    # 4. AI Backfill
    elif args.analyze and is_backfill_mode:
        with JobGuard("AI Analysis (Backfill)", task_type="prediction", triggered_by="user") as job:
            stats = run_ai_analysis_backfill(
                symbol=args.symbol, market_filter=args.market, date=args.date,
                start_date=args.start_date, end_date=args.end_date,
                days=args.days, auto_fill=args.auto_fill,
                model_filter=args.model, force=args.force
            )
            if stats: job.set_stats(**stats)
        sys.exit(0)
            
    # 5. Daily AI Analysis
    elif args.analyze:
        market_dim = args.market if args.market else "ALL"
        with JobGuard(f"AI Analysis ({market_dim})", task_type="prediction", rerun_workflow="daily_analysis.yml") as job:
            job.set_dimensions(market=market_dim, model=args.model)
            stats = run_ai_analysis(symbol=args.symbol, market_filter=args.market, force=args.force, model_filter=args.model)
            if stats: job.set_stats(**stats)
        sys.exit(0)

    # 6. Manual Symbol Sync
    elif args.symbol:
        with JobGuard(f"Manual Sync ({args.symbol})", task_type="ingestion", triggered_by="user", channel_alert=False) as job:
            process_stock_period(args.symbol, period="daily")
            process_stock_period(args.symbol, period="weekly")
            process_stock_period(args.symbol, period="monthly")
            logger.info(f"⚡ [On-Demand] Fetching realtime snapshot for {args.symbol}...")
            stats = sync_spot_prices([args.symbol])
            if stats: job.set_stats(**stats)
        sys.exit(0)
        
    # 7. Default Full Market Sync
    else:
        market_dim = args.market if args.market else "ALL"
        with JobGuard(f"Full Market Sync ({market_dim})", task_type="ingestion", rerun_workflow="daily_sync.yml") as job:
            job.set_dimensions(market=market_dim)
            stats = run_full_sync(market_filter=args.market, force_full=args.full_periods)
            if stats: job.set_stats(**stats)
        sys.exit(0)
