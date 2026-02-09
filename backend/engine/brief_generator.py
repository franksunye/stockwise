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
try:
    from backend.config import BEIJING_TZ
except ImportError:
    from config import BEIJING_TZ
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

    from backend.engine.services.news_service import fetch_news_for_stock
    from backend.engine.services.brief_assembler import assemble_user_brief, notify_user_brief_ready
except ImportError:
    from database import get_connection
    from logger import logger
    from engine.models.brief_strategies import StrategyFactory
    from engine.context_service import ContextService
    from task_logger import get_task_logger

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
    reasoning_section = ai_reasoning if ai_reasoning else "（无分析师推理记录）"
    
    # [World Class] Facts are now passed from outside, or fallback to Service
    if facts is None:
        ctx_service = ContextService()
        facts = await ctx_service.get_comprehensive_context(symbol, date_str, stock_name)
    
    deep_facts = []
    if facts.get("market_context"): 
        deep_facts.append(f"- 市场大环境: {facts['market_context']}")
    
    # Altitude Context
    alt = facts.get("price_altitude", {})
    if alt.get("long_term_250d"): deep_facts.append(f"- 长线战略水位: {alt['long_term_250d']}")
    if alt.get("short_term_20d"): deep_facts.append(f"- 短线战术水位: {alt['short_term_20d']}")
    
    # Volume Context
    if facts.get("volume_status"): deep_facts.append(f"- 量能状态: {facts['volume_status']}")

    deep_facts_str = chr(10).join(deep_facts) if deep_facts else "（暂无多周期回溯数据）"
    
    # 4. Reflection Data (Historical Performance Review)
    reflection = technical_data.get('reflection', {})
    history = reflection.get('history', [])
    
    refl_msg = "（近期无预测记录或尚未验证）"
    if history:
        history_items = []
        # Today's actual range for precision check
        curr_high = technical_data.get('high')
        curr_low = technical_data.get('low')
        
        for i, p in enumerate(history):
            sig_cn = {"Long": "做多", "Side": "观望", "Short": "避险"}.get(p['signal'], p['signal'])
            status_icon = "✅" if p['status'] == "Correct" else ("❌" if p['status'] == "Incorrect" else "➖")
            change_text = f"{p['change']:+.2f}%" if p['change'] is not None else "待验证"
            
            # Model name cleanup
            model_tag = p.get('model_id', '').split('-')[0].capitalize()
            
            # Precision level check for ALL history items (a level from 2 days ago might hit today)
            precision_note = ""
            if curr_low and p.get('support'):
                diff_pct = abs(curr_low - p['support']) / p['support']
                if diff_pct < 0.005: 
                    precision_note = f" [🎯 精准支撑: 预判{p['support']:.2f} vs 今日实际最低{curr_low:.2f}]"
                elif curr_low >= p['support'] and curr_low <= p['support'] * 1.01:
                    precision_note = f" [🛡️ 支撑有效: 今日最低{curr_low:.2f} 守住 {p['support']:.2f}]"

            if curr_high and p.get('pressure'):
                diff_pct_hi = abs(curr_high - p['pressure']) / p['pressure']
                if diff_pct_hi < 0.005:
                    precision_note += f" [🎯 精准压力: 预判{p['pressure']:.2f} vs 今日实际最高{curr_high:.2f}]"

            history_items.append(f"- {p['date']} ({model_tag}) 预判: {sig_cn} {status_icon} (验证涨跌 {change_text}){precision_note}")
        refl_msg = "\n".join(history_items)

    today_date = date_str  # Use passed date_str
    
    today_date = date_str  # Use passed date_str
    
    # 5. Construct User Prompt via Jinja2 Template
    from backend.templating import render_template
    try:
        user_prompt = render_template('prompts/briefs/user.j2',
            symbol=symbol,
            stock_name=stock_name,
            signal=signal,
            confidence=conf_pct,
            close=technical_data.get('close'),
            change_str=f"+{(technical_data.get('change_percent') or 0.0):.2f}%" if (technical_data.get('change_percent') or 0.0) >= 0 else f"{(technical_data.get('change_percent') or 0.0):.2f}%",
            levels=levels,
            news=news,
            deep_facts=deep_facts_str,
            reflection=refl_msg,
            reasoning=reasoning_section,
            tier=tier
        )
    except Exception as e:
        logger.error(f"Failed to render brief user prompt: {e}")
        return "Prompt rendering failed."

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
        name_map = {s[0]: s[1] for s in unique_stocks}
        
        predictions = await ctx_service.get_batch_predictions_and_reflection(symbols_list, date_str)
        price_data = await ctx_service.get_batch_technical_facts(symbols_list)
        
        # [Optimization] Batch fetch comprehensive context (altitude, volume, market mood)
        all_facts = await ctx_service.get_batch_comprehensive_context(symbols_list, date_str, name_map=name_map)

        # [NEW] Pre-fetch all news in parallel with controlled concurrency (Semaphore 10)
        logger.info(f"📰 Pre-fetching news for {len(unique_stocks)} stocks (Parallel=10)...")
        news_semaphore = asyncio.Semaphore(10)
        
        async def fetch_with_sem(s_id, s_name):
            async with news_semaphore:
                return s_id, await fetch_news_for_stock(s_id, s_name, date_str)
        
        news_tasks = [fetch_with_sem(s[0], s[1]) for s in unique_stocks]
        news_results = await asyncio.gather(*news_tasks)
        news_cache = {s_id: content for s_id, content in news_results}

        # 3. Process each stock (generate briefs for each tier)
        from engine.models.brief_strategies import SUPPORTED_TIERS, TIER_PROVIDER_MAP
        
        processed_count = 0
        
        for symbol, stock_name, is_pro_watched in unique_stocks:
            try:
                # Fetch news from cache
                logger.info(f"⚡ Processing {symbol} ({processed_count + 1}/{len(unique_stocks)})...")
                
                # Step A: Enrichment - Use pre-fetched context
                facts = all_facts.get(symbol, {})
                
                # Step B: News Fetching (From Cache)
                news = news_cache.get(symbol, "News retrieval failed or not found.")
                
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
                    'high': prices.get('high'),
                    'low': prices.get('low'),
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
                                logger.error(f"❌ [Attempt {attempt+1}] Synthesis Error: {e}")
                                await asyncio.sleep(2)
                    
                    if analysis:
                        cursor.execute("""
                            INSERT OR REPLACE INTO stock_briefs 
                            (symbol, date, tier, stock_name, analysis_markdown, raw_news, signal, confidence)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        """, (symbol, date_str, tier, stock_name, analysis, news, tech_data['signal'], tech_data['confidence']))
                        conn.commit()
                
                processed_count += 1
            except Exception as e:
                logger.error(f"❌ [Phase 1] Critical error processing {symbol}: {e}")
                # We do NOT commit the partial transaction for this stock but continue to others
                continue
        
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
            success_users = 0
            failed_users = 0
            
            for user_id in users:
                try:
                    await assemble_user_brief(user_id, date_str)
                    logger.info(f"   - Prepared brief for {user_id}")
                    
                    # [NEW] Notify user immediately after their brief is ready
                    await notify_user_brief_ready(user_id, date_str)
                    success_users += 1
                    
                except Exception as e:
                    logger.error(f"❌ [Phase 2] Failed to process user {user_id}: {e}")
                    failed_users += 1
                    # Continue with next user
                    continue
                
        finally:
            conn.close()
        
        # 3. Notification Phase Decoupled
        # Individual notifications are now sent immediately in Phase 2 loop.
        # The old batch notification function (send_personalized_daily_report) is deprecated.
        
        logger.info("🎉 Daily Pipeline Completed! Check 'daily_briefs' table.")
        
        status = "✅ SUCCESS" if failed_users == 0 else "⚠️ PARTIAL" if success_users > 0 else "❌ FAILED"
        
        report = f"### 📰 StockWise: Daily Brief Gen{tier_info}\n"
        report += f"> **Status**: {status}\n"
        report += f"- **Users**: {len(users)}\n"
        report += f"- **Success**: {success_users} users\n"
        
        if failed_users > 0:
            report += f"- **Failed**: {failed_users} users\n"
            
        t_logger.success(f"Pipeline finished: {success_users}/{len(users)} users generated.")
        
        # Manually send report via wecom as t_logger might only log task outcome
        from utils import send_wecom_notification
        send_wecom_notification(report)
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
    
    target_date = args.date or datetime.now(BEIJING_TZ).strftime("%Y-%m-%d")
    
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
