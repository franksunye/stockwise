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
except ImportError:
    from database import get_connection
    from logger import logger
    from engine.models.brief_strategies import StrategyFactory

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

async def fetch_news_for_stock(symbol: str, stock_name: str) -> str:
    """Fetch news using EastMoney API (Free & Real-time for CN/HK)."""
    
    def _fetch_sync():
        url = "http://search-api-web.eastmoney.com/search/jsonp"
        params = {
            "cb": "jQuery_callback",
            "param": json.dumps({
                "uid": "",
                "keyword": symbol, # Search by symbol primarily
                "type": ["cmsArticle"],
                "client": "web",
                "clientType": "web", 
                "clientVersion": "curr",
                "param": {
                    "cmsArticle": {
                        "searchScope": "default",
                        "sort": "default",
                        "pageIndex": 1,
                        "pageSize": 50, # Fetch more to filter later
                        "preTag": "",
                        "postTag": ""
                    }
                }
            })
        }
        
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            "Referer": f"https://so.eastmoney.com/news/s?keyword={symbol}"
        }

        max_retries = 3
        retry_delay = 2
        
        for attempt in range(max_retries):
            try:
                resp = requests.get(url, params=params, headers=headers, timeout=10)
                resp.raise_for_status()  # Raise on HTTP errors (4xx, 5xx)
                return resp.text
            except requests.exceptions.RequestException as e:
                if attempt < max_retries - 1:
                    wait_time = retry_delay * (2 ** attempt)
                    logger.warning(f"⚠️ [EastMoney] Attempt {attempt + 1}/{max_retries} failed for {symbol}: {e}. Retrying in {wait_time}s...")
                    import time as time_module
                    time_module.sleep(wait_time)
                else:
                    logger.error(f"❌ [EastMoney] All {max_retries} attempts failed for {symbol}: {e}")
                    return None
        return None

    # Execute request in thread pool to avoid blocking
    resp_text = await asyncio.to_thread(_fetch_sync)
    
    if not resp_text:
        return "News retrieval failed."

    # Parse JSONP
    match = re.search(r'^[^(]*\((.*)\);?$', resp_text.strip(), re.DOTALL)
    if not match:
        return "No significant news found."

    try:
        data = json.loads(match.group(1))
        # Ensure 'result' and 'cmsArticle' exist, handle None or missing keys gracefully
        result = data.get("result") or {}
        if not result:
             return "No significant news found."
             
        articles = result.get("cmsArticle", [])
        
        # Filter: Symbol OR Name in title
        # EastMoney search by 'keyword' (symbol) might return irrelevant results if we don't filter
        filter_terms = [symbol]
        if stock_name:
            filter_terms.append(stock_name)
            
        focused_articles = [
            a for a in articles
            if any(term.lower() in a.get("title", "").lower() for term in filter_terms)
        ]
        
        if not focused_articles:
             return "No significant news found directly related to this stock."

        context = []
        for a in focused_articles[:5]: # Top 5
            title = a.get('title', '').replace("<em>", "").replace("</em>", "")
            content = a.get('content', '')[:300] # EastMoney provides summary/content
            date = a.get('date', '')
            media = a.get('mediaName', 'EastMoney')
            # url = a.get('url', '') # URL not strictly present in all responses, rely on content
            
            context.append(f"- **{title}** ({date}): {content} (Source: {media})")
            
        return "\n".join(context)

    except Exception as e:
        logger.error(f"⚠️ [EastMoney] Parse failed for {symbol}: {e}")
        return f"News parsing failed: {e}"


async def analyze_stock_context(
    symbol: str, 
    stock_name: str, 
    news: str, 
    technical_data: Dict, 
    date_str: str,
    strategy_provider: str
) -> str:
    """Analyze stock using the selected Strategy."""
    
    # Init Strategy
    strategy = StrategyFactory.get_strategy(strategy_provider)
    model_id = f"brief-{strategy_provider}"
    
    # Start Trace
    recorder = DetailedTraceRecorder(symbol, date_str, model_id)
    
    # 1. Record Step: Search (Already done, but we record the input/output here)
    recorder.record_step("search", 0, {"query": "latest news"}, news)

    # 2. Prepare Prompt
    # System prompt: Role - Financial Columnist (Narrative > Data)
    system_prompt = """你是一位 StockWise 的首席财经主笔。你的目标是编写一份**通俗易懂、聚焦市场叙事**的个股日报。

核心写作原则：
1. **事实第一原则**：简报必须严格基于[第一事实：今日收盘表现]和[第二事实：今日核心新闻]进行创作。
2. **逻辑一致性**：如果[参考逻辑：AI分析师推理]中描述的内容与今日股价表现（涨跌幅）存在明显矛盾（例如：推理说暴涨，事实是微跌），请**务必以今日事实为准**，将推理视为“情绪背景”或“近期趋势参考”，严禁输出逻辑自相矛盾的内容。
3. **新闻驱动逻辑**：优先简述"发生了什么"（新闻/行业动态），以此解释股价表现。
4. **数据隐形化**：**严禁**直接罗列 RSI、KDJ、MA 等技术指标数值。用口语化描述代替，如“超买”改为“近期涨幅较大，已积累一定调整压力”。
5. **视觉优化**：必须使用 Emoji 增强可读性 (📈, 📉, ⚠️, 💡)。关键观点加粗，但严禁过度加粗。
6. **说人话**：输出专业、流畅、有温度的中文。让非专业用户也能听懂。"""
    
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
    
    user_prompt = f"""Subject: {symbol} ({stock_name})

[第一事实：今日收盘表现]
{chr(10).join(hard_data_lines)}

[第二事实：今日核心新闻]
{news}

[参考逻辑：AI 分析师推理记录（若与第一事实冲突，请以第一事实为准）]
{reasoning_section}

任务: 撰写每日简报（不要包含任何标题）。格式如下：

1. **综合分析** (约60-80字)：
   - 以今日核心新闻或行业动态开头。
   - 结合股价表现，用自然的语言描述当前趋势（基于 AI 信号和技术面）。
   - **禁止**出现具体技术指标名称和数值。

2. **核心新闻 (附出处)** (最多3条，格式：**[中文标题]**：中文摘要。[出处链接](URL))
   - **必须**将原始内容（包括英文标题和内容）翻译为流畅的中文。
   - 如果没有重大新闻，此部分显示"今日无重大公开新闻"，通过技术面形态略作补充。

输出语言：专业、流畅、有温度的中文。"""

    # 3. Execute Step: Synthesis
    start_ts = time.time()
    try:
        result = await strategy.generate_brief(system_prompt, user_prompt)
        
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
async def generate_stock_briefs_batch(date_str: str, specific_symbols: List[str] = None):
    """
    Phase 1: Analyze unique stocks and cache results in `stock_briefs`.
    """
    conn = get_connection()
    try:
        cursor = conn.cursor()
        
        # 1. Identify stocks to process
        if specific_symbols:
            # Get names for specific symbols
            placeholders = ','.join(['?' for _ in specific_symbols])
            cursor.execute(f"SELECT symbol, name FROM stock_meta WHERE symbol IN ({placeholders})", specific_symbols)
            targets = cursor.fetchall()
            target_map = {t[0]: t[1] for t in targets}
            unique_stocks = [(s, target_map.get(s, s)) for s in specific_symbols]
        else:
            # Default: Get ALL unique symbols from valid watchlists
            cursor.execute("""
                SELECT DISTINCT uw.symbol, IFNULL(sm.name, uw.symbol)
                FROM user_watchlist uw
                LEFT JOIN stock_meta sm ON uw.symbol = sm.symbol
            """)
            unique_stocks = cursor.fetchall()

        if not unique_stocks:
            logger.info("ℹ️ No stocks to analyze.")
            return

        logger.info(f"🚀 [Phase 1] Starting batch analysis for {len(unique_stocks)} unique stocks...")

        # 2. Get AI Predictions for context (use target_date, not date; filter by is_primary)
        symbols_list = [s[0] for s in unique_stocks]
        placeholders = ','.join(['?' for _ in symbols_list])
        cursor.execute(f"""
            SELECT symbol, signal, confidence, ai_reasoning, support_price, pressure_price
            FROM ai_predictions_v2
            WHERE symbol IN ({placeholders}) AND date = ? AND is_primary = 1
        """, (*symbols_list, date_str))
        predictions = {row[0]: {
            'signal': row[1], 
            'confidence': row[2],
            'ai_reasoning': row[3],
            'support_price': row[4],
            'pressure_price': row[5]
        } for row in cursor.fetchall()}

        # 2b. Get Real Technical Data from daily_prices (latest available)
        cursor.execute(f"""
            SELECT symbol, close, change_percent, rsi, kdj_k, kdj_d, kdj_j, macd, macd_signal
            FROM daily_prices
            WHERE symbol IN ({placeholders})
            AND date = (SELECT MAX(date) FROM daily_prices WHERE symbol = daily_prices.symbol)
        """, symbols_list)
        price_data = {row[0]: {
            'close': row[1],
            'change_percent': row[2],
            'rsi': row[3]
        } for row in cursor.fetchall()}

        # 3. Process each stock
        processed_count = 0
        provider = os.getenv("BRIEF_MODEL_PROVIDER", "hunyuan").lower() # Configurable provider
        
        for symbol, stock_name in unique_stocks:
            # Check cache first
            cursor.execute("SELECT 1 FROM stock_briefs WHERE symbol = ? AND date = ?", (symbol, date_str))
#            if cursor.fetchone():
#                 logger.info(f"⏭️ [Skip] {symbol} already analyzed for {date_str}.")
#                 continue

            # Fetch & Analyze
            logger.info(f"⚡ Processing {symbol} ({processed_count + 1}/{len(unique_stocks)})...")
            
            news_task = fetch_news_for_stock(symbol, stock_name)
            news = await news_task
            
            pred = predictions.get(symbol, {})
            prices = price_data.get(symbol, {})
            
            tech_data = {
                'signal': pred.get('signal', 'Side'),
                'confidence': pred.get('confidence', 0),
                'ai_reasoning': pred.get('ai_reasoning', ''),
                'support_price': pred.get('support_price'),
                'pressure_price': pred.get('pressure_price'),
                'close': prices.get('close'),
                'change_percent': prices.get('change_percent'),
            }

            analysis = await analyze_stock_context(symbol, stock_name, news, tech_data, date_str, provider)

            # Store in DB
            cursor.execute("""
                INSERT OR REPLACE INTO stock_briefs 
                (symbol, date, stock_name, analysis_markdown, raw_news, signal, confidence)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (symbol, date_str, stock_name, analysis, news, tech_data['signal'], tech_data['confidence']))
            
            conn.commit()
            processed_count += 1
        
        logger.info(f"✅ [Phase 1] Completed. Analyzed {processed_count} new stocks.")

    except Exception as e:
        logger.error(f"❌ [Phase 1] Error: {e}")
    finally:
        conn.close()


# --- Phase 2: User-Level Assembly ---
async def assemble_user_brief(user_id: str, date_str: str) -> Optional[str]:
    """
    Phase 2: Assemble personalized brief from `stock_briefs`.
    Zero LLM cost.
    """
    conn = get_connection()
    try:
        cursor = conn.cursor()
        
        # 1. Get user watchlist
        cursor.execute("SELECT symbol FROM user_watchlist WHERE user_id = ?", (user_id,))
        watchlist = [r[0] for r in cursor.fetchall()]
        
        if not watchlist:
            return None

        # 2. Fetch cached briefs
        placeholders = ','.join(['?' for _ in watchlist])
        cursor.execute(f"""
            SELECT symbol, stock_name, analysis_markdown, signal
            FROM stock_briefs
            WHERE symbol IN ({placeholders}) AND date = ?
        """, (*watchlist, date_str))
        
        stock_reports = cursor.fetchall()
        
        if not stock_reports:
            logger.warning(f"⚠️ User {user_id} has watchlist but no stock briefs found for {date_str}. Did Phase 1 run?")
            return None

        # 3. Assemble Markdown
        brief_sections = []
        brief_sections.append(f"# 📊 每日简报 - {date_str}\n")
        brief_sections.append(f"个人定制，基于您关注的 {len(watchlist)} 只股票。\n\n---\n")
        
        bullish = 0
        bearish = 0

        for symbol, name, analysis, signal in stock_reports:
            stock_name = name or symbol
            brief_sections.append(f"### {stock_name} ({symbol})")
            brief_sections.append(f"{analysis}\n\n")
            
            if signal and ('Long' in signal or 'Bullish' in signal):
                bullish += 1
            elif signal and ('Short' in signal or 'Bearish' in signal):
                bearish += 1

        timestamp = datetime.now().strftime("%H:%M")
        brief_sections.append("---\n")
        brief_sections.append(f"*StockWise AI 生成于 {timestamp}*")
        
        full_brief = "\n".join(brief_sections)
        # Intelligent Hook Generation
        bullish_stocks = []
        bearish_stocks = []
        
        for symbol, name, _, signal in stock_reports:
             s_name = name or symbol
             if signal and ('Long' in signal or 'Bullish' in signal):
                 bullish_stocks.append(s_name)
             elif signal and ('Short' in signal or 'Bearish' in signal):
                 bearish_stocks.append(s_name)
        
        if bullish_stocks:
            top_stocks = "、".join(bullish_stocks[:2])
            etc = "等" if len(bullish_stocks) > 2 else ""
            push_hook = f"📈 {top_stocks}{etc}出现看涨信号，点击查看今日 AI 复盘。"
        elif bearish_stocks:
            top_stocks = "、".join(bearish_stocks[:2])
            etc = "等" if len(bearish_stocks) > 2 else ""
            push_hook = f"⚠️ {top_stocks}{etc}面临调整压力，点击查看风险提示。"
        else:
            push_hook = f"今日复盘：{len(watchlist)} 只股票走势平稳，点击查看详情。"

        # 4. Save User Brief
        cursor.execute("""
            INSERT OR REPLACE INTO daily_briefs (user_id, date, content, push_hook)
            VALUES (?, ?, ?, ?)
        """, (user_id, date_str, full_brief, push_hook))
        conn.commit()
        
        return full_brief

    except Exception as e:
        logger.error(f"❌ [Phase 2] Error assembling brief for {user_id}: {e}")
        return None
    finally:
        conn.close()


# --- Notification Helpers ---
async def notify_user_brief_ready(user_id: str, date_str: str):
    """
    Send push notification to user immediately after their brief is ready.
    Includes idempotency protection and comprehensive error handling.
    """
    try:
        from backend.notifications import send_push_notification
    except ImportError:
        from notifications import send_push_notification
    
    conn = get_connection()
    try:
        cursor = conn.cursor()
        
        # 1. Idempotency Check: Has this user already been notified for this date?
        cursor.execute(
            "SELECT notified_at FROM daily_briefs WHERE user_id = ? AND date = ?",
            (user_id, date_str)
        )
        row = cursor.fetchone()
        
        if not row:
            logger.warning(f"⚠️ [Notify] User {user_id} has no brief for {date_str}, skipping notification")
            return
        
        if row[0]:  # notified_at is not NULL
            logger.debug(f"ℹ️ [Notify] User {user_id} already notified at {row[0]}, skipping")
            return
        
        # 2. Subscription Check: Does user have push subscription?
        cursor.execute(
            "SELECT 1 FROM push_subscriptions WHERE user_id = ? LIMIT 1",
            (user_id,)
        )
        if not cursor.fetchone():
            logger.info(f"ℹ️ [Notify] User {user_id} has no push subscription, skipping notification")
            return
        
        # 3. Get push_hook for notification body
        cursor.execute(
            "SELECT push_hook FROM daily_briefs WHERE user_id = ? AND date = ?",
            (user_id, date_str)
        )
        row = cursor.fetchone()
        push_hook = row[0] if row and row[0] else "点击查看今日 AI 复盘"
        
        # 4. Send notification (with error handling in send_push_notification itself)
        send_push_notification(
            title="📊 每日简报已生成",
            body=push_hook,
            url="/dashboard?brief=true",
            target_user_id=user_id,
            tag="daily_brief"
        )
        
        # 5. Mark as notified (idempotency protection)
        cursor.execute(
            "UPDATE daily_briefs SET notified_at = datetime('now', '+8 hours') WHERE user_id = ? AND date = ?",
            (user_id, date_str)
        )
        conn.commit()
        
        logger.info(f"✅ [Notify] User {user_id} notified for brief {date_str}")
        
    except Exception as e:
        logger.error(f"❌ [Notify] Failed to notify user {user_id}: {e}")
        # Don't raise - allow pipeline to continue for other users
    finally:
        conn.close()


# --- CLI / Orchestrator ---
async def run_daily_pipeline(date_str: str = None):
    """Run the Full Pipeline (Phase 1 + Phase 2 for all users)"""
    if not date_str:
        date_str = datetime.now().strftime("%Y-%m-%d")
    
    logger.info(f"🎬 Starting Daily Brief Pipeline for {date_str}")
    
    # 1. Phase 1: Analyze Stocks
    await generate_stock_briefs_batch(date_str)
    
    # 2. Phase 2: Assemble for ALL users
    conn = get_connection()
    try:
        cursor = conn.cursor()
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


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--user", help="Run Phase 2 for specific user only")
    parser.add_argument("--date", help="Date YYYY-MM-DD")
    parser.add_argument("--provider", help="Override LLM Provider (gemini/hunyuan)", default=None)
    args = parser.parse_args()
    
    target_date = args.date or datetime.now().strftime("%Y-%m-%d")
    
    if args.provider:
        os.environ["BRIEF_MODEL_PROVIDER"] = args.provider
    
    if args.user:
        # Test Mode: Ensure stocks for this user are analyzed, then assemble
        print(f"Testing Two-Phase Pipeline for User: {args.user}")
        
        # Optimized: Only analyze stocks for THIS user
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT symbol FROM user_watchlist WHERE user_id = ?", (args.user,))
        symbols = [r[0] for r in cursor.fetchall()]
        conn.close()
        
        if symbols:
            asyncio.run(generate_stock_briefs_batch(target_date, specific_symbols=symbols))
            asyncio.run(assemble_user_brief(args.user, target_date))
            print("\n✅ Verification Complete. Check 'daily_briefs' table.")
        else:
            print("❌ User has no watchlist.")
            
    else:
        # Production Mode: Run full pipeline
        asyncio.run(run_daily_pipeline(target_date))
