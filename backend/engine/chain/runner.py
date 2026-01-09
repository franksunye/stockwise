import time
import uuid
import json
import asyncio
from typing import List, Dict, Any
from loguru import logger

from database import get_connection, is_transient_error
from engine.llm_client import LLMClient
from .context import ChainContext
from .steps.base import BaseStep, StepExecutionError

class ChainRunner:
    """
    Orchestrates the execution of a multi-step LLM chain.
    """
    def __init__(self, 
                 model_id: str, 
                 strategy_name: str, 
                 steps: List[BaseStep], 
                 llm_client: LLMClient):
        self.model_id = model_id
        self.strategy_name = strategy_name
        self.steps = steps
        self.client = llm_client

    async def run(self, symbol: str, date: str, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Executes the chain and returns the final result artifact.
        Persists trace to DB *after* completion (Delayed Write).
        """
        trace_id = str(uuid.uuid4())
        context = ChainContext(symbol=symbol, date=date, input_data=input_data)
        
        start_time = time.time()
        final_status = "success"
        error_info = {"step": None, "reason": None}
        
        logger.info(f"🚀 Starting Chain {self.strategy_name} for {symbol} (Trace: {trace_id})")

        try:
            for step in self.steps:
                step_start = time.time()
                await step.execute(context, self.client)
                duration = int((time.time() - step_start) * 1000)
                
                context.step_durations.append({
                    "step": step.step_name,
                    "duration_ms": duration
                })
        
        except StepExecutionError as e:
            final_status = "failed"
            error_info["step"] = e.step_name
            error_info["reason"] = e.message
            logger.error(f"❌ Chain Failed at {e.step_name}: {e.message}")
            raise  # Re-raise to let upstream know
            
        except Exception as e:
            final_status = "failed"
            error_info["step"] = "unknown"
            error_info["reason"] = str(e)
            logger.error(f"❌ Chain Crushed: {e}")
            raise

        finally:
            # --- Delayed Write Persistence ---
            # Regardless of success/failure, we write the full trace now.
            total_duration = int((time.time() - start_time) * 1000)
            await self._persist_trace(trace_id, context, final_status, total_duration, error_info)

        # Return the final synthesis artifact (Step 4 output)
        return context.artifacts.get("synthesis")

    async def _persist_trace(self, trace_id, context, status, duration, error_info):
        """Writes the execution trace to Turso in a single transaction."""
        
        # Prepare JSON payloads
        try:
            steps_executed = json.dumps([s.step_name for s in self.steps])
            steps_details = json.dumps(context.step_durations)
            chain_artifacts = json.dumps(context.artifacts, ensure_ascii=False)
            
            # Extract final result if available
            final_result = None
            if context.artifacts.get("synthesis"):
                 # It might be a dict or string, ensure it's string for DB column
                 final_result = json.dumps(context.artifacts["synthesis"], ensure_ascii=False)
                 
        except Exception as e:
            logger.warning(f"⚠️ Failed to serialize trace artifacts: {e}")
            chain_artifacts = "{}"
            steps_details = "[]"
            final_result = None

        sql = """
            INSERT INTO chain_execution_traces (
                trace_id, symbol, date, model_id, strategy_name,
                steps_executed, steps_details, chain_artifacts,
                total_duration_ms, total_tokens, retry_count,
                final_result, status, error_step, error_reason
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """
        
        params = (
            trace_id, context.symbol, context.date, self.model_id, self.strategy_name,
            steps_executed, steps_details, chain_artifacts,
            duration, context.total_tokens, 0, # Retry count handled inside steps, total retries hard to track here globally without more logic
            final_result, status, error_info["step"], error_info["reason"]
        )
        
        # Fire and forget-ish (don't block main flow too long, but await properly)
        try:
            conn = get_connection()
            conn.execute(sql, params)
            conn.commit()
            conn.close()
            logger.info(f"💾 Trace persisted: {trace_id}")
        except Exception as e:
             logger.error(f"🔥 DB Write Failed for Trace {trace_id}: {e}")
