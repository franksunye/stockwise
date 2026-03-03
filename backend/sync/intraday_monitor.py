"""
Intraday Monitor Engine (Rule-Based Sniper)
-------------------------------------------
This module provides a lightweight, pure-rule engine for intraday price monitoring.
It bridges the gap between daily AI analysis and real-time market action.

Workflow:
1. Load "Active Predictions" from `ai_predictions_v2` (Yesterday's output).
2. For each stock, extract Strategy:
   - Bullish: Monitor Pressure Level (Breakout) & Support Level (Stop Loss).
   - Bearish: Monitor Support Level (Breakdown).
3. In `realtime.py` loop: Check current price against these levels.
4. Trigger Notification if crossed.
"""
import time
import threading
from typing import Dict, Optional, Tuple
from datetime import datetime

try:
    from backend.logger import logger
    from backend.database import get_connection
    from backend.notification_service import NotificationManager
except ImportError:
    from logger import logger
    from database import get_connection
    from notification_service import NotificationManager

class IntradayMonitor:
    _instance = None
    _lock = threading.Lock()
    
    # In-memory cache of monitoring rules
    # { "00700": { "direction": "Bullish", "pressure": 400.0, "support": 380.0, ... } }
    watch_list: Dict[str, Dict] = {}
    
    # State tracking to avoid spamming (Dedup)
    # { "00700_breakout": 1715000000 }
    alert_history: Dict[str, float] = {}
    
    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super(IntradayMonitor, cls).__new__(cls)
        return cls._instance

    def __init__(self):
        if hasattr(self, '_initialized'): return
        self._initialized = True
        self.notif_manager = NotificationManager()
        self.last_reload_time = 0
        self.RELOAD_INTERVAL = 3600  # Reload rules every hour (incase of manual updates)

    def load_rules(self):
        """
        Load the latest VALID predictions from DB to build the WatchList.
        Should be called once at startup (and periodically).
        """
        # Dedup reload
        if time.time() - self.last_reload_time < 300: # Min 5 min interval
            return
            
        logger.info("🔭 IntradayMonitor: Loading Strategy Rules from AI Predictions...")
        
        conn = get_connection()
        try:
            cursor = conn.cursor()
            # Fetch the LATEST primary prediction for each stock
            # Logic: Get predictions generated within last 3 days (to cover weekends)
            # that are marked 'is_primary=1'.
            sql = """
                SELECT 
                    symbol, signal, confidence, support_price, pressure_price, ai_reasoning, date
                FROM ai_predictions_v2
                WHERE is_primary = 1 
                  AND date >= date('now', '-4 days') 
                ORDER BY date DESC
            """
            cursor.execute(sql)
            rows = cursor.fetchall()
            
            new_watch_list = {}
            count = 0
            
            for row in rows:
                sym, signal, conf, support, pressure, reason, p_date = row
                
                # Basic Validation
                if not signal or not support or not pressure:
                    continue
                
                # Strategy logic based on signal
                # Only monitor high confidence setups? Or all? Let's do all Is_Primary.
                strategy = {
                    "signal": signal,
                    "confidence": conf or 0,
                    "support": float(support),
                    "pressure": float(pressure),
                    "reason_snippet": (reason[:50] + "...") if reason else "AI分析",
                    "date": p_date
                }
                
                # Keep the latest prediction for each symbol
                if sym not in new_watch_list:
                    new_watch_list[sym] = strategy
                    count += 1
            
            self.watch_list = new_watch_list
            self.last_reload_time = time.time()
            logger.info(f"🔭 IntradayMonitor: Loaded {count} active strategies.")
            
        except Exception as e:
            logger.error(f"❌ IntradayMonitor Load Failed: {e}")
        finally:
            conn.close()

    def check(self, symbol: str, current_price: float, current_change: float = 0):
        """
        The core sniper logic. Called by realtime.py for every price update.
        """
        # 1. Fast lookup
        strategy = self.watch_list.get(symbol)
        if not strategy:
            return

        signal = strategy['signal']
        pressure = strategy['pressure']
        support = strategy['support']
        
        # 2. Rule Evaluation
        alert_type = None
        trigger_price = 0
        
        # Scenario A: Bullish Signal - Watch for Resistance Breakout
        if "Bullish" in signal:
            # Upside Breakout
            if current_price > pressure:
                alert_type = "bull_breakout" # 突破压力
                trigger_price = pressure
            # Downside Breakdown (Stop Loss Alert)
            elif current_price < support:
                alert_type = "norm_breakdown" # 跌破支撑
                trigger_price = support
                
        # Scenario B: Bearish Signal - Watch for Support Breakdown
        elif "Bearish" in signal:
             if current_price < support:
                alert_type = "bear_breakdown" # 确认跌破
                trigger_price = support
        
        # Scenario C: Big Move Alert (Safety Net)
        # Assuming we also want to catch massive moves regardless of levels
        # (Optional, skipping for now to keep rules pure)

        if alert_type:
            self._trigger_alert(symbol, current_price, current_change, alert_type, strategy, trigger_price)

    def _trigger_alert(self, symbol: str, price: float, change: float, alert_type: str, strategy: Dict, trigger_val: float):
        """
        Handle dedup and notification dispatch.
        """
        # 1. Dedup Key: Symbol + AlertType + Day
        # Ensures we only alert once per type per day per stock
        # e.g. "00700_bull_breakout_2024-02-05"
        today = datetime.now().strftime("%Y%m%d")
        dedup_key = f"{symbol}_{alert_type}_{today}"
        
        if dedup_key in self.alert_history:
            return
            
        # 2. Cooldown check (Double safety)
        now = time.time()
        # Clean old history logic could go here, but memory is cheap for string keys
        
        # 3. Construct Message
        titles = {
            "bull_breakout": "🚀 强势突破预警",
            "norm_breakdown": "🛡️ 支撑位跌破提示",
            "bear_breakdown": "📉 确认破位下行"
        }
        
        status_emoji = "🔴" if change > 0 else "🟢" # CN Colors: Red is Up
        
        title = titles.get(alert_type, "股价异动预警")
        body = (
            f"{symbol} 现价 {price} ({status_emoji}{change:.2f}%) "
            f"越过关键图表位置 {trigger_val}。\n"
            f"AI策略: {strategy['signal']} (信心{strategy['confidence']})\n"
            f"分析依据: {strategy['reason_snippet']}"
        )
        
        # 4. Fire Notification
        # We send to ALL subscribers of this stock
        # Limitation: NotificationManager.send_prediction_update usually takes a UserID.
        # We need a broadcast method or iterate users. 
        # IntradayMonitor doesn't know users. It relies on Manager.
        
        # Quick Hack: Use a special "System Broadcast" per stock?
        # Better: Reuse NotificationManager's valid logic.
        # For MVP, we log and maybe notify Admin first, or use a new method in NotifManager.
        
        logger.info(f"🔔 SNIPER ALERT: {symbol} {alert_type} @ {price}")
        
        # Update State
        self.alert_history[dedup_key] = now
        
        # Call Notification Manager (Async)
        # We need to broadcast this to anyone watching 'symbol'.
        # Since calculating that list is expensive here, we delegate to NotifManager.
        threading.Thread(target=self.notif_manager.broadcast_price_alert, 
                         args=(symbol, title, body, alert_type)).start()

