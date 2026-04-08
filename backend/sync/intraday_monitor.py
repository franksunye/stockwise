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
    from backend.notification_templates import NotificationTemplates
    from backend.engine.signal_semantics import signal_weight
except ImportError:
    from logger import logger
    from database import get_connection
    from notification_service import NotificationManager
    from notification_templates import NotificationTemplates
    from engine.signal_semantics import signal_weight

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
        self.RELOAD_INTERVAL = 1800  # Reload rules every 30 minutes for fresher targets

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
            # Fetch the LATEST primary prediction for each stock targeting TODAY
            # Logic: Use the signal generated most recently for active tracking.
            sql = """
                SELECT 
                    symbol, signal, confidence, support_price, pressure_price, ai_reasoning, date
                FROM ai_predictions_v2
                WHERE (is_primary = 1 OR model_id = 'rule-engine')
                  AND date >= date('now', '-3 days') 
                ORDER BY created_at DESC
            """
            cursor.execute(sql)
            rows = cursor.fetchall()
            
            new_watch_list = {}
            count = 0
            
            for row in rows:
                sym, signal, conf, support, pressure, reason, p_date = row
                
                # Basic Validation: Must have at least one anchor price to monitor
                if not signal or (not support and not pressure):
                    continue
                
                # Use unified weight from semantic registry
                weight = signal_weight(signal)
                
                # Radar logic: We only care about stocks that have an active 'Bias' (Long/Short)
                # or a specific 'Trigger' setup from the morning call.
                if weight == 0 and signal not in ("Watch", "Side"):
                    continue

                new_watch_list[sym] = {
                    "signal": signal,
                    "weight": weight,
                    "confidence": conf or 0,
                    "support": float(support) if support else None,
                    "pressure": float(pressure) if pressure else None,
                    "reason_snippet": (reason[:50] + "...") if reason else "AI策略点位",
                    "date": p_date
                }
                count += 1
            
            self.watch_list = new_watch_list
            self.last_reload_time = time.time()
            logger.info(f"🔭 IntradayMonitor: Optimized {count} radar tracking targets.")
            
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
        weight = strategy.get('weight', 0)
        pressure = strategy['pressure']
        support = strategy['support']
        
        # 2. Advanced Radar Evaluation
        alert_type = None
        trigger_val = 0
        
        # Case A: Logic Resonance (剧本加速 - 共振)
        # Prediction was Long/Strong and price breaks the Resistance
        if weight > 0 and pressure and current_price > pressure:
            alert_type = "resonance"
            trigger_val = pressure
            
        # Case B: Logic Deviation (剧本偏离 - 背离)
        # Prediction was Long but price drops below Support (Stop Loss Zone)
        elif weight > 0 and support and current_price < support:
            alert_type = "deviation"
            trigger_val = support
            
        # Case C: Bearish Extension (空头加速)
        elif weight < 0 and support and current_price < support:
            alert_type = "resonance" # Also a resonance of its bearish intent
            trigger_val = support
        
        if alert_type:
            self._trigger_alert(symbol, current_price, current_change, alert_type, strategy, trigger_val)

    def _trigger_alert(self, symbol: str, price: float, change: float, alert_type: str, strategy: Dict, trigger_val: float):
        # 1. Dedup Logic (Once per day per type per stock)
        today = datetime.now().strftime("%Y%m%d")
        dedup_key = f"{symbol}_{alert_type}_{today}"
        
        if dedup_key in self.alert_history:
            return
            
        # 2. Use unified NotificationTemplates
        # 2. Prepare Context for NotificationManager (Rendering handled inside loop for i18n)
        is_bearish_resonance = alert_type == "resonance" and strategy.get("weight", 0) < 0
        if is_bearish_resonance:
            resonance_type = "逻辑共振 (空头延续)"
            strategy_tip = f"跌破了关键支撑位 {trigger_val:.2f}。请根据 Pro 计划优先防守。"
        elif alert_type == "resonance":
            resonance_type = "逻辑共振 (脚本加速)"
            strategy_tip = f"突破了关键压力点 {trigger_val:.2f}。请根据 Pro 计划关注进攻性。"
        else:
            resonance_type = "剧本背离 (逻辑回撤)"
            strategy_tip = f"回撤并跌破了止损支撑线 {trigger_val:.2f}。注意防守。"

        context = {
            "stock_names": symbol,
            "current_price": f"{price:.2f}",
            "resonance_type": resonance_type,
            "strategy_tip": strategy_tip,
            "url": f"/dashboard?symbol={symbol}&utm_source=push&utm_medium=ai_radar"
        }

        logger.info(f"🔔 RADAR SNAP: {symbol} [{alert_type}] @ {price}")
        
        # Update State
        self.alert_history[dedup_key] = time.time()
        
        # 3. Fire Notification (Unified Radar tag)
        threading.Thread(target=self.notif_manager.broadcast_price_alert, 
                         args=(symbol, "ai_radar_alert", context, "ai_radar_alert")).start()
