"""
AI 分析主入口模块
"""
import time
import os
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


def run_ai_analysis(symbol: str = None, market_filter: str = None, force: bool = False, model_filter: str = None):
    """独立运行 AI 预测任务
    
    Args:
        model_filter: 指定使用的模型 ID (deepseek-v3, gemini-3-flash, rule-engine)
    """
    # 如果是例行运行（无特定代码），且该市场今天休市，则跳过
    # logic moved to scheduler level
    # if not symbol and check_trading_day_skip(market_filter):
    #    return
        
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
    
    # [NEW] Initialize Smart Notification Manager if enabled
    from backend.config import ENABLE_SMART_NOTIFICATIONS
    from backend.notification_service import NotificationManager
    
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
    cursor = conn.cursor()
    
    # 获取当前北京时间用于判断休市
    now_date = datetime.now(BEIJING_TZ)

    for stock in targets:
        try:
            # 1. 检查该股票所属市场是否休市 (Cost Saving)
            # logic moved to scheduler level or implied by data availability
            # if not symbol:
            #     market = get_market_from_symbol(stock)
            #     if is_market_closed(now_date, market):
            #         logger.debug(f"💤 {stock}: {market} 市场休市，跳过")
            #         continue

            # 获取该股票最新的日线数据 (含指标)
            query = f"SELECT * FROM daily_prices WHERE symbol = ? ORDER BY date DESC LIMIT 1"
            df = pd.read_sql_query(query, conn, params=(stock,))
            
            if df.empty:
                logger.warning(f"⚠️ {stock}: 无行情数据，跳过")
                continue
                
            today_data = df.iloc[0]
            today_str = today_data['date']
            
            # --- Idempotency Check (幂等性检查) ---
            # 改良逻辑：如果是单模型运行，只检查该模型。如果是 all 运行，交给 PredictionRunner 内部处理。
            if not force:
                if model_filter and model_filter != 'all':
                    cursor.execute(
                        "SELECT 1 FROM ai_predictions_v2 WHERE symbol = ? AND date = ? AND model_id = ? LIMIT 1",
                        (stock, today_str, model_filter)
                    )
                    if cursor.fetchone():
                        logger.info(f"⏩ {stock}: {today_str} ({model_filter}) 预测已存在，跳过")
                        success_count += 1
                        # No notification here for skipped items in new logic
                        continue
                # 如果是 all，这里不再做整体跳过，让子引擎去判断具体哪个模型没跑
            # --------------------------------------

            logger.info(f">>> 分析 {stock} ({today_str})")
            
            # 确定分析模式 (AI vs Rule) - Now handled by Race Mode internally, but we can keep log
            # analysis_mode = check_stock_analysis_mode(stock) # Deprecated but harmless
            
            # 生成预测 (New Multi-Model Engine)
            # Use local import to avoid circular dependency issues if any
            try:
                from backend.engine.runner import PredictionRunner
                import asyncio
                
                runner = PredictionRunner(model_filter=model_filter, force=force)
                
                # Run async in sync context
                if os.name == 'nt':
                    try:
                        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
                    except: pass
                     
                analysis_result = asyncio.run(runner.run_analysis(stock, today_str))
                
                if analysis_result:
                    # analysis_result is now a dict: {"primary": ..., "models": [...]}
                    primary_result = analysis_result.get('primary')
                    all_models = analysis_result.get('models', [])
                    
                    # [NEW] Check for Signal Flips for each subscriber
                    if notif_manager and isinstance(primary_result, dict):
                        subscribers = stock_subscribers.get(stock, set())
                        for uid in subscribers:
                            notif_manager.check_signal_flip(
                                uid, stock, 
                                primary_result.get('signal'), 
                                primary_result.get('confidence')
                            )
                            # Queue service-level update notification ("Data Ready")
                            notif_manager.queue_notification(
                                uid, 
                                "prediction_updated", 
                                {"symbol": stock, "market": market_filter or "CN"}
                            )

                    success_count += 1
                    
                    # Distinguish AI and Rule successes for reporting
                    if any(m != 'rule-engine' for m in all_models):
                        ai_count += 1
                    if 'rule-engine' in all_models:
                        rule_count += 1
                    
                else:
                    logger.warning(f"⚠️ {stock}: Analysis failed or returned no results.")
                
            except Exception as e:
                logger.error(f"❌ {stock} AI Engine Failed: {e}")
                continue
            
        except Exception as e:
            logger.error(f"❌ {stock} 分析失败: {e}")

    # [NEW] Finalize Smart Notifications (Flush updates and send aggregated)
    if notif_manager:
        notif_manager.flush()
        logger.info("📢 [Runner] Smart notification flush completed")
            
    duration = time.time() - start_time
    logger.info(f"✅ AI 分析完成! 成功: {success_count}/{len(targets)} (AI: {ai_count}, Rule: {rule_count}), 耗时: {duration:.1f}s")
    
    # 发送企微通知
    # 发送企微通知
    if success_count == len(targets):
        status = "✅ SUCCESS"
    elif success_count > 0:
        status = "⚠️ PARTIAL"
    else:
        status = "❌ FAILED"
        
    market_label = f"({market_filter})" if market_filter else ""
    try:
        from backend.notification_templates import NotificationTemplates
    except ImportError:
        from notification_templates import NotificationTemplates

    title, body = NotificationTemplates.render(
        "admin_task_report",
        task_title=f"AI Analysis {market_label}",
        status=status,
        total=len(targets),
        success=success_count,
        ai=ai_count,
        rule=rule_count,
        failed=len(targets) - success_count,
        duration=round(duration, 1)
    )
    # Append Data Health Diagnostics
    try:
        from backend.context.provider import MarketContextProvider
        stats = MarketContextProvider().get_diagnostics()
        
        warnings = []
        if stats.get('macro_attempts', 0) > 0 and stats.get('macro_success', 0) == 0:
            warnings.append("⚠️ Macro Data Unavailable")
        
        flow_attempts = stats.get('stock_flow_attempts', 0)
        flow_success = stats.get('stock_flow_success', 0)
        if flow_attempts > 0:
            fail_rate = (flow_attempts - flow_success) / flow_attempts
            if fail_rate > 0.5:
                warnings.append(f"⚠️ High Flow Data Failure ({fail_rate:.0%})")
        
        if warnings:
            body += "\n\n**Data Health Issues:**\n" + "\n".join(f"- {w}" for w in warnings)
            title = title.replace("✅", "⚠️") if "✅" in title else title
            
    except Exception as stat_e:
        logger.warning(f"Failed to append diagnostics: {stat_e}")

    send_wecom_notification(title + body)
    
    # [REMOVED] Old broadcast notification
    # Individual users are now notified as their watchlists complete
    # See user_tracker.py::notify_user_prediction_updated()

    # 最后关闭连接
    conn.close()
