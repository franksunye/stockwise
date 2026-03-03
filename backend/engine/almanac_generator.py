import sqlite3
import json
import traceback
import sys
import os
import argparse
import uuid
from datetime import datetime, timedelta

# --- Time-awareness constants ---
# Nasdaq data freshness window (Beijing Time):
#   US markets close at 4:00 PM ET â‰ˆ 5:00 AM Beijing (winter) / 4:00 AM (summer).
#   A-share markets close at 15:00 Beijing.
#
#   Valid "overnight" window: 05:00 â€“ 15:00 Beijing
#     - After 05:00 AM: US just closed, Nasdaq data is the freshest "overnight" close.
#     - Before 15:00 PM: The data is still relevant for today's A-share session.
#     - After 15:00 PM: A-share closed; tonight's US session hasn't started yet.
#       The Nasdaq data in AkShare is from LAST NIGHT, stale for T+1 prediction.
#     - 00:00 â€“ 05:00 AM: US may still be trading, data is incomplete/stale.
NASDAQ_FRESH_START_HOUR = 5   # 05:00 Beijing = US market close
NASDAQ_FRESH_END_HOUR = 15    # 15:00 Beijing = A-share market close

# --- Path Management ---
current_file = os.path.abspath(__file__)
engine_dir = os.path.dirname(current_file)
backend_dir = os.path.dirname(engine_dir)
root_dir = os.path.dirname(backend_dir)

# Add both root and backend to sys.path for flexible importing
for d in [root_dir, backend_dir]:
    if d not in sys.path:
        sys.path.insert(0, d)

# Standardize Imports
try:
    from backend.database import get_connection
    from backend.logger import logger
    from backend.context.provider import MarketContextProvider
    from backend.engine.market_facts_service import get_or_generate_market_facts
    from backend.config import BEIJING_TZ, ADMIN_MOBILES
    from backend.utils import send_wecom_notification
except ImportError:
    # Fallback for environments where the 'backend' prefix might fail
    from database import get_connection
    from logger import logger
    from provider import MarketContextProvider
    from market_facts_service import get_or_generate_market_facts
    from config import BEIJING_TZ, ADMIN_MOBILES
    from utils import send_wecom_notification

def get_next_trading_day(current_date_str: str, cursor: sqlite3.Cursor) -> str:
    """
    Calculates the next business day for the A-share market.
    Skips weekends (Sat/Sun) and explicit holidays stored in the DB.
    
    :param current_date_str: Starting date in YYYY-MM-DD format.
    :param cursor: Active SQLite database cursor.
    :return: The next trading date string (YYYY-MM-DD).
    """
    current_date = datetime.strptime(current_date_str, "%Y-%m-%d")
    next_day = current_date + timedelta(days=1)
    
    while True:
        # 1. Skip Weekends (Standard)
        if next_day.weekday() >= 5: # Sat=5, Sun=6
            next_day += timedelta(days=1)
            continue
            
        # 2. Skip Holidays (DB-defined)
        d_str = next_day.strftime("%Y-%m-%d")
        cursor.execute("SELECT 1 FROM market_holidays WHERE date = ?", (d_str,))
        if cursor.fetchone():
            next_day += timedelta(days=1)
            continue
            
        break
    return next_day.strftime("%Y-%m-%d")

def generate_almanac(target_date: str = None, force_t_plus_1: bool = True) -> bool:
    """
    Core engine for the Rules-based Global Market Almanac.
    
    Features:
    - Zero-LLM dependency for deterministic speed and accuracy.
    - Time-aware filtering for Nasdaq (US market) data.
    - Deterministic random generation using the target date as a seed.
    - Automated Webhook alerting to Admin on failure.
    
    :param target_date: The date this almanac applies to. If None, predicts for T+1.
    :param force_t_plus_1: If True and target_date is None, always targets the next trading day.
    :return: True if successfully generated and persisted.
    """
    conn = get_connection()
    try:
        cursor = conn.cursor()
        
        # 0. Sync Price Context (Determine the reference date of existing market data)
        cursor.execute("SELECT MAX(date) FROM daily_prices WHERE symbol IN ('sh000001', '00700')")
        price_row = cursor.fetchone()
        actual_price_date = price_row[0] if (price_row and price_row[0]) else (datetime.now() + timedelta(hours=8)).strftime("%Y-%m-%d")

        # 1. Determine Target Date (The day this almanac applies to)
        # If not provided, we predict for the NEXT trading day (T+1)
        if not target_date:
            if force_t_plus_1:
                target_date = get_next_trading_day(actual_price_date, cursor)
            else:
                target_date = actual_price_date
        
        logger.info(f"ðŸš€ Generating Almanac for Target Date: {target_date} (Using data context from {actual_price_date})")
        facts_bundle = get_or_generate_market_facts(actual_price_date)
        facts = facts_bundle.get("facts", {})
        facts_quality = facts_bundle.get("quality", {})
        gate_pass = bool(facts_quality.get("gate_pass"))
        if not gate_pass:
            logger.warning(f"Market facts quality gate failed for {actual_price_date}: {facts_quality.get('flags', [])}")

        if actual_price_date != target_date:
            logger.info(f"Market Data Gap: Generating almanac for {target_date} using facts from {actual_price_date}")

        turnover = facts.get("turnover", {})
        breadth = facts.get("breadth", {})
        derived = facts.get("derived", {})

        vol_type = derived.get("vol_type", "flat")
        breadth_type = derived.get("breadth_type", "neutral")

        vol_label_map = {"high": "显著放量", "low": "显著缩量", "flat": "量能平稳"}
        breadth_label_map = {"bull": "普涨格局", "bear": "普跌格局", "neutral": "震荡分化"}
        vol_label = vol_label_map.get(vol_type, "量能平稳")
        breadth_label = breadth_label_map.get(breadth_type, "震荡分化")

        winners = breadth.get("advancers") or 0
        losers = breadth.get("decliners") or 0
        total_stocks = winners + losers if (winners + losers) > 0 else 1
        breadth_ratio = breadth.get("ratio")
        if breadth_ratio is None:
            breadth_ratio = winners / (winners + losers) if (winners + losers) > 0 else 0.5
        heat_score = int(float(breadth_ratio) * 100)
        vol_ratio = turnover.get("ratio_5d") if turnover.get("ratio_5d") is not None else 1.0

        # --- 2. Data Context Acquisition --- #
        provider = MarketContextProvider()
        
        # Time-aware Nasdaq gating:
        # Nasdaq data is only meaningful within the "overnight" freshness window
        # (05:00â€“15:00 Beijing). Outside this window, the data is either stale
        # (afternoon/evening: last night's close) or incomplete (late night: US still trading).
        now_beijing = datetime.now(BEIJING_TZ)
        is_nasdaq_fresh = NASDAQ_FRESH_START_HOUR <= now_beijing.hour < NASDAQ_FRESH_END_HOUR
        
        if not is_nasdaq_fresh:
            logger.info(f"â° Nasdaq gating: Current time {now_beijing.strftime('%H:%M')} outside fresh window [{NASDAQ_FRESH_START_HOUR}:00â€“{NASDAQ_FRESH_END_HOUR}:00) â†’ Nasdaq data is STALE, will be skipped")
        else:
            logger.info(f"âœ… Nasdaq gating: Current time {now_beijing.strftime('%H:%M')} within fresh window [{NASDAQ_FRESH_START_HOUR}:00â€“{NASDAQ_FRESH_END_HOUR}:00) â†’ Nasdaq data is FRESH")
        
        # 1. Macro Context (Global & Domestic)
        macro_data = provider.get_macro_context(skip_nasdaq=not is_nasdaq_fresh)
        nasdaq_change = macro_data.get("nasdaq", "N/A")
        logger.info(f"ðŸ“Š Global Context: Nasdaq Change = {nasdaq_change} (fresh={is_nasdaq_fresh})")
        # 2. Sector Flows (Money Flow) from Fact Layer (authoritative for almanac)
        sector_flow = facts.get("sector_flow", {})
        top_inflow = sector_flow.get("top_inflow") or "暂无数据"
        top_outflow = sector_flow.get("top_outflow") or "暂无数据"
        logger.info(f"Market Flow: Inflow={top_inflow} | Outflow={top_outflow}")
        inflow_parts = [s.strip() for s in top_inflow.split(',') if s.strip()]

        main_currents = []
        if inflow_parts and inflow_parts[0] != "暂无数据":
            for s in inflow_parts:
                if '(' in s and ')' in s:
                    name = s[:s.index('(')].strip()
                    flow = s[s.index('(')+1:s.index(')')].strip()
                    main_currents.append({"name": name, "flow": flow})
                else:
                    main_currents.append({"name": s, "flow": ""})

        outflow_parts = [s.strip() for s in top_outflow.split(',') if s.strip()]

        inverse_currents = []
        if outflow_parts and outflow_parts[0] != "暂无数据":
            for s in outflow_parts:
                if '(' in s and ')' in s:
                    name = s[:s.index('(')].strip()
                    flow = s[s.index('(')+1:s.index(')')].strip()
                    inverse_currents.append({"name": name, "flow": flow})
                else:
                    inverse_currents.append({"name": s, "flow": ""})
        else:
            inverse_currents = [{"name": "高位接盘股", "flow": "退潮"}]
            if breadth_type == "bull":
                inverse_currents = [{"name": "避险防守", "flow": "抽血"}]

        # --- 3. The Scorecard (Rules Engine - Dynamic & Humanistic) --- #
        # Use target_date as seed for deterministic daily variety
        import random
        seed_val = int(target_date.replace('-', ''))
        rng = random.Random(seed_val)

        weekday = datetime.strptime(target_date, "%Y-%m-%d").weekday() # 0=Mon, 4=Fri
        is_monday = (weekday == 0)
        is_friday = (weekday == 4)
        rule_key = f"{vol_type}_{breadth_type}"
        top_sector_name = main_currents[0]["name"] if main_currents else "ä¸»æµèµ›é“"

        # Categorized Action Pool (Enriched with Lifestyle & Psychology)
        ACTIONS = {
            "bull": {
                "yi": ["é¡ºåŠ¿è€Œä¸º", "æŒè‚¡å¾…æ¶¨", "åŠ ä»“ä¸»çº¿", "é€¢ä½Žå¸çº³", "å…³æ³¨é¾™å¤´", "åšå®šä¿¡å¿ƒ", "å¥–åŠ±åˆé¤", "å¤ç›˜é€»è¾‘", "æ·±å‘¼å¸", "æ‹¥æŠ±è¶‹åŠ¿"],
                "ji": ["ç›²ç›®çœ‹ç©º", "é¢‘ç¹æ¢æ‰‹", "æé«˜æŠ›å”®", "é€†åŠ¿åšç©º", "è½»è¨€é¡¶è§", "æ»¡ä»“èµŒåš", "å¬ä¿¡å°é“", "è¿‡åº¦äº¢å¥‹", "æ·±å¤œç›¯ç›˜", "æ æ†æ“ä½œ"]
            },
            "bear": {
                "yi": ["æŒå¸è§‚æœ›", "é£ŽæŽ§ä¸ºçŽ‹", "ä¸¥æŽ§ä»“ä½", "é™å¾…æ—¶æœº", "ä½Žå¸ä¼å‡»", "ç ”ä¹ è´¢æŠ¥", "é˜…è¯»éžé‡‘èžä¹¦", "æ—©ç¡æ—©èµ·", "é™ªä¼´å®¶äºº", "æ–­ç½‘ç‹¬å¤„"],
                "ji": ["ç›²ç›®æŠ„åº•", "é‡ä»“æ­»æ‰›", "ææ…Œæ€è·Œ", "å¾’æ‰‹æŽ¥åˆ€", "æ æ†æ“ä½œ", "é¢‘ç¹æ“ä½œ", "æƒ…ç»ªåŒ–ä¸‹å•", "æŠ±æ€¨å¸‚åœº", "å€Ÿé’±å…¥å¸‚", "æ€¥äºŽå›žæœ¬"]
            },
            "neutral": {
                "yi": ["é«˜ä½Žåˆ‡æ¢", "æŽ§åˆ¶ä»“ä½", "ç²¾ç ”ä¸ªè‚¡", "æ­¢ç›ˆå‡ä»“", "è€å¿ƒè›°ä¼", "å·¦ä¾§åŸ‹ä¼", "æ•´ç†ç¬”è®°", "ä¿æŒå®¢è§‚", "å°é‡è¯•é”™", "åˆ†æ‰¹è¿›åœº"],
                "ji": ["è¿½æ¶¨æ€è·Œ", "æ»¡ä»“æ“ä½œ", "ç›²ç›®è·Ÿé£Ž", "é‡ä»“å•ä¸€", "é¢‘ç¹è¿›å‡º", "æ€¥äºŽæ±‚æˆ", "è´ªå¤§æ±‚å…¨", "èµŒå¾’å¿ƒæ€", "å¿½è§†é£Žé™©", "æ­»ç£•ä¸ªè‚¡"]
            }
        }

        # Select random actions based on market type
        pool = ACTIONS.get(breadth_type, ACTIONS["neutral"])
        selected_yi = rng.sample(pool["yi"], 2)
        selected_ji = rng.sample(pool["ji"], 2)
        action_strategy = f"å®œï¼š{' / '.join(selected_yi)} Â· å¿Œï¼š{' / '.join(selected_ji)}"

        # 9-Quadrant Rich Templates (Massive Expansion)
        VARIANTS = {
            "high_bull": [
                {"tag": "åŠ¿å¦‚ç ´ç«¹", "meteo": "çƒˆç«", "insight": f"å¤§ç›˜çˆ†é‡é•¿é˜³ï¼Œåœºå¤–èµ„é‡‘å¦‚æ´ªæµèˆ¬æ¶Œå…¥ã€{top_sector_name}ã€‘ã€‚è¶‹åŠ¿ä¸€æ—¦å½¢æˆä¾¿éš¾ä»¥é˜»æŒ¡ï¼Œæ­¤åˆ»å”¯æœ‰æ‹¥æŠ±æ ¸å¿ƒï¼Œé™å¾…ç¹èŠ±ã€‚"},
                {"tag": "é›·éœ†ä¸‡é’§", "meteo": "èµ¤é¾™", "insight": f"å¤šå¤´èƒ½é‡å…¨é¢çˆ†å‘ï¼Œé‡èƒ½åˆ›ä¸‹é˜¶æ®µæ–°é«˜ã€‚èµ„é‡‘åœ¨ã€{top_sector_name}ã€‘ç–¯ç‹‚æ‰«è´§ï¼Œèµšé’±æ•ˆåº”è¿›å…¥é«˜æ½®ï¼Œå»ºè®®ç´§æ‰£é¢†å¤´ç¾Šã€‚"},
                {"tag": "é£žé¾™åœ¨å¤©", "meteo": "çº¢ç„°", "insight": f"æˆäº¤æ€¥å‰§æ”¾å¤§ï¼Œå¤§ç›˜å‘ˆçŽ°ä¿¯å†²å¼æ‹‰å‡ã€‚å¸‚åœºæƒ…ç»ªå·²è¢«å½»åº•ç‚¹ç‡ƒï¼Œã€{top_sector_name}ã€‘æ­£åœ¨ä¹¦å†™ç¥žè¯ï¼Œè¶‹åŠ¿çš„åŠ›é‡æ­£åœ¨æœ€å¤§åŒ–å®£æ³„ã€‚"},
                {"tag": "é‡‘å…‰å å½±", "meteo": "è™¹å…‰", "insight": f"ä¸»æµæ¿å—å…¨çº¿é£˜çº¢ï¼Œå·¨é¢å¢žé‡èµ„é‡‘é”æ­»ã€{top_sector_name}ã€‘ã€‚è¿™ç§çº§åˆ«çš„æ”»å‡»ä¸ä»…æ˜¯åå¼¹ï¼Œæ›´æ˜¯é‡å¡‘ï¼Œå»ºè®®é¡ºåº”å¤©æ—¶ï¼Œä¹˜é£Žè€Œä¸Šã€‚"}
            ],
            "flat_bull": [
                {"tag": "å¹³æµç¼“è¿›", "meteo": "æ™¨æ›¦", "insight": f"ç¨³æ‰Žç¨³æ‰“çš„æ™®æ¶¨æ ¼å±€ã€‚è™½ç„¶æ²¡æœ‰æƒŠå¤©åŠ¨åœ°çš„çˆ†é‡ï¼Œä½†ã€{top_sector_name}ã€‘çš„ç¨³æ­¥ä¸Šç§»è¯´æ˜Žæ”¯æ’‘åšå®žã€‚æ­¤æ—¶è€å¿ƒæ¯”ä¿¡å¿ƒæ›´é‡è¦ã€‚"},
                {"tag": "æ˜¥é£ŽåŒ–é›¨", "meteo": "æš–é˜³", "insight": f"å¸‚åœºå‘ˆçŽ°è‰¯æ€§è½®åŠ¨ï¼Œæ™®æ¶¨æ¸©å’Œä¸”å¥åº·ã€‚èµ„é‡‘æ­£æ‚„ç„¶å‘ã€{top_sector_name}ã€‘èšé›†ï¼ŒæŒè‚¡è€…åªéœ€é™çœ‹äº‘å·äº‘èˆ’ï¼Œä¸å¿…æ€¥äºŽæ±‚æˆã€‚"},
                {"tag": "ç»†æ°´é•¿æµ", "meteo": "æŸ”å…‰", "insight": f"æŒ‡æ•°åœ¨ç¼“æ…¢æŽ¨å‡ä¸­ä¿®å¤ä¿¡å¿ƒã€‚ä¸»åŠ›åœ¨ã€{top_sector_name}ã€‘ä¸­æ…¢æ¡æ–¯ç†åœ°æž„å»ºé˜²çº¿ã€‚è¿™ç§æ¸©å’Œçš„æ™®æ¶¨å¾€å¾€æ‰æ˜¯æœ€æŒä¹…çš„èµšé’±è‰¯æœºã€‚"},
                {"tag": "æ½œç§»é»˜åŒ–", "meteo": "ç†¹å¾®", "insight": f"æ— éœ€çˆ†é‡ï¼Œå–åŽ‹å·²åœ¨ç›˜æ•´ä¸­æ¶ˆç£¨æ®†å°½ã€‚å¸‚åœºæ­£å¤„äºŽä¸»å‡æµªå‰çš„é™è°§æ—¶åˆ»ï¼Œã€{top_sector_name}ã€‘çš„å°æ­¥å¿«è·‘æ˜¯æžä½³çš„ä½Žå¸ä¿¡å·ã€‚"}
            ],
            "low_bull": [
                {"tag": "æš—é¦™æµ®åŠ¨", "meteo": "æš–é£Ž", "insight": f"æ— é‡åå¼¹å¾€å¾€ä¼´éšç€åˆ†æ­§ã€‚è™½æœ‰æ™®æ¶¨ä¹‹è¡¨ï¼Œä½†èƒ½é‡å°šæœªå®Œå…¨æ¿€æ´»ã€‚ä¸»æ”»æ‰‹åœ¨ã€{top_sector_name}ã€‘å±€éƒ¨è¯•æŽ¢ï¼Œé˜²èŒƒå†²é«˜å›žè½ã€‚"},
                {"tag": "æž¯æœ¨é€¢æ˜¥", "meteo": "å¾®èŠ’", "insight": f"æƒ…ç»ªå…ˆäºŽèµ„é‡‘ä¿®å¤ï¼Œç¼©é‡æ™®æ¶¨æš—ç¤ºå–ç›˜æž¯ç«­ã€‚æ­¤æ—¶è™½æœªè§å¤§é¾™ï¼Œä½†ã€{top_sector_name}ã€‘çš„æ˜Ÿæ˜Ÿä¹‹ç«è¶³ä»¥ç‡ŽåŽŸï¼Œå®œè½»ä»“å‰çž»ã€‚"},
                {"tag": "èœ»èœ“ç‚¹æ°´", "meteo": "æ¶Ÿæ¼ª", "insight": f"å­˜é‡èµ„é‡‘çš„åšå¼ˆè¡¨æ¼”ã€‚æŒ‡æ•°è™½çº¢ï¼Œä½†åº•æ°”ä¸è¶³ã€‚èµ„é‡‘åœ¨ã€{top_sector_name}ã€‘ä¸­å¿«è¿›å¿«å‡ºï¼Œåˆ‡èŽ«åœ¨ç¼©é‡æ—¶å½“çœŸï¼Œä¿æŒä¸‰åˆ†è­¦æƒ•ã€‚"},
                {"tag": "é•œèŠ±æ°´æœˆ", "meteo": "å¹»å½©", "insight": f"çœ‹ä¼¼æ™®æ¶¨ï¼Œå®žåˆ™è‡ªæ•‘ã€‚ç¼©é‡åå¼¹å¤šä¸ºæƒ…ç»ªè„‰å†²ï¼Œã€{top_sector_name}ã€‘çš„æ´»è·ƒåº¦éš¾ä»¥æ”¯æ’‘é•¿ä¹…æ‹‰å‡ã€‚åœ¨è¿™ä¸ªé˜¶æ®µï¼ŒæŽ§åˆ¶è´ªå¿µæ¯”æŠ“ä½åˆ©æ¶¦æ›´é‡è¦ã€‚"}
            ],
            "high_neutral": [
                {"tag": "æƒŠæ¶›æ‹å²¸", "meteo": "å¥”æµ", "insight": f"å·¨é‡æ¢æ‰‹ä¼´éšç€å‰§çƒˆæ³¢åŠ¨ã€‚å¤šç©ºåŒæ–¹åœ¨ã€{top_sector_name}ã€‘ç­‰ä¸»æˆ˜åœºç™½åˆƒç›¸æŽ¥ã€‚åˆ†æ­§å³æœºä¼šï¼ŒåŽ»å¼±ç•™å¼ºæ˜¯å½“åŠ¡ä¹‹æ€¥ã€‚"},
                {"tag": "ç†”ç‚‰äº¤é”‹", "meteo": "çƒˆé£Ž", "insight": f"çˆ†é‡éœ‡è¡è¯´æ˜Žç­¹ç æ­£åœ¨å¤§èŒƒå›´æ˜“æ‰‹ã€‚èµ„é‡‘ä»Žé«˜ä½è‚¡åŠ é€Ÿæ’¤ç¦»ï¼Œè½¬å‘å¯»æ‰¾ã€{top_sector_name}ã€‘æ–¹å‘çš„é¿é£Žæ¸¯ï¼Œæ³¢åŠ¨ä¸­è•´å«é‡ç”Ÿã€‚"},
                {"tag": "é¾™è™Žå†³", "meteo": "ç‹‚æ¾œ", "insight": f"åœºé¢å®å¤§å´éš¾ä»¥å†³å‡ºèƒœè´Ÿã€‚æ¿å—é—´å‰§çƒˆæ¢æ‰‹ï¼Œã€{top_sector_name}ã€‘æˆä¸ºè§’åŠ›ä¸­å¿ƒã€‚è¿™ç§é«˜æ¢æ‰‹é€šå¸¸æ˜¯å˜ç›˜å‰å¥ï¼Œæ³¨æ„è§‚å¯Ÿå°¾ç›˜å¯¼å‘ã€‚"},
                {"tag": "çƒ½ç«èµ¤å£", "meteo": "ç«é£Ž", "insight": f"ä¸‡äº¿æˆäº¤ä¸‹çš„æƒ¨çƒˆåšå¼ˆã€‚è™½ç„¶èµšé’±æ•ˆåº”åˆ†åŒ–ï¼Œä½†åªè¦èƒ½å®ˆä½ã€{top_sector_name}ã€‘æ ¸å¿ƒé˜µåœ°ï¼Œä¾¿èƒ½åœ¨ä¹±å±€ä¸­ç«‹äºŽä¸è´¥ä¹‹åœ°ã€‚"}
            ],
            "flat_neutral": [
                {"tag": "æš—æµæ¶ŒåŠ¨", "meteo": "æ™¨é›¾", "insight": f"æŒ‡æ•°æ³¢æ¾œä¸æƒŠï¼Œä½†æ°´åº•æš—æµæ¹æ€¥ã€‚å±žäºŽå…¸åž‹çš„è½®åŠ¨è¡Œæƒ…ï¼Œä¸»æˆ˜åœºè™½è§ã€{top_sector_name}ã€‘ï¼Œä½†åˆ‡å¿ŒåŽçŸ¥åŽè§‰è¿½é«˜ï¼Œåº”è€å¿ƒåŸ‹ä¼ã€‚"},
                {"tag": "é›¾é‡Œçœ‹èŠ±", "meteo": "çƒŸäº‘", "insight": f"å¸‚åœºè¿›å…¥ç”µé£Žæ‰‡è½®åŠ¨æ¨¡å¼ã€‚æŒ‡æ•°çª„å¹…éœ‡è¡ï¼Œèµ„é‡‘åœ¨ã€{top_sector_name}ã€‘å†…éƒ¨å¿«é€Ÿåˆ‡æ¢ï¼Œè€ƒéªŒå¿ƒæ€çš„å®šåŠ›å’ŒæŠ•ç ”çš„æ·±åº¦ã€‚"},
                {"tag": "ç½—ç”Ÿé—¨", "meteo": "è–„æš®", "insight": f"å¤šç©ºä¿¡æ¯äº¤ç»‡ï¼ŒæŒ‡æ•°é™·å…¥åƒµå±€ã€‚çœ‹ä¼¼å¹³ç¨³çš„èƒŒåŽï¼Œã€{top_sector_name}ã€‘æ­£ç»åŽ†æƒ¨çƒˆçš„åŽ»æ æ†ä¸Žå†å¹³è¡¡ã€‚æ­¤æ—¶ä¸åŠ¨å¦‚å±±ï¼Œæ–¹ä¸ºæ™ºè€…ã€‚"},
                {"tag": "æ··æ²Œæœªæ˜Ž", "meteo": "å¾®é›¨", "insight": f"å…¸åž‹çš„å¹³è¡¡æœ¨åšå¼ˆã€‚æŒ‡æ•°åœ¨æžå°èŒƒå›´å†…èµ·ä¼ï¼Œèµ„é‡‘åœ¨ã€{top_sector_name}ã€‘ä¸­åå¤æ¨ªè·³å¯»æ‰¾æ–¹å‘ã€‚è¿™æ˜¯å¯¹äº¤æ˜“è€…è€å¿ƒæœ€æžç«¯çš„è€ƒéªŒã€‚"}
            ],
            "low_neutral": [
                {"tag": "é™æ°´æ·±æµ", "meteo": "æ­¢æ°´", "insight": f"åœ°é‡éœ‡è¡ï¼Œå¸‚åœºçŠ¹å¦‚è¿›å…¥åžƒåœ¾æ—¶é—´ã€‚ä¸»åŠ›è¿›å…¥è›°ä¼çŠ¶æ€ï¼Œèµ„é‡‘æ™®éç¼ºä¹æ”»å‡»æ„æ„¿ã€‚ç©ºä»“æˆ–æžè½»ä»“é˜²å®ˆæ˜¯ä¸Šç­–ï¼Œé™å¾…çœŸé¾™ã€‚"},
                {"tag": "å¤æ½­å¾®æ³¢", "meteo": "å¯’æ±Ÿ", "insight": f"é‡èƒ½é™è‡³å†°ç‚¹ï¼Œå¸‚åœºå‘ˆçŽ°å¤±è¡€çŠ¶æ€ã€‚ä¸Žå…¶åœ¨ã€{top_sector_name}ã€‘å¾®å°çš„æ³¢åŠ¨ä¸­æ²‰æµ®ï¼Œä¸å¦‚æŠ½èº«è€Œé€€ï¼Œç ”å­¦é€»è¾‘ï¼Œé™ä¿®å…¶å¿ƒã€‚"},
                {"tag": "å¹³æ¹–ç§‹æœˆ", "meteo": "æ¸…éœœ", "insight": f"ä¸€åˆ‡éƒ½æ…¢äº†ä¸‹æ¥ã€‚é‡èƒ½ç¼©æ— å¯ç¼©ï¼Œå¤§ç›˜ä»¿ä½›å¤±åŽ»äº†å¿ƒè·³ã€‚æ­¤æ—¶ä¸å¿…åœ¨ã€{top_sector_name}ã€‘ä¸­è‹¦è‹¦å¯»è§…æœºä¼šï¼Œæœ€å¥½çš„æœºä¼šæ˜¯ä¼‘æ¯ã€‚"},
                {"tag": "ç»å£°è°·", "meteo": "ç©ºèŒ«", "insight": f"å…¨åœºè‚ƒé™ã€‚äº¤æ˜“è€…åœ¨è§‚æœ›ï¼Œå¤§é³„åœ¨æ½œä¼ã€‚æ— é‡éœ‡è¡æ˜¯å¸‚åœºæœ€å¯‚å¯žçš„æ—¶åˆ»ï¼Œã€{top_sector_name}ã€‘çš„å†·æ¸…æ­£æ˜¯æœ€å¥½çš„é˜²å¾¡ç†ç”±ã€‚"}
            ],
            "high_bear": [
                {"tag": "æ³¥æ²™ä¿±ä¸‹", "meteo": "ç½¡é£Ž", "insight": f"æ”¾é‡å¤§è·Œæ˜¯æœ€å±é™©çš„ä¿¡å·ï¼Œç³»ç»Ÿæ€§é£Žé™©æ­£åœ¨ç–¯ç‹‚å®£æ³„ã€‚å³ä½¿ã€{top_sector_name}ã€‘æœ‰å±€éƒ¨æŠµæŠ—ï¼Œä¹Ÿéš¾æŒ¡å¤§åŠ¿é¢“é¡ï¼Œç©ºä»“æ˜¯å”¯ä¸€çš„ä¿®è¡Œã€‚"},
                {"tag": "é‡‘çŸ³è£‚å˜", "meteo": "æ²‰é›·", "insight": f"ææ…Œç›˜å¦‚æ½®æ°´æ¶Œå‡ºï¼Œçˆ†é‡ä¸‹è·Œä¸è¨€åº•ã€‚å¤šå¤´åœ¨ã€{top_sector_name}ã€‘çš„é˜²çº¿å±‚å±‚å´©æºƒï¼Œé£ŽæŽ§æ˜¯æ­¤æ—¶å”¯ä¸€çš„æœ€é«˜ä¿¡æ¡ï¼Œä¸å¯æœ‰ä¾¥å¹¸ã€‚"},
                {"tag": "ä¸‡é©¬å¥”è…¾", "meteo": "é»‘æ½®", "insight": f"å¤§åŠ¿å·²åŽ»ï¼Œå·¨é‡æŠ›å•æ— æƒ…æ‘§æ¯äº†æ‰€æœ‰æŠ€æœ¯ä½ã€‚èµ„é‡‘æ­£ä¸è®¡ä»£ä»·æ’¤ç¦»ï¼Œç”šè‡³æ³¢åŠã€{top_sector_name}ã€‘ã€‚è¿™ç§æ—¶åˆ»ï¼Œå¤šç•™ä¸€æ¯«ç§’éƒ½æ˜¯å±é™©ã€‚"},
                {"tag": "å¤©å´©åœ°è£‚", "meteo": "é™¨çŸ³", "insight": f"æžç«¯ææ…Œã€‚åœºå†…æµåŠ¨æ€§è¿…é€Ÿæž¯ç«­ï¼ŒæŠ›åŽ‹å¦‚å¤§é›ªå´©èˆ¬å€¾æ³»è€Œä¸‹ã€‚æ­¤åˆ»ä»»ä½•è¯•å›¾æ‹¯æ•‘ã€{top_sector_name}ã€‘çš„è¡Œä¸ºéƒ½æ˜¯å¾’åŠ³ï¼Œå”¯æœ‰æŠ½èº«é¿é™©ã€‚"}
            ],
            "flat_bear": [
                {"tag": "è½å¶çŸ¥ç§‹", "meteo": "å¯’éœœ", "insight": f"é˜´è·Œç»µç»µï¼Œé’åˆ€è‚‰æœ€æ˜¯æ¶ˆç£¨æ„å¿—ã€‚è™½ç„¶æŠ›åŽ‹æœªè§é«˜æ½®ï¼Œä½†é‡å¿ƒæŒç»­ä¸‹ç§»ã€‚åœ¨å³ä¾§ä¿¡å·å‡ºçŽ°å‰ï¼Œä»»ä½•æŠ„åº•è¡Œä¸ºæœ¬è´¨éƒ½æ˜¯ä¸€åœºåŠ«éš¾ã€‚"},
                {"tag": "å†·é›¨è§ç‘Ÿ", "meteo": "ç»†é›¨", "insight": f"å¸‚åœºé‡å¿ƒåœ¨æ— å£°ä¸­ä¸‹å ã€‚èµšé’±æ•ˆåº”é™è‡³å†°ç‚¹ï¼Œå³ä¾¿æ˜¯æ›¾å¼ºåŠ¿çš„ã€{top_sector_name}ã€‘ä¹Ÿæ˜¾éœ²ç–²æ€ã€‚å®œç¼©è¡£èŠ‚é£Ÿä»¥æ­¤åº¦è¿‡å¯’å†¬ã€‚"},
                {"tag": "ç§‹é£Žæ‰«å¶", "meteo": "è‹¦é£Ž", "insight": f"é˜´äº‘å¯†å¸ƒã€‚æŠ›åŽ‹è™½ç„¶ä¸é‡ï¼Œä½†ä¹°ç›˜æ„æ„¿æ›´ä½Žã€‚æŒ‡æ•°åœ¨æ…¢æ€§å¤±è¡€ä¸­é˜´è·Œï¼Œã€{top_sector_name}ã€‘çš„æŠµæŠ—ä¹Ÿæ˜¾å¾—è½¯å¼±æ— åŠ›ã€‚"},
                {"tag": "è¦†å·¢ä¹‹ä¸‹", "meteo": "é“…äº‘", "insight": f"å¤§ç›˜å‘ˆçŽ°å…¸åž‹çš„é˜´è·Œé€šé“ã€‚æ²¡æœ‰æ³¢æ¾œçš„ä¸‹è·Œæ‰æ˜¯æœ€éš¾åº”ä»˜çš„æ…¢æ€§æŠ˜ç£¨ã€‚å¦‚æžœä½ è¿˜åœ¨çº ç»“ã€{top_sector_name}ã€‘çš„è¡¥æ¶¨ï¼Œè¯·å…ˆçœ‹é€ç³»ç»Ÿé£Žé™©ã€‚"}
            ],
            "low_bear": [
                {"tag": "å€’æ˜¥å¯’", "meteo": "æ·±æ°´", "insight": f"ç¼©é‡æ™®è·Œæ„å‘³ç€ä¹°ç›˜å½»åº•æ¶ˆå¤±ã€‚å¸‚åœºå¤„äºŽæžåº¦è„†å¼±çš„çœŸç©ºæœŸï¼Œé™æ°´æ·±å¤„æ½œä¼ç€æœ€åŽä¸€æ¬¡ç»æœ›æ´—ç›˜ã€‚é»Žæ˜Žå‰çš„é»‘æš—æœ€ä¸ºéš¾ç†¬ã€‚"},
                {"tag": "å†°å°åƒé‡Œ", "meteo": "çŽ„éœœ", "insight": f"æƒ…ç»ªè¿›å…¥æžå¯’çŠ¶æ€ï¼Œèƒ½é‡æž¯ç«­ã€‚æ­¤æ—¶ç›²ç›®å‰²è‚‰æˆ–ç›²ç›®æŠ„åº•çš†éžè‰¯ç­–ï¼Œå®ˆä½æ®‹å­˜çš„æœ¬é‡‘ï¼Œé™å¾…å†°é›ªæ¶ˆèžï¼Œå†¬åŽ»æ˜¥æ¥ã€‚"},
                {"tag": "æž¯æ½­æ­»æ°´", "meteo": "å¹½æ¸Š", "insight": f"å¤§ç›˜å·²å¤±åŽ»åšå¼ˆä»·å€¼ã€‚ç¼©é‡æ™®è·Œè¯´æ˜Žå³ä¾¿æƒ³ç¦»åœºçš„èµ„é‡‘ä¹Ÿæ‰¾ä¸åˆ°å¯¹æ‰‹ç›˜ã€‚æ­¤æ—¶çš„ã€{top_sector_name}ã€‘å·²æ— ç”Ÿæ„å¯è¨€ï¼Œä¸“æ³¨åœºå¤–ç”Ÿæ´»ã€‚"},
                {"tag": "è‰å™ªæž—é€¾é™", "meteo": "è’é‡Ž", "insight": f"æžåº¦ç¼©é‡åŽçš„æ™®è·Œã€‚è¿™å¾€å¾€æ˜¯æœ€åŽä¸€æ®µç»æœ›çš„å¿ƒç†é˜²çº¿è€ƒéªŒã€‚æ­¤æ—¶å¤šæƒ³æ— ç›Šï¼Œå…³ä¸Šç”µè„‘ï¼ŒåŽ»å‘¼å¸æ–°é²œç©ºæ°”ã€‚"}
            ]
        }

        # Select variant & add day modifiers
        variant_list = VARIANTS.get(rule_key, VARIANTS["low_neutral"])
        selected = rng.choice(variant_list)
        
        mood_tag = selected["tag"]
        meteorology = selected["meteo"]
        template = selected["insight"]
        degraded = not gate_pass
        if degraded:
            mood_tag = "混沌未明"
            meteorology = "微雨"
            action_strategy = "宜：控制仓位 / 忌：情绪化追单"
            template = "数据完整性不足，已切换防守语义。请以仓位纪律和风险控制为先。"

        # Global Enrichment (Nasdaq) â€” Time-gated
        # Only inject Nasdaq narrative when the data is genuinely "overnight" fresh.
        nasdaq_impact = None
        if (not degraded) and nasdaq_change != "N/A" and is_nasdaq_fresh:
            try:
                nasdaq_val = float(nasdaq_change.replace('%', ''))
                if nasdaq_val > 1.0:
                    template += f" å—åˆ°éš”å¤œç¾Žè‚¡ï¼ˆçº³æŒ‡{nasdaq_change}ï¼‰èµ°å¼ºæ˜ å°„ï¼Œä»Šå¤© A è‚¡æœ‰æœ›è¿Žæ¥ç§¯æžçš„å¼€ç›˜æƒ…ç»ªã€‚"
                    nasdaq_impact = "bullish"
                elif nasdaq_val < -1.2:
                    template += f" å—éš”å¤œçº³æŒ‡ï¼ˆ{nasdaq_change}ï¼‰åŽ‹åŠ›ä¼ å¯¼ï¼Œå¤–å›´çŽ¯å¢ƒç•¥æ˜¾ä½Žè¿·ï¼Œå¼€ç›˜éœ€æé˜²æƒ…ç»ªç ¸ç›˜ã€‚"
                    nasdaq_impact = "bearish"
                else:
                    nasdaq_impact = "neutral"
            except: pass
        elif not is_nasdaq_fresh:
            nasdaq_impact = "stale_skipped"
            logger.info(f"â­ï¸  Nasdaq enrichment skipped: data not fresh at {now_beijing.strftime('%H:%M')}")

        # Temporal Context Enrichment
        temporal_impact = "none"
        if (not degraded) and is_monday:
            template = "ã€å‘¨ä¸€å¼€ç¯‡ã€‘" + template + " æœ¬å‘¨è¶‹åŠ¿å°†ç”±æ­¤å®šè°ƒã€‚"
            temporal_impact = "monday"
        elif (not degraded) and is_friday:
            template = "ã€å‘¨äº”æ”¶å®˜ã€‘" + template + " å‘¨æœ«æ”¿ç­–é¢åŠ¨å‘åŠæ¶ˆæ¯åšå¼ˆå°†æ˜¯å…³é”®ã€‚"
            temporal_impact = "friday"
        
        extra_suffix = None
        if (not degraded) and rng.random() < 0.4: # 40% chance for a "lucky charm" or extra advice
            extra_suffix = rng.choice([
                " å¿ƒå¦‚æ­¢æ°´ï¼Œæ–¹èƒ½çœ‹é€è¿·é›¾ã€‚",
                " è®°ä½ï¼Œæœ¬é‡‘æ¯”åˆ©æ¶¦æ›´é‡è¦ã€‚",
                " æ‰€æœ‰çš„æœºä¼šéƒ½æ˜¯ç­‰å‡ºæ¥çš„ã€‚",
                " å¼±æ°´ä¸‰åƒï¼Œåªå–ä¸€ç“¢é¥®ã€‚",
                " è¶‹åŠ¿æ˜¯ä½ çš„æœ‹å‹ï¼Œè€Œéžæ•Œäººã€‚",
                " å–„æˆ˜è€…ä¹‹èƒœï¼Œæ— æ™ºåï¼Œæ— å‹‡åŠŸã€‚",
                " èƒœå¯çŸ¥ï¼Œè€Œä¸å¯ä¸ºã€‚",
                " ä¹°å…¥é æœºä¼šï¼Œå–å‡ºé å¿è€ã€‚",
                " å¸‚åœºä¸ä¼šå…³é—¨ï¼Œæœºä¼šæ°¸è¿œéƒ½åœ¨ã€‚",
                " å®å¯é”™è¿‡ï¼Œä¸è¦åšé”™ã€‚",
                " æ­¢æŸæ˜¯äº¤æ˜“çš„ä¸€éƒ¨åˆ†ï¼Œåƒå‘¼å¸ä¸€æ ·è‡ªç„¶ã€‚",
                " ä¸è¦è¯•å›¾æŽ¥ä½ä¸‹å çš„é£žåˆ€ã€‚",
                " ç¬¬ä¸€å‡†åˆ™æ˜¯ä¿ä½æœ¬é‡‘ï¼Œç¬¬äºŒå‡†æ‰æ˜¯å‚è€ƒç¬¬ä¸€æ¡ã€‚",
                " åˆ©æ¶¦æ˜¯å¸‚åœºç»™ä½ çš„å¥–é‡‘ï¼Œä¸æ˜¯ä½ åº”å¾—çš„è–ªæ°´ã€‚",
                " é€†åŠ¿è€Œä¸ºå¾€å¾€æ˜¯æ¯ç­çš„å¼€å§‹ã€‚",
                " åªæœ‰åœ¨æ½®æ°´é€€åŽ»æ—¶ï¼Œæ‰çŸ¥é“è°åœ¨è£¸æ³³ã€‚",
                " é£Žé™©æ¥è‡ªä½ ä¸çŸ¥é“è‡ªå·±åœ¨åšä»€ä¹ˆã€‚",
                " è€å¿ƒæ˜¯äº¤æ˜“è€…æœ€æ˜‚è´µçš„èµ„äº§ã€‚",
                " åˆ«åœ¨åˆ«äººçš„è´ªå©ªä¸­è¿·å¤±ï¼Œåˆ«åœ¨åˆ«äººçš„ææƒ§ä¸­æˆ˜æ —ã€‚",
                " æ¯ä¸€ç¬”äº¤æ˜“éƒ½è¯¥æœ‰å®ƒå¿…é¡»å­˜åœ¨çš„é€»è¾‘ã€‚",
                " è¡Œæƒ…çš„æ¼”ç»Žï¼Œå¾€å¾€åœ¨ç»æœ›ä¸­è¯žç”Ÿï¼Œåœ¨åˆ†æ­§ä¸­æˆé•¿ã€‚",
                " å¸‚åœºæ˜¯åäººæ€§çš„ï¼Œå­¦ä¼šä¸Žè‡ªå·±çš„æœ¬èƒ½å¯¹æŠ—ã€‚",
                " äº¤æ˜“ä¸ä»…æ˜¯é‡‘é’±çš„åšå¼ˆï¼Œæ›´æ˜¯çµé­‚çš„ä¿®è¡Œã€‚",
                " è¿›åœºå‰çš„æ€è€ƒï¼Œé‡äºŽè¿›åœºåŽçš„ç¥ˆç¥·ã€‚",
                " æˆåŠŸçš„äº¤æ˜“è€…ï¼Œéƒ½æ˜¯æ¦‚çŽ‡çš„ä¿¡å¾’ã€‚",
                " ä¿æŒæ•¬ç•ï¼Œå¸‚åœºæ°¸è¿œæ˜¯å¯¹çš„ã€‚",
                " å¤ç›˜æ˜¯ä¸ºäº†åœ¨æœªæ¥ä¸å†çŠ¯åŒæ ·çš„é”™è¯¯ã€‚",
                " æ‰€è°“ç›˜æ„Ÿï¼Œæ˜¯å»ºç«‹åœ¨æµ·é‡æ•°æ®ä¸Šçš„ç›´è§‰ã€‚",
                " å¤åˆ©æ˜¯ä¸–ç•Œç¬¬å…«å¤§å¥‡è¿¹ï¼Œåˆ«è®©äºæŸæ‰“æ–­å®ƒã€‚",
                " ä¸è¦çˆ±ä¸Šä½ çš„æŒä»“ï¼Œå®ƒåªæ˜¯ä¸€ä¸ªæ•°å­—ã€‚",
                " å­¤ç‹¬æ˜¯äº¤æ˜“è€…çš„å¸¸æ€ï¼Œäº«å—è¿™ç§é™è°§ã€‚",
                " å¥½çš„äº¤æ˜“å¾€å¾€æ˜¯æž¯ç‡¥ç”šè‡³ä¹å‘³çš„ã€‚",
                " åœ¨å–§åš£ä¸­ä¿æŒå†·å³»ï¼Œåœ¨ä½Žè°·ä¸­ä¿æŒæ¸©å’Œã€‚"
            ])
            template += extra_suffix

        # Compile final JSON payloads
        entropy_payload = {
            "score": heat_score,
            "label": f"{heat_score}% Â· {breadth_label[:2]}",
            "breadth": breadth_label,
            "volume_status": f"{vol_label}"
        }
        
        sector_payload = {
            "main": main_currents[:2],
            "inverse": inverse_currents
        }

        # --- Prepare Trace Log ---
        pipeline_run_id = f"almanac-{target_date}-{uuid.uuid4().hex[:8]}"
        macro_quality = macro_data.get("quality") if isinstance(macro_data, dict) else None
        flow_quality = {
            "source": sector_flow.get("source"),
            "status": sector_flow.get("status"),
            "trend_3d": sector_flow.get("trend_3d"),
        }
        trace = {
            "trace_envelope": {
                "trace_id": f"alm-{target_date}",
                "parent_trace_id": None,
                "pipeline_run_id": pipeline_run_id,
                "stage": "almanac_generation",
                "component": "backend.engine.almanac_generator",
                "target_date": target_date,
                "status": "success",
                "generated_at_beijing": now_beijing.strftime("%Y-%m-%d %H:%M:%S"),
            },
            "target_date": target_date,
            "data_context_date": actual_price_date,
            "seed_val": seed_val,
            "metrics": {
                "vol": {
                    "current": turnover.get("total_amount_yi"),
                    "average_recent": turnover.get("ma5"),
                    "ratio": round(vol_ratio, 3),
                    "label": vol_label
                },
                "breadth": {
                    "winners": winners,
                    "losers": losers,
                    "total": total_stocks,
                    "ratio": round(breadth_ratio, 3),
                    "heat_score": heat_score,
                    "label": breadth_label
                },
                "flows": {
                    "raw_inflow": top_inflow,
                    "raw_outflow": top_outflow,
                    "parsed_main": main_currents,
                    "parsed_inverse": inverse_currents
                }
            },
            "macro": macro_data,
            "data_quality": {
                "macro_quality": macro_quality,
                "market_flow_quality": flow_quality,
                "facts_quality": facts_quality,
                "facts_gate_pass": gate_pass,
            },
            "lineage": {
                "macro": macro_data.get("lineage", {}) if isinstance(macro_data, dict) else {},
                "market_flow": {"sector_flow": sector_flow.get("source")},
                "facts": {"fact_date": actual_price_date, "version": facts.get("version")},
            },
            "logic": {
                "rule_key": rule_key,
                "mood_tag": mood_tag,
                "degraded": degraded,
                "selected_yi": selected_yi,
                "selected_ji": selected_ji,
                "nasdaq_impact": nasdaq_impact,
                "nasdaq_freshness": "fresh" if is_nasdaq_fresh else "stale",
                "generation_time_beijing": now_beijing.strftime("%Y-%m-%d %H:%M:%S"),
                "temporal_impact": temporal_impact,
                "extra_suffix": extra_suffix
            },
            "version": "1.4-fact-layer-gated"
        }

        # --- 4. Persist to DB --- #
        cursor.execute("SELECT 1 FROM market_almanacs WHERE target_date = ?", (target_date,))
        exists = cursor.fetchone()

        if exists:
            cursor.execute("""
                UPDATE market_almanacs SET 
                    mood_tag = ?, action_strategy = ?, meteorology = ?, 
                    market_entropy = ?, sector_currents = ?, ai_insight = ?,
                    generation_trace = ?,
                    created_at = datetime('now', '+8 hours')
                WHERE target_date = ?
            """, (
                mood_tag, action_strategy, meteorology,
                json.dumps(entropy_payload, ensure_ascii=False),
                json.dumps(sector_payload, ensure_ascii=False),
                template,
                json.dumps(trace, ensure_ascii=False),
                target_date
            ))
            logger.info(f"âœ… Almanac Updated for {target_date} -> {mood_tag} (Trace saved)")
        else:
            cursor.execute("""
                INSERT INTO market_almanacs 
                (target_date, mood_tag, action_strategy, meteorology, market_entropy, sector_currents, ai_insight, generation_trace)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                target_date, mood_tag, action_strategy, meteorology,
                json.dumps(entropy_payload, ensure_ascii=False),
                json.dumps(sector_payload, ensure_ascii=False),
                template,
                json.dumps(trace, ensure_ascii=False)
            ))
            logger.info(f"âœ… Almanac Inserted for {target_date} -> {mood_tag} (Trace saved)")
        
        conn.commit()
        return True

    except Exception as e:
        error_msg = traceback.format_exc()
        logger.error(f"âŒ Almanac Generation Failed: {error_msg}")
        
        # ðŸš¨ Notify Admin via WeCom
        repo_url = "https://github.com/franksunye/StockWise" # Standard repository link
        maintenance_url = f"{repo_url}/actions/workflows/almanac_maintenance.yml"
        
        alert_content = (
            f"### ðŸš¨ StockWise è¿è¡Œå¼‚å¸¸: é»„åŽ†ç”Ÿæˆå¤±è´¥\n\n"
            f"**ç›®æ ‡æ—¥æœŸ**: {target_date or 'N/A'}\n"
            f"**æŠ¥é”™åŽŸå› **: `{str(e)}`\n"
            f"**æ—¥å¿—è·¯å¾„**: `almanac_generator.py`\n\n"
            f"> [ç‚¹å‡»æ­¤å¤„æ‰‹åŠ¨é‡è¯•æˆ–è¡¥è·‘]({maintenance_url})\n\n"
            f"è¯·æ£€æŸ¥ GitHub Actions åŽå°æˆ–æ•°æ®æŽ¥å£çŠ¶æ€ã€‚"
        )
        send_wecom_notification(alert_content, mentioned_mobile_list=ADMIN_MOBILES)
        
        return False
    finally:
        conn.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--date", help="Single target date (YYYY-MM-DD)", default=None)
    parser.add_argument("--start-date", help="Batch start date (YYYY-MM-DD)", default=None)
    parser.add_argument("--end-date", help="Batch end date (YYYY-MM-DD)", default=None)
    args = parser.parse_args()
    
    if args.start_date and args.end_date:
        start = datetime.strptime(args.start_date, "%Y-%m-%d")
        end = datetime.strptime(args.end_date, "%Y-%m-%d")
        current = start
        logger.info(f"ðŸš€ Starting Batch Almanac Generation: {args.start_date} to {args.end_date}")
        all_success = True
        while current <= end:
            d_str = current.strftime("%Y-%m-%d")
            # Only generate for days that have trading data (sh000001)
            if not generate_almanac(d_str):
                all_success = False
            current += timedelta(days=1)
        if not all_success:
            sys.exit(1)
    else:
        logger.info(f"ðŸš€ Starting Rule-based Almanac Generator for {args.date or 'latest data'}")
        if not generate_almanac(args.date):
            sys.exit(1)


