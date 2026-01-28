"""
StockWise Brief Generator Module (Two-Phase Architecture)
Version: 2.0 (Dual Pipeline + Trace Visualization)

Phase 1: Stock-Level Analysis (Batch)
- Iterates ALL unique stocks from user watchlists.
- Fetches news (Tavily) & Analyzes (LLM Strategy) ONCE per stock.
- Caches result to `stock_briefs` table.
- Logs FULL execution trace to `chain_execution_traces` for Admin UI visualization.

Phase 2: User-Level Assembly
- Assembles cached stock briefs into a personalized report.
- Zero LLM cost per user.
"""
import os
import sys
import asyncio
import uuid
import time
import json
from datetime import datetime
from typing import Optional, Dict, List, Any

# Add likely paths for standalone execution
current_file = os.path.abspath(__file__)
engine_dir = os.path.dirname(current_file)
backend_dir = os.path.dirname(engine_dir)
root_dir = os.path.dirname(backend_dir)
sys.path.insert(0, root_dir)
sys.path.insert(0, backend_dir)

import requests
import re


try:
    from backend.database import get_connection
    from backend.logger import logger
    from backend.engine.models.brief_strategies import StrategyFactory
    from backend.engine.context_service import ContextService
    from backend.engine.task_logger import get_task_logger
    from backend.engine.brief_prompts import BRIEF_PRO_INSTRUCTION, BRIEF_FREE_INSTRUCTION
    from backend.engine.services.news_service import fetch_news_for_stock
    from backend.engine.services.brief_assembler import assemble_user_brief, notify_user_brief_ready
except ImportError:
    from database import get_connection
    from logger import logger
    from engine.models.brief_strategies import StrategyFactory
    from engine.context_service import ContextService
    from task_logger import get_task_logger
    from engine.brief_prompts import BRIEF_PRO_INSTRUCTION, BRIEF_FREE_INSTRUCTION
    from engine.services.news_service import fetch_news_for_stock
    from engine.services.brief_assembler import assemble_user_brief, notify_user_brief_ready

# --- Tracing Helper ---
class DetailedTraceRecorder:
    """
    Records trace in the format compatible with 'chain_execution_traces'.
    Designed to mimic ChainRunner's output structure so the Frontend works out-of-the-box.
    """
    def __init__(self, symbol: str, date: str, model_id: str):
        self.trace_id = str(uuid.uuid4())
        self.symbol = symbol
        self.date = date
        self.model_id = model_id
        self.start_time = time.time()
        
        # Schema for chain_execution_traces
        self.steps_executed = [] # List[str]
        self.steps_details = []  # List[Dict] -> {step, duration_ms, tokens...}
        self.chain_artifacts = {} # Dict[str, Any]
        
        self.total_tokens = 0
        self.error = None

    def record_step(self, step_name: str, duration_ms: int, input_data: Any, output_data: Any, meta: Dict = None):
        """Record a step completion."""
        self.steps_executed.append(step_name)
        
        # 1. Detail Metrics
        step_meta = {
            "step": step_name,
            "duration_ms": duration_ms,
            "status": "success",
            "input_preview": str(input_data)[:50] if input_data else "",
            "output_preview": str(output_data)[:50] if output_data else ""
        }
        if meta:
            step_meta.update(meta)
            self.total_tokens += meta.get("total_tokens", 0)
            
        self.steps_details.append(step_meta)
        
        # 2. Artifacts (Full Payload)
        # Store prompt if available
        if isinstance(input_data, dict) and 'prompt' in input_data:
             self.chain_artifacts[f"{step_name}_prompt"] = input_data['prompt']
        elif isinstance(input_data, str):
             self.chain_artifacts[f"{step_name}_prompt"] = input_data
             
        # Store output
        self.chain_artifacts[step_name] = output_data
        # Legacy/Compatibility field for raw text
        if isinstance(output_data, str):
            self.chain_artifacts[f"{step_name}_raw"] = output_data

    def fail(self, step_name: str, error_msg: str):
        self.error = (step_name, error_msg)
        
    def save(self):
        """Save to DB."""
        duration_ms = int((time.time() - self.start_time) * 1000)
        status = 'failed' if self.error else 'success'
        error_step = self.error[0] if self.error else None
        error_reason = self.error[1] if self.error else None
        
        conn = get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO chain_execution_traces 
                (trace_id, symbol, date, model_id, strategy_name, steps_executed, steps_details, 
                 chain_artifacts, total_duration_ms, total_tokens, status, error_step, error_reason)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                self.trace_id, self.symbol, self.date, self.model_id, 
                "daily_brief", # Fixed strategy name for filtering
                json.dumps(self.steps_executed),
                json.dumps(self.steps_details),
                json.dumps(self.chain_artifacts, ensure_ascii=False),
                duration_ms, self.total_tokens, status, error_step, error_reason
            ))
            conn.commit()
            logger.debug(f"📝 [Trace] Saved chain trace {self.trace_id} for {self.symbol}")
        except Exception as e:
            logger.error(f"❌ Failed to save trace: {e}")
        finally:
            conn.close()

# --- Logic Impl ---

# fetch_news_for_stock moved to services/news_service.py


async def analyze_stock_context(
    symbol: str, 
    stock_name: str, 
    news: str, 
    technical_data: Dict, 
    date_str: str,
    tier: str = "free",
    facts: Dict = None
) -> str:
    """Analyze stock using the selected Strategy for a specific tier."""
    
    # Init Strategy for the tier
    strategy = StrategyFactory.get_strategy_for_tier(tier)
    provider = StrategyFactory.get_provider_for_tier(tier)
    model_id = f"brief-{tier}"
    
    # Start Trace
    recorder = DetailedTraceRecorder(symbol, date_str, model_id)
    
    # 1. Record Step: Search
    recorder.record_step("search", 0, {"query": "latest news", "tier": tier}, news)

    # 2. Prepare User Prompt (Data remains the same, but strategy decides the personality)
    # Build data description (with citation sources)
    signal = technical_data.get('signal', 'Side')
    confidence = technical_data.get('confidence', 0)
    conf_pct = int(confidence * 100) if confidence <= 1 else int(confidence)
    
    hard_data_lines = [
        f"- AI 信号: {signal} (置信度 {conf_pct}%) [来源: StockWise AI]",
    ]
    
    if technical_data.get('close'):
        change = technical_data.get('change_percent', 0)
        change_str = f"+{change:.2f}%" if change >= 0 else f"{change:.2f}%"
        hard_data_lines.append(f"- 今日收盘: {technical_data['close']:.2f} ({change_str}) [来源: AkShare]")
    
    # Key levels
    support = technical_data.get('support_price')
    pressure = technical_data.get('pressure_price')
    levels = []
    if support: levels.append(f"支撑位 {support:.2f}")
    if pressure: levels.append(f"压力位 {pressure:.2f}")
    if levels: hard_data_lines.append(f"- 关键价位: {' | '.join(levels)} [来源: StockWise AI]")
    
    # AI Reasoning section
    ai_reasoning = technical_data.get('ai_reasoning', '')
    reasoning_section = ai_reasoning[:500] if ai_reasoning else "（无分析师推理记录）"
    
    # [World Class] Facts are now passed from outside, or fallback to Service
    if facts is None:
        ctx_service = ContextService()
        facts = await ctx_service.get_comprehensive_context(symbol, date_str, stock_name)
    
    deep_facts = []
    if facts.get("market_mood"): 
        deep_facts.append(f"- 市场大环境: {facts['market_mood']}")
    
    # Altitude Context
    alt = facts.get("altitude", {})
    if alt.get("year_stats"): deep_facts.append(f"- 长线战略水位: {alt['year_stats']}")
    if alt.get("month_stats"): deep_facts.append(f"- 短线战术水位: {alt['month_stats']}")
    
    # Volume Context
    if facts.get("volume_status"): deep_facts.append(f"- 量能状态: {facts['volume_status']}")

    deep_facts_str = chr(10).join(deep_facts) if deep_facts else "（暂无多周期回溯数据）"
    
    # 4. Reflection Data (Yesterday's performance)
    reflection = technical_data.get('reflection', {})
    prev_sig = reflection.get('prev_signal')
    prev_status = reflection.get('prev_status', 'Pending')
    prev_change = reflection.get('prev_change')
    
    refl_msg = "（昨日无预测记录或尚未验证）"
    if prev_sig:
        change_text = f"{prev_change:+.2f}%" if prev_change is not None else "未知"
        refl_msg = f"- 昨日预测信号: {prev_sig}\n- 验证结果: {prev_status} (实际涨跌: {change_text})"

    today_date = date_str  # Use passed date_str
    
    # 5. Construct User Prompt based on Tier (Instructions now imported from brief_prompts.py)
    task_instruction = BRIEF_PRO_INSTRUCTION if tier == 'pro' else BRIEF_FREE_INSTRUCTION

    user_prompt = f"""Subject: {symbol} ({stock_name})

[第一事实：今日收盘表现]
{chr(10).join(hard_data_lines)}

[第二事实：今日核心新闻]
{news}

[第三事实：多周期与大盘背景]
{deep_facts_str}

[第四事实：昨日预测复盘]
{refl_msg}

[参考逻辑：AI 分析师推理记录（若与第一事实冲突，请以第一事实为准）]
{reasoning_section}

{task_instruction}

输出语言：专业、流畅、有温度的中文。"""

    # 3. Execute Step: Synthesis
    start_ts = time.time()
    try:
        # Get system prompt from strategy (Tier-specific)
        system_prompt = strategy.get_system_prompt()
        
        result = await strategy.generate_brief(user_prompt)
        
        duration = int((time.time() - start_ts) * 1000)
        content = result["content"]
        
        # Record success
        recorder.record_step("synthesis", duration, 
                             {"prompt": user_prompt, "system": system_prompt}, 
                             content, 
                             meta=result["usage"])
        
        recorder.save()
        return content
        
    except Exception as e:
        duration = int((time.time() - start_ts) * 1000)
        logger.error(f"❌ Brief Generation Failed: {e}")
        recorder.fail("synthesis", str(e))
        recorder.save()
        return "Brief generation failed."


# --- Phase 1: Stock-Level Batch Analysis ---
async def generate_stock_briefs_batch(date_str: str, specific_symbols: List[str] = None, force: bool = False, target_tier: str = None):
    """
    Phase 1: Analyze unique stocks and cache results in `stock_briefs`.
    If target_tier is specified, only processes stocks and generates briefs for that tier.
    """
    conn = get_connection()
    try:
        cursor = conn.cursor()
        
        # 1. Identify stocks to process
        if specific_symbols:
            # Manual override: Assume these need the target_tier (or both if none)
            placeholders = ','.join(['?' for _ in specific_symbols])
            cursor.execute(f"SELECT symbol, name FROM stock_meta WHERE symbol IN ({placeholders})", specific_symbols)
            targets = cursor.fetchall()
            target_map = {t[0]: t[1] for t in targets}
            # For manual symbols, we treat them as "watched" by the requested tier
            unique_stocks = [(s, target_map.get(s, s), True if target_tier == "pro" or not target_tier else False) for s in specific_symbols]
        else:
            # Default: Get symbols based on requested tier
            if target_tier == "pro":
                logger.info("🎯 Mode: PRO Tier Only (Filtering for PRO user stocks)")
                cursor.execute("""
                    SELECT DISTINCT uw.symbol, IFNULL(sm.name, uw.symbol)
                    FROM user_watchlist uw
                    JOIN users u ON uw.user_id = u.user_id
                    LEFT JOIN stock_meta sm ON uw.symbol = sm.symbol
                    WHERE u.subscription_tier = 'pro'
                """)
                unique_stocks = [(row[0], row[1], True) for row in cursor.fetchall()]
            elif target_tier == "free":
                logger.info("🎯 Mode: FREE Tier Only")
                cursor.execute("""
                    SELECT DISTINCT uw.symbol, IFNULL(sm.name, uw.symbol)
                    FROM user_watchlist uw
                    JOIN users u ON uw.user_id = u.user_id
                    LEFT JOIN stock_meta sm ON uw.symbol = sm.symbol
                    WHERE u.subscription_tier = 'free'
                """)
                unique_stocks = [(row[0], row[1], False) for row in cursor.fetchall()]
            else:
                # Full Mode: Existing logic to tag is_pro_watched
                cursor.execute("""
                    SELECT 
                        uw.symbol, 
                        IFNULL(sm.name, uw.symbol),
                        MAX(CASE WHEN u.subscription_tier = 'pro' THEN 1 ELSE 0 END) as is_pro_watched
                    FROM user_watchlist uw
                    LEFT JOIN stock_meta sm ON uw.symbol = sm.symbol
                    LEFT JOIN users u ON uw.user_id = u.user_id
                    GROUP BY uw.symbol
                """)
                unique_stocks = [(row[0], row[1], bool(row[2])) for row in cursor.fetchall()]

        if not unique_stocks:
            logger.info("ℹ️ No stocks to analyze.")
            return

        logger.info(f"🚀 [Phase 1] Starting batch analysis for {len(unique_stocks)} unique stocks...")

        # 2. Get AI Predictions & Technical Facts using World-Class ContextService
        ctx_service = ContextService()
        symbols_list = [s[0] for s in unique_stocks]
        
        predictions = await ctx_service.get_batch_predictions_and_reflection(symbols_list, date_str)
        price_data = await ctx_service.get_batch_technical_facts(symbols_list)

        # 3. Process each stock (generate briefs for each tier)
        from engine.models.brief_strategies import SUPPORTED_TIERS, TIER_PROVIDER_MAP
        
        processed_count = 0
        
        for symbol, stock_name, is_pro_watched in unique_stocks:
            # Fetch news once (shared across tiers)
            logger.info(f"⚡ Processing {symbol} ({processed_count + 1}/{len(unique_stocks)})...")
            
            # Step A: Enrichment - Get comprehensive facts (including altitude, volume, etc.)
            facts = await ctx_service.get_comprehensive_context(symbol, date_str, stock_name)
            
            # Step B: News Fetching
            news_task = fetch_news_for_stock(symbol, stock_name, date_str)
            news = await news_task
            
            # Step C: Prepare data for synthesis
            pred = predictions.get(symbol, {})
            prices = price_data.get(symbol, {})
            
            tech_data = {
                'signal': pred.get('signal', 'Side'),
                'confidence': pred.get('confidence', 0),
                'ai_reasoning': pred.get('reasoning', ''),
                'support_price': pred.get('support'),
                'pressure_price': pred.get('pressure'),
                'close': prices.get('close'),
                'change_percent': prices.get('change'),
                'reflection': pred.get('reflection', {}),
            }

            # Determine which tiers to generate for this stock
            tiers_to_run = [target_tier] if target_tier else SUPPORTED_TIERS
            
            for tier in tiers_to_run:
                # [Filter] Non-PRO stocks don't get PRO briefs in Full Mode
                if not target_tier and tier == "pro" and not is_pro_watched:
                    continue
                
                # [Optimization] Skip based on User Tier demand
                if tier == "free" and os.getenv("BRIEF_SKIP_FREE", "false").lower() == "true":
                    logger.debug(f"⏭️ [System] Skipping FREE tier analysis as requested.")
                    continue

                # Check if exists (idempotency)
                if not force:
                    cursor.execute("SELECT 1 FROM stock_briefs WHERE symbol = ? AND date = ? AND tier = ?", 
                                  (symbol, date_str, tier))
                    if cursor.fetchone():
                        logger.debug(f"⏭️ [Skip] {symbol}/{tier} already analyzed for {date_str}.")
                        continue
                
                provider = TIER_PROVIDER_MAP[tier]
                logger.info(f"   📝 Generating {tier.upper()} brief using {provider}...")
                
                analysis = None
                max_retries = 3
                for attempt in range(max_retries):
                    try:
                        # Call synthesis with rich facts
                        analysis = await analyze_stock_context(symbol, stock_name, news, tech_data, date_str, tier, facts=facts)
                        if analysis:
                            break
                    except Exception as e:
                        if "429" in str(e) or "rate limit" in str(e).lower():
                            wait_time = (attempt + 1) * 5
                            logger.warning(f"⚠️  Rate limit (429) hit. Waiting {wait_time}s...")
                            await asyncio.sleep(wait_time)
                        else:
                            logger.error(f"❌ [Attempt {attempt+1}] Error: {e}")
                            await asyncio.sleep(2)
                
                if analysis:
                    cursor.execute("""
                        INSERT OR REPLACE INTO stock_briefs 
                        (symbol, date, tier, stock_name, analysis_markdown, raw_news, signal, confidence)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """, (symbol, date_str, tier, stock_name, analysis, news, tech_data['signal'], tech_data['confidence']))
                    conn.commit()
            
            processed_count += 1
        
        logger.info(f"✅ [Phase 1] Completed. Analyzed {processed_count} stocks.")

    except Exception as e:
        logger.error(f"❌ [Phase 1] Error: {e}")
    finally:
        conn.close()


# Phase 2 and Notification moved to services/brief_assembler.py


# --- CLI / Orchestrator ---
async def run_daily_pipeline(date_str: str = None, force: bool = False, target_tier: str = None):
    """Run the Full Pipeline (Phase 1 + Phase 2 for all users)"""
    if not date_str:
        date_str = datetime.now().strftime("%Y-%m-%d")
    
    tier_info = f" ({target_tier} only)" if target_tier else ""
    logger.info(f"🎬 Starting Daily Brief Pipeline for {date_str}{tier_info} (Force={force})")
    
    t_logger = get_task_logger("news_desk", "brief_gen")
    t_logger.start(f"Daily Briefing{tier_info}", "delivery", dimensions={"tier": target_tier or "all"})

    try:
        # 1. Phase 1: Analyze Stocks
        await generate_stock_briefs_batch(date_str, force=force, target_tier=target_tier)
    
        # 2. Phase 2: Assemble for relevant users
        conn = get_connection()
        try:
            cursor = conn.cursor()
            # If target_tier is set, only process users of that tier
            if target_tier:
                cursor.execute("SELECT DISTINCT u.user_id FROM users u JOIN user_watchlist w ON u.user_id = w.user_id WHERE u.subscription_tier = ?", (target_tier,))
            else:
                cursor.execute("SELECT DISTINCT user_id FROM user_watchlist")
            
            users = [r[0] for r in cursor.fetchall()]
            
            logger.info(f"👥 [Phase 2] Assembling briefs for {len(users)} users...")
            for user_id in users:
                try:
                    await assemble_user_brief(user_id, date_str)
                    logger.info(f"   - Prepared brief for {user_id}")
                    
                    # [NEW] Notify user immediately after their brief is ready
                    await notify_user_brief_ready(user_id, date_str)
                    
                except Exception as e:
                    logger.error(f"❌ [Phase 2] Failed to process user {user_id}: {e}")
                    # Continue with next user
                    continue
                
        finally:
            conn.close()
        
        # 3. Notification Phase Decoupled
        # Individual notifications are now sent immediately in Phase 2 loop.
        # The old batch notification function (send_personalized_daily_report) is deprecated.
        
        logger.info("🎉 Daily Pipeline Completed! Check 'daily_briefs' table.")
        t_logger.success("Completed summary assembly and push broadcast.")
    except Exception as e:
        logger.error(f"❌ [Pipeline] Full pipeline failed: {e}")
        t_logger.fail(f"Pipeline failed: {str(e)}")
        raise e


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--user", help="Run Phase 2 for specific user only")
    parser.add_argument("--date", help="Date YYYY-MM-DD")
    parser.add_argument("--provider", help="Override LLM Provider (gemini/hunyuan)", default=None)
    parser.add_argument("--force", action="store_true", help="Force re-generation of briefs")
    parser.add_argument("--symbols", help="Comma-separated list of symbols to process (e.g. 00700,02171)")
    parser.add_argument("--tier", choices=["free", "pro"], help="Run for specific tier only")
    args = parser.parse_args()
    
    target_date = args.date or datetime.now().strftime("%Y-%m-%d")
    
    if args.provider:
        os.environ["BRIEF_MODEL_PROVIDER"] = args.provider
    
    if args.user:
        # Test Mode: Ensure stocks for this user are analyzed, then assemble
        print(f"Testing Two-Phase Pipeline for User: {args.user}")
        
        # Determine which symbols to analyze
        if args.symbols:
            symbols = [s.strip() for s in args.symbols.split(",")]
        else:
            conn = get_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT symbol FROM user_watchlist WHERE user_id = ?", (args.user,))
            symbols = [r[0] for r in cursor.fetchall()]
            conn.close()
        
        if symbols:
            asyncio.run(generate_stock_briefs_batch(target_date, specific_symbols=symbols, force=args.force, target_tier=args.tier))
            asyncio.run(assemble_user_brief(args.user, target_date))
            print("\n✅ Verification Complete. Check 'daily_briefs' table.")
        else:
            print("❌ No symbols to process for this user.")
            
    else:
        # Production Mode: Run full pipeline
        # If --symbols is passed in production mode, it only runs Phase 1 for those symbols
        target_symbols = [s.strip() for s in args.symbols.split(",")] if args.symbols else None
        if target_symbols:
            print(f"Running targeted analysis for symbols: {target_symbols}")
            asyncio.run(generate_stock_briefs_batch(target_date, specific_symbols=target_symbols, force=args.force, target_tier=args.tier))
        else:
            asyncio.run(run_daily_pipeline(target_date, force=args.force, target_tier=args.tier))
