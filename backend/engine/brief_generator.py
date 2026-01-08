"""
StockWise Brief Generator Module (Two-Phase Architecture)

Phase 1: Stock-Level Analysis (Batch)
- Iterates ALL unique stocks from user watchlists.
- Fetches news (Tavily) & Analyzes (Local LLM) ONCE per stock.
- Caches result to `stock_briefs` table.

Phase 2: User-Level Assembly
- Assembles cached stock briefs into a personalized report.
- Zero LLM cost per user.
"""
import os
import sys
import asyncio
from datetime import datetime
from typing import Optional, Dict, List

# Add backend to path for standalone execution
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from openai import OpenAI
from tavily import TavilyClient

from database import get_connection
from logger import logger

# --- Configuration ---
TAVILY_API_KEY = os.getenv("TAVILY_API_KEY")
tavily_client = TavilyClient(api_key=TAVILY_API_KEY) if TAVILY_API_KEY else None

LOCAL_LLM_URL = os.getenv("GEMINI_LOCAL_BASE_URL", "http://127.0.0.1:8045")
if not LOCAL_LLM_URL.endswith("/v1"):
    LOCAL_LLM_URL = f"{LOCAL_LLM_URL}/v1"

LOCAL_LLM_KEY = os.getenv("LLM_API_KEY", "sk-stockwise")
LOCAL_LLM_MODEL = os.getenv("GEMINI_LOCAL_MODEL", "gemini-3-flash")

llm_client = OpenAI(api_key=LOCAL_LLM_KEY, base_url=LOCAL_LLM_URL)


async def fetch_news_for_stock(symbol: str, stock_name: str) -> str:
    """Fetch news using Tavily."""
    if not tavily_client:
        return "News unavailable (Config Error)."
        
    logger.info(f"🔎 [Hunter] Fetching news for {symbol} ({stock_name})...")
    try:
        query = f"latest financial news events for {symbol} ({stock_name}) stock last 24 hours earning reports regulatory changes"
        response = await asyncio.to_thread(
            tavily_client.search,
            query=query,
            search_depth="advanced",
            topic="news",
            max_results=3
        )
        
        results = response.get('results', [])
        if not results:
             return "No significant news found."

        context = []
        for result in results:
            title = result.get('title', 'No Title')
            content = result.get('content', '')[:300]
            context.append(f"- **{title}**: {content}...")
            
        return "\n".join(context)
        
    except Exception as e:
        logger.error(f"⚠️ [Hunter] Failed for {symbol}: {e}")
        return f"News retrieval failed."


async def analyze_stock_context(symbol: str, stock_name: str, news: str, technical_data: Dict) -> str:
    """Analyze stock using Local LLM (Chinese Output)."""
    logger.info(f"🧠 [Analyst] Analyzing {symbol}...")
    
    system_prompt = "You are a Senior Investment Analyst writing for a Chinese audience. Synthesize 'Hard Data' with 'News Context'. Be concise, professional, and decisive."
    
    user_prompt = f"""
    Subject: {symbol} ({stock_name})
    
    [Hard Data]
    Signal: {technical_data.get('signal')}
    Confidence: {technical_data.get('confidence')}%
    RSI: {technical_data.get('rsi')}
    
    [News Context]
    {news}
    
    Task: Write a Daily Briefing in Chinese.
    Structure:
    1. **Analysis**: One concise paragraph (approx 50 words) determining if News confirms/contradicts Technicals.
    2. **Key News**: Summarize the 1-2 most important news points from the context into Chinese bullet points.
    
    Output MUST be entirely in Chinese.
    """
    
    try:
        response = await asyncio.to_thread(
            llm_client.chat.completions.create,
            model=LOCAL_LLM_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.3,
            stream=False
        )
        return response.choices[0].message.content
    except Exception as e:
        logger.error(f"❌ [Analyst] LLM Error: {e}")
        return f"Analysis unavailable (LLM Error)."


# --- Phase 1: Stock-Level Batch Analysis ---
async def generate_stock_briefs_batch(date_str: str, specific_symbols: List[str] = None):
    """
    Phase 1: Analyze unique stocks and cache results in `stock_briefs`.
    If specific_symbols is provided, only process those (useful for on-demand).
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
            # If stock_meta missing, use symbol as name
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

        # 2. Get AI Predictions for context
        symbols_list = [s[0] for s in unique_stocks]
        placeholders = ','.join(['?' for _ in symbols_list])
        cursor.execute(f"""
            SELECT symbol, signal, confidence
            FROM ai_predictions_v2
            WHERE symbol IN ({placeholders}) AND date = ?
        """, (*symbols_list, date_str))
        predictions = {row[0]: {'signal': row[1], 'confidence': row[2]} for row in cursor.fetchall()}

        # 3. Process each stock
        processed_count = 0
        for symbol, stock_name in unique_stocks:
            # Check cache first
            cursor.execute("SELECT 1 FROM stock_briefs WHERE symbol = ? AND date = ?", (symbol, date_str))
            if cursor.fetchone():
                logger.info(f"⏭️ [Skip] {symbol} already analyzed for {date_str}.")
                continue

            # Fetch & Analyze
            logger.info(f"⚡ Processing {symbol} ({processed_count + 1}/{len(unique_stocks)})...")
            
            news = await fetch_news_for_stock(symbol, stock_name)
            
            pred = predictions.get(symbol, {})
            tech_data = {
                'signal': pred.get('signal', 'Side'),
                'confidence': pred.get('confidence', 50),
                'rsi': 50 # TODO: Fetch real RSI
            }

            analysis = await analyze_stock_context(symbol, stock_name, news, tech_data)

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
        push_hook = f"今日复盘：{bullish}只看涨，{bearish}只看跌。点击查看您的专属简报。"

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
            await assemble_user_brief(user_id, date_str)
            logger.info(f"   - Prepared brief for {user_id}")
            
    finally:
        conn.close()
    
    logger.info("🎉 Daily Pipeline Completed!")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--user", help="Run Phase 2 for specific user only")
    parser.add_argument("--date", help="Date YYYY-MM-DD")
    args = parser.parse_args()
    
    target_date = args.date or datetime.now().strftime("%Y-%m-%d")
    
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
