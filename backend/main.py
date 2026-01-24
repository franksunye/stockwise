"""
StockWise ETL Pipeline - CLI 入口
模块化重构版
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

# Add current directory (backend/) to sys.path to support legacy imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
# Add project root to sys.path to support 'backend.*' imports
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
                        choices=['all', 'deepseek-v3', 'gemini-3-flash', 'hunyuan-lite', 'rule-engine'],
                        help='指定 AI 模型 (默认: rule-engine)')
    
    # 回填功能参数
    parser.add_argument('--date', type=str, help='指定分析日期 (YYYY-MM-DD)')
    parser.add_argument('--start-date', type=str, help='日期范围起始 (YYYY-MM-DD)')
    parser.add_argument('--end-date', type=str, help='日期范围结束 (YYYY-MM-DD)')
    parser.add_argument('--days', type=int, help='回填最近N天')
    parser.add_argument('--auto-fill', action='store_true', help='智能检测并补充缺失分析')
    parser.add_argument('--force', action='store_true', help='强制重新分析 (即使今日已存在)')
    
    args = parser.parse_args()
    init_db()
    
    # Register Analysis Models (Lazy Load)
    register_all_models()

    from backend.engine.task_logger import get_task_logger
    
    # 确定触发者 (CLI usually manually run or scheduled)
    # For now assume 'user:admin' or 'scheduler' based on time?
    # Simple hardcode or arg? Let's use 'scheduler' as default for CLI, unless typical work hours.
    trigger = 'scheduler' 

    if args.verify:
        logger_sys = get_task_logger("system_guardian", "validation", triggered_by=trigger)
        logger_sys.start("Data Validation", "maintenance", dimensions={})
        try:
            from engine.validator import verify_all_pending
            verify_all_pending()
            logger_sys.success("Validation completed")
        except Exception as e:
            logger_sys.fail(str(e))
        sys.exit(0)
    
    # 判断是否为回填模式
    is_backfill_mode = args.date or args.start_date or args.end_date or args.days or args.auto_fill
    
    if args.realtime:
        # Realtime Sync: Market Observer
        # 盘中实时同步
        target_stocks = []
        if args.symbol:
            target_stocks = [args.symbol]
        else:
            all_stocks = get_stock_pool()
            if args.market:
                target_stocks = [s for s in all_stocks if (args.market == 'HK' and len(s) == 5) or (args.market == 'CN' and len(s) != 5)]
            else:
                target_stocks = all_stocks
        
        # Log Logic
        market_code = args.market if args.market else "ALL"
        t_logger = get_task_logger("market_observer", f"realtime_sync_{market_code.lower()}", triggered_by=trigger)
        t_logger.start(f"Realtime Sync ({market_code})", "ingestion", dimensions={"market": market_code})
        
        try:
            sync_spot_prices(target_stocks)
            t_logger.success(f"Synced {len(target_stocks)} stocks")
        except Exception as e:
            t_logger.fail(str(e))
            
    elif args.sync_meta:
        # Meta Sync: Market Observer
        t_logger = get_task_logger("market_observer", "meta_sync", triggered_by=trigger)
        t_logger.start("Metadata Refresh", "ingestion", dimensions={})
        try:
            sync_stock_meta()
            sync_profiles(limit=20)
            t_logger.success("Meta sync completed")
        except Exception as e:
            t_logger.fail(str(e))

    elif args.analyze and is_backfill_mode:
        # Backfill: Quant Mind
        t_logger = get_task_logger("quant_mind", "ai_backfill", triggered_by=trigger)
        t_logger.start("AI Analysis (Backfill)", "reasoning", dimensions={"mode": "backfill"})
        try:
            # 回填模式: 分析指定日期的历史数据
            run_ai_analysis_backfill(
                symbol=args.symbol,
                market_filter=args.market,
                date=args.date,
                start_date=getattr(args, 'start_date', None),
                end_date=getattr(args, 'end_date', None),
                days=args.days,
                auto_fill=args.auto_fill,
                model_filter=args.model,
                force=args.force
            )
            t_logger.success("Backfill completed")
        except Exception as e:
            t_logger.fail(str(e))
            
    elif args.analyze:
        # Daily Analysis: Quant Mind
        # 独立运行 AI 分析 (分析最新数据)
        market_dim = args.market if args.market else "ALL"
        t_logger = get_task_logger("quant_mind", "ai_analysis", triggered_by=trigger)
        t_logger.start("AI Analysis (Daily)", "reasoning", dimensions={"market": market_dim})
        
        try:
            run_ai_analysis(symbol=args.symbol, market_filter=args.market, force=args.force, model_filter=args.model)
            t_logger.success("Daily analysis completed")
        except Exception as e:
            t_logger.fail(str(e))

    elif args.symbol:
        # On-Demand: User Initiated usually
        # On-Demand Sync: 需要错误处理和通知
        logger_manual = get_task_logger("market_observer", "manual_sync", triggered_by="user")
        logger_manual.start(f"Manual Sync ({args.symbol})", "ingestion", dimensions={"symbol": args.symbol})
        
        start_time = time.time()
        success = True
        error_msg = None
        
        try:
            process_stock_period(args.symbol, period="daily")
            process_stock_period(args.symbol, period="weekly")
            process_stock_period(args.symbol, period="monthly")
            logger_manual.success()
        except Exception as e:
            success = False
            error_msg = str(e)
            logger.error(f"❌ {args.symbol} 同步失败: {e}")
            logger_manual.fail(str(e))
            import traceback
            traceback.print_exc()
        
        duration = time.time() - start_time
        
        # 发送通知 (Legacy logic maintained)
        if success:
            logger.info(f"✅ {args.symbol} 同步完成，耗时 {duration:.2f}s")
            report = f"### ✅ StockWise: On-Demand Sync\n"
            report += f"> **Symbol**: {args.symbol}\n"
            report += f"- **Status**: 成功\n"
            report += f"- **Periods**: 日线 + 周线 + 月线\n"
            report += f"- **执行耗时**: {duration:.1f}s"
        else:
            report = f"### ❌ StockWise: On-Demand Sync Failed\n"
            report += f"> **Symbol**: {args.symbol}\n"
            report += f"- **Status**: 失败\n"
            report += f"- **Error**: {error_msg[:200]}\n"
            report += f"- **执行耗时**: {duration:.1f}s"
        
        send_wecom_notification(report)
        
        # 确保失败时返回非零退出码
        if not success:
            sys.exit(1)
    else:
        # Job: Full Sync
        # run_full_sync internally might take long.
        t_logger = get_task_logger("market_observer", "full_daily_sync", triggered_by=trigger)
        t_logger.start("Full Market Sync", "ingestion", dimensions={})
        try:
            run_full_sync(market_filter=args.market)
            t_logger.success("Full sync completed")
        except Exception as e:
            t_logger.fail(str(e))
        
    # 强制退出，防止 libsql-client 后台线程导致进程挂起
    sys.exit(0)
