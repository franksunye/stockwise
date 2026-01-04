import asyncio
import logging
from typing import List, Dict, Any
from datetime import datetime

from backend.database import get_connection
from backend.engine.models.factory import ModelFactory
# from backend.fetchers import get_stock_data_with_indicators # Assume this exists or will be adapted

logger = logging.getLogger(__name__)

class PredictionRunner:
    def __init__(self):
        pass

    async def run_analysis(self, symbol: str, date: str = None, data: Dict[str, Any] = None):
        """
        Run multi-model analysis for a given stock.
        """
        logger.info(f"🏁 Starting Multi-Model Analysis for {symbol} on {date}")
        
        # 1. Get Active Models
        models = ModelFactory.get_active_models()
        if not models:
            logger.warning("⚠️ No active models found!")
            return
        
        logger.info(f"🤖 Active Models: {[m.model_id for m in models]}")

        # 2. Fetch Data if not provided (needed for Rule Engine)
        conn = get_connection()
        try:
            if not data:
                # Fetch only latest row for Rule Engine mainly, 
                # LLM (OpenAIAdapter) fetches its own full history via prompts.py
                # But RuleAdapter needs 'price_data' as a list or dict.
                cursor = conn.cursor()
                if date:
                    cursor.execute("SELECT * FROM daily_prices WHERE symbol = ? AND date = ?", (symbol, date))
                else:
                    cursor.execute("SELECT * FROM daily_prices WHERE symbol = ? ORDER BY date DESC LIMIT 1", (symbol,))
                
                row = cursor.fetchone()
                if row:
                    columns = [d[0] for d in cursor.description]
                    if isinstance(row, (tuple, list)):
                         row_dict = dict(zip(columns, row))
                    elif hasattr(row, 'keys'):
                         row_dict = dict(row)
                    else:
                         try:
                             row_dict = dict(zip(columns, row))
                         except:
                             row_dict = {}
                             for i, col in enumerate(columns):
                                 try:
                                     row_dict[col] = row[i]
                                 except:
                                     pass
                    
                    # Pass as list of 1 for rule adapter compatibility (it expects list)
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
            
        # Run all
        predictions = await asyncio.gather(*tasks)
        
        # 4. Save Results & Determine Primary
        conn = get_connection()
        cursor = conn.cursor()
        
        # Filter out Nones
        valid_predictions = [p for p in predictions if p]
        
        if not valid_predictions:
            logger.error(f"❌ All models failed for {symbol}")
            conn.close()
            return

        # Simple Selector Logic: Highest Priority with Confidence > 0.6
        # Sort by Priority DESC
        # Need to know priority? It's in model config or we can join with model def.
        # Here we rely on the fact that `models` list was sorted by priority DESC from Factory.
        # So we just match results back to models.
        
        primary_set = False
        
        for i, pred in enumerate(valid_predictions):
            model_id = pred['model_id']
            # Find model priority from the model object (assuming order matches or we look it up)
            # Better: _safe_predict returns model_id so we know who it is.
            
            # Default logic: The first one (highest priority) is primary
            # Ideally we check confidence threshold too.
            is_primary = False
            if not primary_set:
                is_primary = True
                primary_set = True
                
            # Insert into DB
            try:
                cursor.execute("""
                    INSERT OR REPLACE INTO ai_predictions_v2 
                    (symbol, date, model_id, target_date, signal, confidence, 
                     support_price, pressure_price, ai_reasoning,
                     token_usage_input, token_usage_output, execution_time_ms,
                     is_primary, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """, (
                    symbol,
                    date,
                    model_id,
                    pred.get('target_date'), # Should be calculated or returned
                    pred.get('signal'),
                    pred.get('confidence'),
                    pred.get('support_price'),
                    pred.get('pressure_price'),
                    pred.get('reasoning'),
                    pred.get('token_usage_input', 0),
                    pred.get('token_usage_output', 0),
                    pred.get('execution_time_ms', 0),
                    is_primary
                ))
            except Exception as e:
                logger.error(f"Failed to save result for {model_id}: {e}")

        conn.commit()
        conn.close()
        logger.info(f"✅ Analysis completed for {symbol}. Saved {len(valid_predictions)} results.")

    async def _safe_predict(self, model, symbol, date, data):
        try:
            # We assume model.predict returns a dict
            result = await model.predict(symbol, date, data)
            result['model_id'] = model.model_id
            
            # Simple Target Date logic (T+1)
            # TODO: Improve calendar logic
            result['target_date'] = date # Placeholder
            
            return result
        except Exception as e:
            logger.error(f"❌ Model {model.model_id} failed: {e}")
            return None
