"""
AI 分析主入口模块
"""
import time
from datetime import datetime

import pandas as pd

from config import BEIJING_TZ
from database import get_connection, get_stock_pool
from utils import send_wecom_notification
from notifications import send_push_notification, send_personalized_daily_report
from engine.ai_service import generate_ai_prediction
from helpers import check_stock_analysis_mode, check_trading_day_skip
from logger import logger


from trading_calendar import get_market_from_symbol, is_market_closed

def run_ai_analysis(symbol: str = None, market_filter: str = None):
    """独立运行 AI 预测任务"""
    # 如果是例行运行（无特定代码），且该市场今天休市，则跳过
    if not symbol and check_trading_day_skip(market_filter):
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
            for s in pool:
                is_hk = len(s) == 5
                if (market_filter == "HK" and is_hk) or (market_filter == "CN" and not is_hk):
                    targets.append(s)
        else:
            targets = pool
    
    logger.info(f"🧠 开始执行 AI 分析任务，共 {len(targets)} 只股票...")
    start_time = time.time()
    success_count = 0
    ai_count = 0
    rule_count = 0
    
    conn = get_connection()
    
    # 获取当前北京时间用于判断休市
    now_date = datetime.now(BEIJING_TZ)

    for stock in targets:
        try:
            # 1. 检查该股票所属市场是否休市 (Cost Saving)
            # 如果指定了特定股票(symbol)，不仅要看休市，还要允许用户强制(但不建议在 runner 级强制，
            # 这里我们假设 runner 主要跑批，如果是单一调试通常不会太介意，但为了逻辑统一还是 check 一下好)
            # 但用户如果手动指定 symbol，通常是想调试，暂不强制跳过。
            # 只有批量跑的时候才严控交易日。
            if not symbol:
                market = get_market_from_symbol(stock)
                if is_market_closed(now_date, market):
                    logger.debug(f"💤 {stock}: {market} 市场休市，跳过")
                    continue

            # 获取该股票最新的日线数据 (含指标)
            query = f"SELECT * FROM daily_prices WHERE symbol = ? ORDER BY date DESC LIMIT 1"
            df = pd.read_sql_query(query, conn, params=(stock,))
            
            if df.empty:
                logger.warning(f"⚠️ {stock}: 无行情数据，跳过")
                continue
                
            today_data = df.iloc[0]
            logger.info(f">>> 分析 {stock} ({today_data['date']})")
            
            # 确定分析模式 (AI vs Rule)
            analysis_mode = check_stock_analysis_mode(stock)
            
            # 生成预测
            generate_ai_prediction(stock, today_data, mode=analysis_mode)
            success_count += 1
            if analysis_mode == 'ai':
                ai_count += 1
            else:
                rule_count += 1
            
        except Exception as e:
            logger.error(f"❌ {stock} 分析失败: {e}")
            
    duration = time.time() - start_time
    logger.info(f"✅ AI 分析完成! 成功: {success_count}/{len(targets)} (AI: {ai_count}, Rule: {rule_count}), 耗时: {duration:.1f}s")
    
    # 发送企微通知
    market_label = f" ({market_filter})" if market_filter else ""
    report = f"### 🧠 StockWise: AI Analysis{market_label}\n"
    report += f"> **Status**: ✅ 完成\n"
    report += f"- **Processed**: {success_count}/{len(targets)} Stocks\n"
    report += f"- **处理耗时**: {duration:.1f}s"
    send_wecom_notification(report)
    
    # 获取本次分析的基准日期 (取第一个分析成功的日期)
    base_date = None
    try:
        # 尝试从最近一条预测中获取日期
        cursor = conn.cursor()
        cursor.execute("SELECT date FROM ai_predictions ORDER BY created_at DESC LIMIT 1")
        row = cursor.fetchone()
        if row:
            base_date = row[0]
        else:
            base_date = datetime.now(BEIJING_TZ).strftime("%Y-%m-%d")
    except Exception as e:
        logger.debug(f"ℹ️ 获取最新预测日期失败 (可能库还没数据): {e}")
        base_date = datetime.now(BEIJING_TZ).strftime("%Y-%m-%d")

    # 1. 发送 Web Push 广播 (作为兜底，或者给没有关注列表的用户)
    send_push_notification(
        title="🤖 AI 日报生成完毕",
        body="今日深度分析报告已全量更新，点击查看实战行动建议。",
        url="/dashboard",
        broadcast=True,
        tag="daily_report"
    )

    # 2. 发送个性化推送 (针对性增强)
    try:
        # 稍微延迟一下，确保广播先到达（可选，但有助于体验）
        time.sleep(1)
        send_personalized_daily_report(targets, base_date)
    except Exception as e:
        logger.error(f"❌ 发送个性化推送失败: {e}")

    # 最后关闭连接
    try:
        conn.close()
    except:
        pass
