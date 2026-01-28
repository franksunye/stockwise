import asyncio
import json
import re
import requests
from datetime import datetime
from typing import Optional

try:
    from backend.logger import logger
except ImportError:
    try:
        from logger import logger
    except ImportError:
        import logging
        logger = logging.getLogger(__name__)

async def fetch_news_for_stock(symbol: str, stock_name: str, target_date: str = None) -> str:
    """Fetch news using EastMoney API (Free & Real-time for CN/HK) and filter by date if provided."""
    
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
        try:
            target_dt = datetime.strptime(target_date, "%Y-%m-%d") if target_date else None
        except Exception:
            target_dt = None

        for a in focused_articles:
            # Date filter: Allow news within past 3 days of target_date
            a_date = a.get('date', '')
            
            if target_dt and a_date:
                try:
                    # News date format is usually 'YYYY-MM-DD HH:MM:SS'
                    news_dt = datetime.strptime(a_date[:10], "%Y-%m-%d")
                    days_diff = (target_dt - news_dt).days
                    
                    if days_diff < 0 or days_diff > 5: # Allow today and past 5 days (covers full weekends)
                        continue
                except Exception:
                    # If date parsing fails, fallback to strict match or ignore if unknown
                    if not a_date.startswith(target_date):
                        continue
            elif target_date and not a_date.startswith(target_date):
                continue
                
            title = a.get('title', '').replace("<em>", "").replace("</em>", "")
            content = a.get('content', '')[:300] 
            date = a_date
            media = a.get('mediaName', 'EastMoney')
            
            context.append(f"- **{title}** ({date}): {content} (Source: {media})")
            
            if len(context) >= 5: # Limit to 5 strictly valid news
                break
            
        if not context:
            return "No recent news found (Date mismatch or no significant updates today)."
            
        return "\n".join(context)

    except Exception as e:
        logger.error(f"⚠️ [EastMoney] Parse failed for {symbol}: {e}")
        return f"News parsing failed: {e}"
