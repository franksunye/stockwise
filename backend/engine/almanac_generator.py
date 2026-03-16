import sqlite3
import json
import traceback
import sys
import os
import argparse
import uuid
from datetime import datetime, timedelta
import time

# --- Time-awareness constants ---
# Nasdaq data freshness window (Beijing Time):
#   US markets close at 4:00 PM ET ≈ 5:00 AM Beijing (winter) / 4:00 AM (summer).
#   A-share markets close at 15:00 Beijing.
#
#   Valid "overnight" window: 05:00 – 15:00 Beijing
#     - After 05:00 AM: US just closed, Nasdaq data is the freshest "overnight" close.
#     - Before 15:00 PM: The data is still relevant for today's A-share session.
#     - After 15:00 PM: A-share closed; tonight's US session hasn't started yet.
#       The Nasdaq data in AkShare is from LAST NIGHT, stale for T+1 prediction.
#     - 00:00 – 05:00 AM: US may still be trading, data is incomplete/stale.
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
        
        logger.info(f"🚀 Generating Almanac for Target Date: {target_date} (Using data context from {actual_price_date})")
        t_start = time.time()
        facts_bundle = get_or_generate_market_facts(actual_price_date)
        t_facts = time.time()
        logger.info(f"⏱️ Stage 1: Market Facts fetched in {t_facts - t_start:.2f}s")
        facts = facts_bundle.get("facts", {})
        facts_quality = facts_bundle.get("quality", {})
        gate_pass = bool(facts_quality.get("gate_pass"))
        if not gate_pass:
            logger.warning(f"Market facts quality gate failed for {actual_price_date}: {facts_quality.get('flags', [])}")
            try:
                quality_flags = facts_quality.get("flags", [])
                alert_content = (
                    "### ⚠️ StockWise Data Quality Alert: Almanac fallback rules in use\n\n"
                    f"**Target Date**: {target_date or 'N/A'}\n"
                    f"**Fact Date**: {actual_price_date}\n"
                    f"**Flags**: `{', '.join(quality_flags) if quality_flags else 'unknown'}`\n\n"
                    "Almanac generation continues with full rule-based content. Please monitor upstream data coverage."
                )
                send_wecom_notification(alert_content, mentioned_mobile_list=ADMIN_MOBILES)
            except Exception:
                logger.warning("Failed to send almanac data-quality alert to ADMIN", exc_info=True)

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
        # (05:00–15:00 Beijing). Outside this window, the data is either stale
        # (afternoon/evening: last night's close) or incomplete (late night: US still trading).
        now_beijing = datetime.now(BEIJING_TZ)
        is_nasdaq_fresh = NASDAQ_FRESH_START_HOUR <= now_beijing.hour < NASDAQ_FRESH_END_HOUR
        
        if not is_nasdaq_fresh:
            logger.info(f"⏰ Nasdaq gating: Current time {now_beijing.strftime('%H:%M')} outside fresh window [{NASDAQ_FRESH_START_HOUR}:00–{NASDAQ_FRESH_END_HOUR}:00) → Nasdaq data is STALE, will be skipped")
        else:
            logger.info(f"✅ Nasdaq gating: Current time {now_beijing.strftime('%H:%M')} within fresh window [{NASDAQ_FRESH_START_HOUR}:00–{NASDAQ_FRESH_END_HOUR}:00) → Nasdaq data is FRESH")
        
        # 1. Macro Context (Global & Domestic)
        t_macro_start = time.time()
        macro_data = provider.get_macro_context(skip_nasdaq=not is_nasdaq_fresh)
        t_macro_end = time.time()
        nasdaq_change = macro_data.get("nasdaq", "N/A")
        logger.info(f"📊 Global Context: Nasdaq Change = {nasdaq_change} (fresh={is_nasdaq_fresh}) [fetched in {t_macro_end - t_macro_start:.2f}s]")
        
        # 2. Sector Flows (Money Flow) from Fact Layer
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
            # Default fallback for inverse if API doesn't provide it
            inverse_currents = [{"name": "高位接盘股", "flow": "退潮"}]
            if breadth_type == "bull": inverse_currents = [{"name": "避险防守", "flow": "抽血"}]

        # --- 3. The Scorecard (Rules Engine - Dynamic & Humanistic) --- #
        # Use target_date as seed for deterministic daily variety
        import random
        seed_val = int(target_date.replace('-', ''))
        rng = random.Random(seed_val)

        weekday = datetime.strptime(target_date, "%Y-%m-%d").weekday() # 0=Mon, 4=Fri
        is_monday = (weekday == 0)
        is_friday = (weekday == 4)
        rule_key = f"{vol_type}_{breadth_type}"
        top_sector_name = main_currents[0]["name"] if main_currents else "主流赛道"

        # Categorized Action Pool (Enriched with Lifestyle & Psychology)
        ACTIONS = {
            "bull": {
                "yi": ["顺势而为", "持股待涨", "加仓主线", "逢低吸纳", "关注龙头", "坚定信心", "奖励午餐", "复盘逻辑", "深呼吸", "拥抱趋势"],
                "ji": ["盲目看空", "频繁换手", "恐高抛售", "逆势做空", "轻言顶见", "满仓赌博", "听信小道", "过度亢奋", "深夜盯盘", "杠杆操作"]
            },
            "bear": {
                "yi": ["持币观望", "风控为王", "严控仓位", "静待时机", "低吸伏击", "研习财报", "阅读非金融书", "早睡早起", "陪伴家人", "断网独处"],
                "ji": ["盲目抄底", "重仓死扛", "恐慌杀跌", "徒手接刀", "杠杆操作", "频繁操作", "情绪化下单", "抱怨市场", "借钱入市", "急于回本"]
            },
            "neutral": {
                "yi": ["高低切换", "控制仓位", "精研个股", "止盈减仓", "耐心蛰伏", "左侧埋伏", "整理笔记", "保持客观", "小量试错", "分批进场"],
                "ji": ["追涨杀跌", "满仓操作", "盲目跟风", "重仓单一", "频繁进出", "急于求成", "贪大求全", "赌徒心态", "忽视风险", "死磕个股"]
            }
        }

        # Select random actions based on market type
        pool = ACTIONS.get(breadth_type, ACTIONS["neutral"])
        selected_yi = rng.sample(pool["yi"], 2)
        selected_ji = rng.sample(pool["ji"], 2)
        action_strategy = f"宜：{' / '.join(selected_yi)} · 忌：{' / '.join(selected_ji)}"

        # 9-Quadrant Rich Templates (Massive Expansion)
        VARIANTS = {
            "high_bull": [
                {"tag": "势如破竹", "meteo": "烈火", "insight": f"大盘爆量长阳，场外资金如洪流般涌入【{top_sector_name}】。趋势一旦形成便难以阻挡，此刻唯有拥抱核心，静待繁花。"},
                {"tag": "雷霆万钧", "meteo": "赤龙", "insight": f"多头能量全面爆发，量能创下阶段新高。资金在【{top_sector_name}】疯狂扫货，赚钱效应进入高潮，建议紧扣领头羊。"},
                {"tag": "飞龙在天", "meteo": "红焰", "insight": f"成交急剧放大，大盘呈现俯冲式拉升。市场情绪已被彻底点燃，【{top_sector_name}】正在书写神话，趋势的力量正在最大化宣泄。"},
                {"tag": "金光叠影", "meteo": "虹光", "insight": f"主流板块全线飘红，巨额增量资金锁死【{top_sector_name}】。这种级别的攻击不仅是反弹，更是重塑，建议顺应天时，乘风而上。"}
            ],
            "flat_bull": [
                {"tag": "平流缓进", "meteo": "晨曦", "insight": f"稳扎稳打的普涨格局。虽然没有惊天动地的爆量，但【{top_sector_name}】的稳步上移说明支撑坚实。此时耐心比信心更重要。"},
                {"tag": "春风化雨", "meteo": "暖阳", "insight": f"市场呈现良性轮动，普涨温和且健康。资金正悄然向【{top_sector_name}】聚集，持股者只需静看云卷云舒，不必急于求成。"},
                {"tag": "细水长流", "meteo": "柔光", "insight": f"指数在缓慢推升中修复信心。主力在【{top_sector_name}】中慢条斯理地构建防线。这种温和的普涨往往才是最持久的赚钱良机。"},
                {"tag": "潜移默化", "meteo": "熹微", "insight": f"无需爆量，卖压已在盘整中消磨殆尽。市场正处于主升浪前的静谧时刻，【{top_sector_name}】的小步快跑是极佳的低吸信号。"}
            ],
            "low_bull": [
                {"tag": "暗香浮动", "meteo": "暖风", "insight": f"无量反弹往往伴随着分歧。虽有普涨之表，但能量尚未完全激活。主攻手在【{top_sector_name}】局部试探，防范冲高回落。"},
                {"tag": "枯木逢春", "meteo": "微芒", "insight": f"情绪先于资金修复，缩量普涨暗示卖盘枯竭。此时虽未见大龙，但【{top_sector_name}】的星星之火足以燎原，宜轻仓前瞻。"},
                {"tag": "蜻蜓点水", "meteo": "涟漪", "insight": f"存量资金的博弈表演。指数虽红，但底气不足。资金在【{top_sector_name}】中快进快出，切莫在缩量时当真，保持三分警惕。"},
                {"tag": "镜花水月", "meteo": "幻彩", "insight": f"看似普涨，实则自救。缩量反弹多为情绪脉冲，【{top_sector_name}】的活跃度难以支撑长久拉升。在这个阶段，控制贪念比抓住利润更重要。"}
            ],
            "high_neutral": [
                {"tag": "惊涛拍岸", "meteo": "奔流", "insight": f"巨量换手伴随着剧烈波动。多空双方在【{top_sector_name}】等主战场白刃相接。分歧即机会，去弱留强是当务之急。"},
                {"tag": "熔炉交锋", "meteo": "烈风", "insight": f"爆量震荡说明筹码正在大范围易手。资金从高位股加速撤离，转向寻找【{top_sector_name}】方向的避风港，波动中蕴含重生。"},
                {"tag": "龙虎决", "meteo": "狂澜", "insight": f"场面宏大却难以决出胜负。板块间剧烈换手，【{top_sector_name}】成为角力中心。这种高换手通常是变盘前奏，注意观察尾盘导向。"},
                {"tag": "烽火赤壁", "meteo": "火风", "insight": f"万亿成交下的惨烈博弈。虽然赚钱效应分化，但只要能守住【{top_sector_name}】核心阵地，便能在乱局中立于不败之地。"}
            ],
            "flat_neutral": [
                {"tag": "暗流涌动", "meteo": "晨雾", "insight": f"指数波澜不惊，但水底暗流湍急。属于典型的轮动行情，主战场虽见【{top_sector_name}】，但切忌后知后觉追高，应耐心埋伏。"},
                {"tag": "雾里看花", "meteo": "烟云", "insight": f"市场进入电风扇轮动模式。指数窄幅震荡，资金在【{top_sector_name}】内部快速切换，考验心态的定力和投研的深度。"},
                {"tag": "罗生门", "meteo": "薄暮", "insight": f"多空信息交织，指数陷入僵局。看似平稳的背后，【{top_sector_name}】正经历惨烈的去杠杆与再平衡。此时不动如山，方为智者。"},
                {"tag": "混沌未明", "meteo": "微雨", "insight": f"典型的平衡木博弈。指数在极小范围内起伏，资金在【{top_sector_name}】中反复横跳寻找方向。这是对交易者耐心最极端的考验。"}
            ],
            "low_neutral": [
                {"tag": "静水深流", "meteo": "止水", "insight": f"地量震荡，市场犹如进入垃圾时间。主力进入蛰伏状态，资金普遍缺乏攻击意愿。场外休息或极轻仓防守是上策，静待真龙。"},
                {"tag": "古潭微波", "meteo": "寒江", "insight": f"量能降至冰点，市场呈现失血状态。与其在【{top_sector_name}】微小的波动中沉浮，不如抽身而退，研学逻辑，静修其心。"},
                {"tag": "平湖秋月", "meteo": "清霜", "insight": f"一切都慢了下来。量能缩无可缩，大盘仿佛失去了心跳。此时不必在【{top_sector_name}】中苦苦寻觅机会，最好的机会是休息。"},
                {"tag": "绝声谷", "meteo": "空茫", "insight": f"全场肃静。交易者在观望，大鳄在潜伏。无量震荡是市场最寂寞的时刻，【{top_sector_name}】的冷清正是最好的防御理由。"}
            ],
            "high_bear": [
                {"tag": "泥沙俱下", "meteo": "罡风", "insight": f"放量大跌是最危险的信号，系统性风险正在疯狂宣泄。即使【{top_sector_name}】有局部抵抗，也难挡大势颓靡，离场休息是唯一的修行。"},
                {"tag": "金石裂变", "meteo": "沉雷", "insight": f"恐慌盘如潮水涌出，爆量下跌不言底。多头在【{top_sector_name}】的防线层层崩溃，风控是此时唯一的最高信条，不可有侥幸。"},
                {"tag": "万马奔腾", "meteo": "黑潮", "insight": f"大势已去，巨量抛单无情摧毁了所有技术位。资金正不计代价撤离，甚至波及【{top_sector_name}】。这种时刻，多留一毫秒都是危险。"},
                {"tag": "天崩地裂", "meteo": "陨石", "insight": f"极端恐慌。场内流动性迅速枯竭，抛压如大雪崩般倾泻而下。此刻任何试图拯救【{top_sector_name}】的行为都是徒劳，唯有抽身避险。"}
            ],
            "flat_bear": [
                {"tag": "落叶知秋", "meteo": "寒霜", "insight": f"阴跌绵绵，钝刀肉最是消磨意志。虽然抛压未见高潮，但重心持续下移。在右侧信号出现前，任何抄底行为本质都是一场劫难。"},
                {"tag": "冷雨萧瑟", "meteo": "细雨", "insight": f"市场重心在无声中下坠。赚钱效应降至冰点，即便是曾强势的【{top_sector_name}】也显露疲态。宜缩衣节食以此度过寒冬。"},
                {"tag": "秋风扫叶", "meteo": "苦风", "insight": f"阴云密布。抛压虽然不重，但买盘意愿更低。指数在慢性失血中阴跌，【{top_sector_name}】的抵抗也显得软弱无力。"},
                {"tag": "覆巢之下", "meteo": "铅云", "insight": f"大盘呈现典型的阴跌通道。没有波澜的下跌才是最难应付的慢性折磨。如果你还在纠结【{top_sector_name}】的补涨，请先看透系统风险。"}
            ],
            "low_bear": [
                {"tag": "倒春寒", "meteo": "深水", "insight": f"缩量普跌意味着买盘彻底消失。市场处于极度脆弱的真空期，静水深处潜伏着最后一次绝望洗盘。黎明前的黑暗最为难熬。"},
                {"tag": "冰封千里", "meteo": "玄霜", "insight": f"情绪进入极寒状态，能量枯竭。此时盲目割肉或盲目抄底皆非良策，守住残存的本金，静待冰雪消融，冬去春来。"},
                {"tag": "枯潭死水", "meteo": "幽渊", "insight": f"大盘已失去博弈价值。缩量普跌说明即便想离场的资金也找不到对手盘。此时的【{top_sector_name}】已无生意可言，专注场外生活。"},
                {"tag": "蝉噪林逾静", "meteo": "荒野", "insight": f"极度缩量后的普跌。这往往是最后一段绝望的心理防线考验。此时多想无益，关上电脑，去呼吸新鲜空气。"}
            ]
        }

        # Select variant & add day modifiers
        variant_list = VARIANTS.get(rule_key, VARIANTS["low_neutral"])
        selected = rng.choice(variant_list)
        
        mood_tag = selected["tag"]
        meteorology = selected["meteo"]
        template = selected["insight"]
        degraded = not gate_pass

        # Global Enrichment (Nasdaq) — Time-gated
        # Only inject Nasdaq narrative when the data is genuinely "overnight" fresh.
        nasdaq_impact = None
        if (not degraded) and nasdaq_change != "N/A" and is_nasdaq_fresh:
            try:
                nasdaq_val = float(nasdaq_change.replace('%', ''))
                if nasdaq_val > 1.0:
                    template += f" 受到隔夜美股（纳指{nasdaq_change}）走强映射，今天 A 股有望迎来积极的开盘情绪。"
                    nasdaq_impact = "bullish"
                elif nasdaq_val < -1.2:
                    template += f" 受隔夜纳指（{nasdaq_change}）压力传导，外围环境略显低迷，开盘需提防情绪砸盘。"
                    nasdaq_impact = "bearish"
                else:
                    nasdaq_impact = "neutral"
            except: pass
        elif not is_nasdaq_fresh:
            nasdaq_impact = "stale_skipped"
            logger.info(f"⏭️  Nasdaq enrichment skipped: data not fresh at {now_beijing.strftime('%H:%M')}")

        # Temporal Context Enrichment
        temporal_impact = "none"
        if (not degraded) and is_monday:
            template = "【周一开篇】" + template + " 本周趋势将由此定调。"
            temporal_impact = "monday"
        elif (not degraded) and is_friday:
            template = "【周五收官】" + template + " 周末政策面动向及消息博弈将是关键。"
            temporal_impact = "friday"
        
        extra_suffix = None
        if (not degraded) and rng.random() < 0.4: # 40% chance for a "lucky charm" or extra advice
            extra_suffix = rng.choice([
                " 心如止水，方能看透迷雾。",
                " 记住，本金比利润更重要。",
                " 所有的机会都是等出来的。",
                " 弱水三千，只取一瓢饮。",
                " 趋势是你的朋友，而非敌人。",
                " 善战者之胜，无智名，无勇功。",
                " 胜可知，而不可为。",
                " 买入靠机会，卖出靠忍耐。",
                " 市场不会关门，机会永远都在。",
                " 宁可错过，不要做错。",
                " 止损是交易的一部分，像呼吸一样自然。",
                " 不要试图接住下坠的飞刀。",
                " 第一准则是保住本金，第二准才是参考第一条。",
                " 利润是市场给你的奖金，不是你应得的薪水。",
                " 逆势而为往往是毁灭的开始。",
                " 只有在潮水退去时，才知道谁在裸泳。",
                " 风险来自你不知道自己在做什么。",
                " 耐心是交易者最昂贵的资产。",
                " 别在别人的贪婪中迷失，别在别人的恐惧中战栗。",
                " 每一笔交易都该有它必须存在的逻辑。",
                " 行情的演绎，往往在绝望中诞生，在分歧中成长。",
                " 市场是反人性的，学会与自己的本能对抗。",
                " 交易不仅是金钱的博弈，更是灵魂的修行。",
                " 进场前的思考，重于进场后的祈祷。",
                " 成功的交易者，都是概率的信徒。",
                " 保持敬畏，市场永远是对的。",
                " 复盘是为了在未来不再犯同样的错误。",
                " 所谓盘感，是建立在海量数据上的直觉。",
                " 复利是世界第八大奇迹，别让亏损打断它。",
                " 不要爱上你的持仓，它只是一个数字。",
                " 孤独是交易者的常态，享受这种静谧。",
                " 好的交易往往是枯燥甚至乏味的。",
                " 在喧嚣中保持冷峻，在低谷中保持温和。"
            ])
            template += extra_suffix

        # Compile final JSON payloads
        entropy_payload = {
            "score": heat_score,
            "label": f"{heat_score}% · {breadth_label[:2]}",
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
                    "ratio": round(float(breadth_ratio), 3),
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
            logger.info(f"✅ Almanac Updated for {target_date} -> {mood_tag} (Trace saved)")
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
            logger.info(f"✅ Almanac Inserted for {target_date} -> {mood_tag} (Trace saved)")
        
        t_end = time.time()
        logger.info(f"✨ Almanac generation completed for {target_date} in total {t_end - t_start:.2f}s")
        
        conn.commit()
        return True

    except Exception as e:
        error_msg = traceback.format_exc()
        logger.error(f"❌ Almanac Generation Failed: {error_msg}")
        
        # 🚨 Notify Admin via WeCom
        repo_url = "https://github.com/franksunye/StockWise" # Standard repository link
        maintenance_url = f"{repo_url}/actions/workflows/almanac_maintenance.yml"
        
        alert_content = (
            f"### 🚨 StockWise 运行异常: 黄历生成失败\n\n"
            f"**目标日期**: {target_date or 'N/A'}\n"
            f"**报错原因**: `{str(e)}`\n"
            f"**日志路径**: `almanac_generator.py`\n\n"
            f"> [点击此处手动重试或补跑]({maintenance_url})\n\n"
            f"请检查 GitHub Actions 后台或数据接口状态。"
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
        logger.info(f"🚀 Starting Batch Almanac Generation: {args.start_date} to {args.end_date}")
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
        logger.info(f"🚀 Starting Rule-based Almanac Generator for {args.date or 'latest data'}")
        if not generate_almanac(args.date):
            sys.exit(1)
