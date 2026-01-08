import os
import sys
import json
import asyncio
from dotenv import load_dotenv

# Add backend to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Load env configuration
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env'))

# --- Configuration ---
# 1. Search Provider: Tavily
TAVILY_API_KEY = os.getenv("TAVILY_API_KEY")
if not TAVILY_API_KEY:
    print("⚠️  Warning: TAVILY_API_KEY not found in .env. Please add it to run Step 1.")

# 2. Analyst Provider: Local LLM (Gemini via OpenAI Protocol)
LOCAL_LLM_URL = os.getenv("GEMINI_LOCAL_BASE_URL", "http://127.0.0.1:8045")
LOCAL_LLM_KEY = os.getenv("LLM_API_KEY", "sk-test")
LOCAL_LLM_MODEL = os.getenv("GEMINI_LOCAL_MODEL", "gemini-2.0-flash-exp")

print(f"⚙️  Config:")
print(f"   - Search: Tavily (Key: {'Found' if TAVILY_API_KEY else 'Missing'})")
print(f"   - Analyst: Local LLM ({LOCAL_LLM_MODEL} @ {LOCAL_LLM_URL})")

# Imports
try:
    from tavily import TavilyClient
    from openai import OpenAI
except ImportError:
    print("❌ Libraries missing. Run: pip install tavily-python openai")
    sys.exit(1)

# Initialize Clients
tavily = TavilyClient(api_key=TAVILY_API_KEY) if TAVILY_API_KEY else None

# Ensure base_url has /v1 for OpenAI client
if not LOCAL_LLM_URL.endswith("/v1"):
    LOCAL_LLM_URL = f"{LOCAL_LLM_URL}/v1"

local_llm = OpenAI(api_key=LOCAL_LLM_KEY, base_url=LOCAL_LLM_URL)


async def step_1_the_hunter(symbol: str):
    """
    Role: News Hunter (Tavily)
    Fetches news and context using Tavily Search API.
    """
    print(f"\n🔎 [The Hunter] Scanning news for {symbol} using Tavily...")
    
    if not tavily:
        return "❌ Simulation: Tavily API Key missing. Cannot fetch real news."
    
    try:
        # Search query focused on recent financial news
        query = f"latest financial news events for {symbol} stock last 24 hours earning reports regulatory changes"
        
        # Tavily Search
        response = tavily.search(
            query=query,
            search_depth="advanced", # "basic" or "advanced"
            topic="news",            # Optimized for news
            max_results=5,
            include_domains=None,
            exclude_domains=None
        )
        
        # Format results
        context = []
        print(f"   - Found {len(response.get('results', []))} articles.")
        
        for result in response.get('results', []):
            title = result.get('title', 'No Title')
            url = result.get('url', '#')
            content = result.get('content', '')[:300] # Snippet
            context.append(f"- [{title}]({url}): {content}...")
            
        return "\n".join(context)
        
    except Exception as e:
        print(f"⚠️ [The Hunter] Tavily Search Failed: {e}")
        return f"Error fetching news: {e}"


async def step_2_the_analyst(symbol: str, news_summary: str, hard_facts: dict):
    """
    Role: The Analyst (Local LLM)
    Synthesizes hard data with news context.
    """
    print(f"\n🧠 [The Analyst] Analyzing context for {symbol} using Local LLM...")
    
    system_prompt = "You are a Senior Investment Analyst. Synthesize 'Hard Data' with 'News Context'. Be concise and professional."
    user_prompt = f"""
    Subject: {symbol}
    
    [Hard Data]
    Price: {hard_facts.get('price')}
    Change: {hard_facts.get('change')}
    RSI: {hard_facts.get('rsi')}
    Signal: {hard_facts.get('signal')}
    
    [News Context]
    {news_summary}
    
    Task: Write a concise Daily Briefing (max 50 words) determining if the News confirms or contradicts the Technical Signal.
    """
    
    try:
        response = local_llm.chat.completions.create(
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
        print(f"❌ [The Analyst] Local LLM Error: {e}")
        return "Analysis failed due to LLM error."


async def main():
    target_symbol = "00700.HK (Tencent)"
    
    # Mock Hard Facts (Technicals)
    hard_facts = {
        "price": "402.00 HKD",
        "change": "+3.2%",
        "rsi": 78.5,
        "signal": "Bearish (Overbought)" 
    }
    
    # 1. Hunter (Tavily)
    news = await step_1_the_hunter(target_symbol)
    print(f"\n📄 [News Report]:\n{news}")
    
    # 2. Analyst (Local LLM)
    brief = await step_2_the_analyst(target_symbol, news, hard_facts)
    
    print(f"\n🚀 [FINAL DAILY BRIEF]:\n{'-'*30}\n{brief}\n{'-'*30}")


if __name__ == "__main__":
    asyncio.run(main())
