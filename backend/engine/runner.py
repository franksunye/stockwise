import asyncio
import logging
import uuid
import json
import traceback
import os
from typing import List, Dict, Any
from datetime import datetime

from backend.database import get_connection
from backend.engine.models.factory import ModelFactory
from backend.trading_calendar import get_next_trading_day_str

from backend.db_repo.queries import SAVE_PREDICTION_V2_QUERY, CHECK_PREDICTION_V2_EXISTS_QUERY
from backend.engine.context import SessionContext
from backend.engine.layer1_state import build_layer1_snapshot
from backend.logger import logger
from backend.engine.metaphor import metaphor_engine

class PredictionRunner:
    def __init__(self, model_filter: str = None, force: bool = False):
        """
        Args:
            model_filter: 指定要使用的模型 ID，如果为 None 则使用所有活动模型
            force: 是否强制重新运行已存在的预测
        """
        self.model_filter = model_filter
        self.force = force

    async def run_analysis(self, symbol: str, date: str = None, data: Dict[str, Any] = None, force: bool = False):
        """
        Run multi-model analysis for a given stock.
        """
        # 0. Initialize Trace & Context
        trace_id = (data or {}).get("trace_id") or f"tr-{uuid.uuid4().hex[:12]}"
        
        # Use instance force or method force
        effective_force = force or self.force
        logger.info(f"🏁 [{trace_id}] Starting Multi-Model Analysis for {symbol} on {date}")
        
        # 1. Get Active Models (Already sorted by priority DESC)
        models = ModelFactory.get_active_models()
        if not models:
            logger.warning("⚠️ No active models found!")
            return False
        
        # Apply model filter if specified (and not 'all')
        if self.model_filter and self.model_filter != 'all':
            models = [m for m in models if m.model_id == self.model_filter]
            if not models:
                logger.warning(f"⚠️ Model '{self.model_filter}' not found or not active!")
                return False
            logger.info(f"🎯 指定模型: {self.model_filter}")
        
        logger.info(f"🤖 Active Models: {[m.model_id for m in models]}")

        # 2. Fetch Data (with SessionContext caching)
        ctx = SessionContext(symbol, date)
        if not data:
            try:
                from backend.engine.prompts import fetch_full_analysis_context
                data = await fetch_full_analysis_context(symbol, date, ctx=ctx)
                
                if "error" in data:
                    logger.warning(f"⚠️ Data context fetch failed: {data['error']}")
                    return False
                
                # Align date if it was None
                if not date:
                    date = data['date']
                    ctx.date = date # Update context date
                    
                logger.info(f"📊 Rich context fetched for {symbol} on {date}")
            except Exception as e:
                logger.error(f"❌ Failed to fetch full context: {e}")
                return False

            
        # 3. Parallel Execution (The Race)
        tasks = []
        from backend.engine.prompts import fetch_ai_history_for_model
        layer1_snapshot = build_layer1_snapshot(symbol=symbol, daily_history=data.get("daily_prices") or [])
        layer1_payload_json = json.dumps(layer1_snapshot.payload, ensure_ascii=False)
        logger.info(
            f"🧭 [{trace_id}] Layer1={layer1_snapshot.setup_state} "
            f"(score={layer1_snapshot.opportunity_score}, strategy={layer1_snapshot.strategy_version})"
        )
        
        for model in models:
            # Model-specific data context: each model reviews its own history
            model_specific_data = data.copy() if data else {}
            # Ensure trace_id is available to models if they need it
            model_specific_data['trace_id'] = trace_id
            model_specific_data['layer1'] = {
                "status": layer1_snapshot.setup_state,
                "score": layer1_snapshot.opportunity_score,
                "trigger_rule_hit": layer1_snapshot.trigger_rule_hit,
                "risk_off_hit": layer1_snapshot.risk_off_hit,
                "strategy_version": layer1_snapshot.strategy_version,
                "payload": layer1_snapshot.payload,
            }
            
            try:
                # Use ctx for model history caching
                history_data = fetch_ai_history_for_model(symbol, date, model_id=model.model_id, ctx=ctx)
                model_specific_data.update(history_data)
                
                total_hist = len(model_specific_data['ai_history'])
                acc_rate = model_specific_data['accuracy']['rate']
                logger.info(f"📜 {model.model_id} history loaded: {total_hist} records, {acc_rate:.1f}% acc")
            except Exception as e:
                logger.warning(f"⚠️ Failed to fetch specific history for {model.model_id}: {e}")
            
            tasks.append(self._safe_predict(model, symbol, date, model_specific_data, force=effective_force))
            
        predictions = await asyncio.gather(*tasks)
        logger.info(f"🏁 Analysis round finished. {ctx.stats()}")
        
        # 4. Save Results & Determine Primary
        conn = get_connection()
        cursor = conn.cursor()
        
        # Only proceed if we have at least one successful prediction
        valid_predictions = [p for p in predictions if p]
        if not valid_predictions:
            logger.warning(f"⚠️ [{trace_id}] No successful predictions for {symbol}, aborting save.")
            conn.close()
            return False

        try:
            # Check existing primary model's priority for this symbol/date
            cursor.execute("""
                SELECT p.model_id, m.priority 
                FROM ai_predictions_v2 p 
                JOIN prediction_models m ON p.model_id = m.model_id
                WHERE p.symbol = ? AND p.date = ? AND p.is_primary = 1
            """, (symbol, date))
            existing_primary = cursor.fetchone()
            existing_primary_model_id = existing_primary[0] if existing_primary else None
            existing_priority = existing_primary[1] if existing_primary else -1
        except Exception as e:
            logger.warning(f"Could not check existing primary: {e}")
            existing_primary_model_id = None
            existing_priority = -1

        saved_count = 0
        primary_pred = None
        
        # Get priority map for ALL models from database (to handle filtered case)
        try:
            cursor.execute("SELECT model_id, priority FROM prediction_models")
            model_priorities = {row[0]: row[1] for row in cursor.fetchall()}
        except:
            model_priorities = {m.model_id: m.priority for m in models}
        
        # [Critical Guard] Detect if a higher-priority model failed this run.
        # If so, do NOT promote lower-priority models to primary.
        # Reason: PRO users pay for premium model (DeepSeek) analysis.
        # Showing rule-engine or hunyuan-lite as primary would be a degraded experience.
        attempted_model_ids = [m.model_id for m in models]
        succeeded_model_ids = {p['model_id'] for p in valid_predictions}
        failed_model_ids = set(attempted_model_ids) - succeeded_model_ids
        
        highest_attempted_priority = max(
            (model_priorities.get(mid, 0) for mid in attempted_model_ids), default=0
        )
        highest_succeeded_priority = max(
            (model_priorities.get(mid, 0) for mid in succeeded_model_ids), default=0
        )
        
        # If a higher-priority model failed, block primary promotion for lower models
        primary_promotion_blocked = highest_succeeded_priority < highest_attempted_priority
        if primary_promotion_blocked:
            failed_high = [mid for mid in failed_model_ids 
                          if model_priorities.get(mid, 0) >= highest_succeeded_priority]
            logger.warning(
                f"🛡️ [{trace_id}] Primary promotion blocked: "
                f"Higher-priority models failed: {failed_high}. "
                f"Lower models will be saved but NOT set as primary."
            )
        
        for i, pred in enumerate(predictions):
            if not pred:
                continue
                
            model_id = pred['model_id']
            model_priority = model_priorities.get(model_id, 0)
            
            # Selector Logic: Set primary if this model has higher or equal priority than existing primary,
            # or if this model was already the primary (force re-run case)
            # BUT: Block promotion if a higher-priority model failed this run.
            is_primary = 0
            if not primary_promotion_blocked:
                should_be_primary = (
                    model_priority > existing_priority or 
                    model_id == existing_primary_model_id  # Keep primary if same model (force re-run)
                )
                if should_be_primary:
                    # Reset old primary and set new one
                    cursor.execute("UPDATE ai_predictions_v2 SET is_primary = 0 WHERE symbol = ? AND date = ?", (symbol, date))
                    is_primary = 1
                    existing_priority = model_priority  # Update for next iteration
                    existing_primary_model_id = model_id
                    primary_pred = pred
                
            try:
                # 4.5 Generate Visual Story (Silent Math Overlay)
                # This is a "Side Effect" decoupled from core prediction logic.
                try:
                    latest_market_data = data.get('latest_data', {}) if data else {}
                    visual_story = metaphor_engine.get_visual_story(pred, latest_market_data)
                    
                    # Inject into reasoning JSON to keep DB schema untouched
                    reasoning_dict = json.loads(pred.get('reasoning', '{}'))
                    reasoning_dict['visual_story'] = visual_story
                    pred['reasoning'] = json.dumps(reasoning_dict, ensure_ascii=False)
                    logger.debug(f"✨ Visual storyline injected for {symbol} ({model_id})")
                except Exception as ve:
                    logger.warning(f"⚠️ Metaphor Engine failed for {symbol}: {ve}")

                # Save to V2 Table
                cursor.execute(SAVE_PREDICTION_V2_QUERY, (
                    symbol, date, model_id,
                    pred.get('target_date'), pred.get('signal'), pred.get('confidence'),
                    pred.get('support_price'), pred.get('pressure_price'), pred.get('reasoning'),
                    pred.get('prompt_version', 'v1'), # Validated version from Adapter
                    pred.get('token_usage_input', 0), pred.get('token_usage_output', 0),
                    pred.get('execution_time_ms', 0), is_primary, trace_id,
                    layer1_snapshot.setup_state,
                    layer1_snapshot.opportunity_score,
                    layer1_snapshot.trigger_rule_hit,
                    layer1_snapshot.risk_off_hit,
                    layer1_snapshot.strategy_version,
                    layer1_payload_json,
                ))
                saved_count += 1
            except Exception as e:
                logger.error(f"Failed to save V2 result for {model_id}: {e}")

        # 5. Compatibility: Sync Primary to Legacy Table (ai_predictions) - REMOVED
        # Data is now fully managed in ai_predictions_v2

        conn.commit()
        conn.close()
        logger.info(f"✅ Analysis completed for {symbol}. Saved {saved_count} results. Primary: {primary_pred['model_id'] if primary_pred else 'None'}")
        
        # Return a summarized success object instead of just the primary prediction
        return {
            "primary": primary_pred,
            "models": [p['model_id'] for p in valid_predictions if p] # All models that succeeded
        } if valid_predictions else False

    async def _safe_predict(self, model, symbol, date, data, force: bool = False):
        try:
            # 1. Idempotency check per model
            if not force:
                conn = get_connection()
                cursor = conn.cursor()
                try:
                    cursor.execute(
                    CHECK_PREDICTION_V2_EXISTS_QUERY,
                    (symbol, date, model.model_id)
                    )
                    if cursor.fetchone():
                        logger.debug(f"⏩ Model {model.model_id} already has prediction for {symbol} on {date}, bypassing.")
                        return None
                finally:
                    conn.close()

            # 2. Execute prediction
            result = await model.predict(symbol, date, data)
            if result is None:
                return None

            # Layer-1 is the single source of directional truth.
            # Model output may keep tactical narrative freedom, but signal is enforced.
            layer1 = data.get("layer1") or {}
            result = _enforce_layer1_direction(result, layer1)
            
            # 3. Guard: Reject error results from being treated as valid predictions
            # This prevents API errors (e.g. "Fatal Error: HTTP 403...") from being
            # saved to the database and displayed to end users.
            if result.get('validation_status') == 'Error' or (
                result.get('confidence', 1) == 0 and 
                isinstance(result.get('reasoning', ''), str) and
                not result['reasoning'].startswith('{')
            ):
                reason_preview = str(result.get('reasoning', ''))[:80]
                logger.warning(f"⚠️ [{model.model_id}] Prediction rejected (error result): {reason_preview}...")
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


def _layer1_to_signal(setup_state: str) -> str:
    if setup_state == "TriggeredLong":
        return "Long"
    if setup_state in {"NoSetup", "Watch", "RiskOff"}:
        return "Side"
    return "Side"


def _is_truthy_env(name: str, default: str = "1") -> bool:
    raw = os.getenv(name, default).strip().lower()
    return raw in {"1", "true", "yes", "on"}


def _enforce_layer1_direction(result: Dict[str, Any], layer1: Dict[str, Any]) -> Dict[str, Any]:
    setup_state = str(layer1.get("status") or "")
    expected = _layer1_to_signal(setup_state)
    signal = result.get("signal", "Side")

    # Keep a kill-switch for emergency rollback in production.
    if not _is_truthy_env("LAYER1_SIGNAL_ENFORCE", "1"):
        return result

    if signal != expected:
        logger.warning(
            f"🧱 Layer1 signal enforced: model={signal} -> layer1={expected} "
            f"(status={setup_state})"
        )
        result["signal"] = expected
    return result
