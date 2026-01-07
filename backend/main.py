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
from analysis.runner import run_ai_analysis
from analysis.backfill import run_ai_analysis_backfill
from logger import logger


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='StockWise ETL Pipeline')
    parser.add_argument('--realtime', action='store_true', help='执行盘中实时同步')
    parser.add_argument('--sync', action='store_true', help='执行行情同步 (配合 --symbol 使用)')
    parser.add_argument('--sync-meta', action='store_true', help='仅同步股票元数据')
    parser.add_argument('--analyze', action='store_true', help='执行 AI 预测分析 (独立任务)')
    parser.add_argument('--symbol', type=str, help='指定股票代码')
    parser.add_argument('--market', type=str, choices=['CN', 'HK'], help='只同步/分析特定市场')
    parser.add_argument('--model', type=str, help='指定 AI 模型 (deepseek-v3, gemini-3-flash, rule-engine)')
    
    # 回填功能参数
    parser.add_argument('--date', type=str, help='指定分析日期 (YYYY-MM-DD)')
    parser.add_argument('--start-date', type=str, help='日期范围起始 (YYYY-MM-DD)')
    parser.add_argument('--end-date', type=str, help='日期范围结束 (YYYY-MM-DD)')
    parser.add_argument('--days', type=int, help='回填最近N天')
    parser.add_argument('--auto-fill', action='store_true', help='智能检测并补充缺失分析')
    parser.add_argument('--force', action='store_true', help='强制重新分析 (即使今日已存在)')
    
    args = parser.parse_args()
    init_db()
    
    # 判断是否为回填模式
    is_backfill_mode = args.date or args.start_date or args.end_date or args.days or args.auto_fill
    
    if args.sync_meta:
        sync_stock_meta()
        # 同步完基础列表后，顺便更新一波公司概况 (每次20个)
        sync_profiles(limit=20)
    elif args.analyze and is_backfill_mode:
        # 回填模式: 分析指定日期的历史数据
        run_ai_analysis_backfill(
            symbol=args.symbol,
            market_filter=args.market,
            date=args.date,
            start_date=getattr(args, 'start_date', None),
            end_date=getattr(args, 'end_date', None),
            days=args.days,
            auto_fill=args.auto_fill
        )
    elif args.analyze:
        # 独立运行 AI 分析 (分析最新数据)
        run_ai_analysis(symbol=args.symbol, market_filter=args.market, force=args.force, model_filter=args.model)
    elif args.symbol:
        # On-Demand Sync: 需要错误处理和通知
        start_time = time.time()
        success = True
        error_msg = None
        
        try:
            process_stock_period(args.symbol, period="daily")
            process_stock_period(args.symbol, period="weekly")
            process_stock_period(args.symbol, period="monthly")
        except Exception as e:
            success = False
            error_msg = str(e)
            logger.error(f"❌ {args.symbol} 同步失败: {e}")
            import traceback
            traceback.print_exc()
        
        duration = time.time() - start_time
        
        # 发送通知
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
    elif args.realtime:
        sync_spot_prices(get_stock_pool())
    else:
        run_full_sync(market_filter=args.market)
        
    # 强制退出，防止 libsql-client 后台线程导致进程挂起
    sys.exit(0)
