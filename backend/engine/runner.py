import asyncio
import logging
from typing import List, Dict, Any
from datetime import datetime

from backend.database import get_connection
from backend.engine.models.factory import ModelFactory
from backend.trading_calendar import get_next_trading_day_str

from backend.logger import logger

class PredictionRunner:
    def __init__(self, model_filter: str = None):
        """
        Args:
            model_filter: 指定要使用的模型 ID，如果为 None 则使用所有活动模型
        """
        self.model_filter = model_filter

    async def run_analysis(self, symbol: str, date: str = None, data: Dict[str, Any] = None):
        """
        Run multi-model analysis for a given stock.
        """
        logger.info(f"🏁 Starting Multi-Model Analysis for {symbol} on {date}")
        
        # 1. Get Active Models (Already sorted by priority DESC)
        models = ModelFactory.get_active_models()
        if not models:
            logger.warning("⚠️ No active models found!")
            return
        
        # Apply model filter if specified (and not 'all')
        if self.model_filter and self.model_filter != 'all':
            models = [m for m in models if m.model_id == self.model_filter]
            if not models:
                logger.warning(f"⚠️ Model '{self.model_filter}' not found or not active!")
                return
            logger.info(f"🎯 指定模型: {self.model_filter}")
        
        logger.info(f"🤖 Active Models: {[m.model_id for m in models]}")

        # 2. Fetch Data if not provided (needed for Rule Engine)
        conn = get_connection()
        try:
            if not data:
                cursor = conn.cursor()
                if date:
                    cursor.execute("SELECT * FROM daily_prices WHERE symbol = ? AND date = ?", (symbol, date))
                else:
                    cursor.execute("SELECT * FROM daily_prices WHERE symbol = ? ORDER BY date DESC LIMIT 1", (symbol,))
                
                row = cursor.fetchone()
                if row:
                    columns = [d[0] for d in cursor.description]
                    # Robust dict conversion
                    if isinstance(row, (tuple, list)):
                         row_dict = dict(zip(columns, row))
                    elif hasattr(row, 'keys'):
                         row_dict = dict(row)
                    else:
                         row_dict = {}
                         for i, col in enumerate(columns):
                             try: row_dict[col] = row[i]
                             except: pass
                    
                    data = {'price_data': [row_dict]}
                    if not date:
                         date = row_dict['date']
                else:
                     logger.warning(f"No daily price found for {symbol}")
                     data = {'price_data': []}
        finally:
            conn.close()
            
        # 3. Parallel Execution (The Race)
        tasks = []
        for model in models:
            tasks.append(self._safe_predict(model, symbol, date, data))
            
        predictions = await asyncio.gather(*tasks)
        
        # 4. Save Results & Determine Primary
        conn = get_connection()
        cursor = conn.cursor()
        
        # Only proceed if we have at least one successful prediction
        valid_predictions = [p for p in predictions if p]
        if not valid_predictions:
            logger.warning(f"⚠️ No successful predictions for {symbol}, aborting save.")
            conn.close()
            return

        try:
            # Reset existing primary flags for this day to avoid conflicts
            cursor.execute("UPDATE ai_predictions_v2 SET is_primary = 0 WHERE symbol = ? AND date = ?", (symbol, date))
        except Exception as e:
            logger.warning(f"Could not reset primary flags: {e}")

        primary_assigned = False
        saved_count = 0
        primary_pred = None
        
        for i, pred in enumerate(predictions):
            if not pred:
                continue
                
            model_id = pred['model_id']
            
            # Selector Logic: The first successful result (highest priority) is Primary
            is_primary = 0
            if not primary_assigned:
                is_primary = 1
                primary_assigned = True
                primary_pred = pred
                
            try:
                # Save to V2 Table
                cursor.execute("""
                    INSERT OR REPLACE INTO ai_predictions_v2 
                    (symbol, date, model_id, target_date, signal, confidence, 
                     support_price, pressure_price, ai_reasoning,
                     token_usage_input, token_usage_output, execution_time_ms,
                     is_primary, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '+8 hours'), datetime('now', '+8 hours'))
                """, (
                    symbol, date, model_id,
                    pred.get('target_date'), pred.get('signal'), pred.get('confidence'),
                    pred.get('support_price'), pred.get('pressure_price'), pred.get('reasoning'),
                    pred.get('token_usage_input', 0), pred.get('token_usage_output', 0),
                    pred.get('execution_time_ms', 0), is_primary
                ))
                saved_count += 1
            except Exception as e:
                logger.error(f"Failed to save V2 result for {model_id}: {e}")

        # 5. Compatibility: Sync Primary to Legacy Table (ai_predictions)
        if primary_pred:
            try:
                cursor.execute("""
                    INSERT OR REPLACE INTO ai_predictions 
                    (symbol, date, target_date, signal, confidence, support_price, ai_reasoning, model, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '+8 hours'), datetime('now', '+8 hours'))
                """, (
                    symbol, date, 
                    primary_pred.get('target_date'),
                    primary_pred.get('signal'),
                    primary_pred.get('confidence'),
                    primary_pred.get('support_price'),
                    primary_pred.get('reasoning'),
                    primary_pred['model_id']
                ))
                logger.debug(f"✅ Synced primary ({primary_pred['model_id']}) to legacy table.")
            except Exception as e:
                logger.error(f"Failed to sync to legacy table: {e}")

        conn.commit()
        conn.close()
        logger.info(f"✅ Analysis completed for {symbol}. Saved {saved_count} results. Primary: {primary_pred['model_id'] if primary_pred else 'None'}")

    async def _safe_predict(self, model, symbol, date, data):
        try:
            result = await model.predict(symbol, date, data)
            if result is None:
                return None
                
            result['model_id'] = model.model_id
            
            # Accurate Target Date logic: Next Trading Day after 'date'
            try:
                result['target_date'] = get_next_trading_day_str(date, symbol=symbol)
            except Exception as te:
                logger.warning(f"Failed to calculate target_date for {date}: {te}")
                result['target_date'] = date # Fallback
            
            return result
        except Exception as e:
            logger.error(f"❌ Model {model.model_id} failed: {e}")
            return None

