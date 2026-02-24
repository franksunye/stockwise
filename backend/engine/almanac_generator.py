import sqlite3
import json
import traceback
import sys
import os
import argparse
from datetime import datetime, timedelta

current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(current_dir)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

try:
    from backend.database import get_connection
    from backend.logger import logger
    from backend.context.provider import MarketContextProvider
except ImportError:
    from database import get_connection
    from logger import logger
    from backend.context.provider import MarketContextProvider

def generate_almanac(target_date=None):
    """
    Rules-based Global Market Almanac Generator.
    Zero-LLM dependency for maximum determinism and speed.
    """
    conn = get_connection()
    try:
        cursor = conn.cursor()
        
        if not target_date:
            cursor.execute("SELECT MAX(date) FROM daily_prices WHERE symbol = 'sh000001'")
            row = cursor.fetchone()
            if row and row[0]:
                target_date = row[0]
            else:
                target_date = datetime.now().strftime("%Y-%m-%d")

        # --- 1. Fetch Entropy (Volume & Breadth) --- #
        # We use sh000001 as the volume proxy for market entropy
        cursor.execute("""
            SELECT date, volume FROM daily_prices 
            WHERE symbol = 'sh000001' AND date <= ? 
            ORDER BY date DESC LIMIT 6
        """, (target_date,))
        rows = cursor.fetchall()
        
        if not rows or rows[0][0] != target_date:
            logger.warning(f"No valid trading data for proxy sh000001 on {target_date}.")
            return False

        current_vol = rows[0][1]
        past_vols = [r[1] for r in rows[1:] if r[1] is not None]
        avg_vol = sum(past_vols) / len(past_vols) if past_vols else current_vol

        vol_ratio = current_vol / avg_vol if avg_vol > 0 else 1.0
        
        # Breadth
        cursor.execute("""
            SELECT
                SUM(CASE WHEN change_percent > 0 THEN 1 ELSE 0 END) as winners,
                SUM(CASE WHEN change_percent < 0 THEN 1 ELSE 0 END) as losers,
                COUNT(*) as total
            FROM daily_prices 
            WHERE date = ? AND length(symbol) != 5
        """, (target_date,))
        b_row = cursor.fetchone()
        winners = b_row[0] or 0
        losers = b_row[1] or 0
        total_stocks = b_row[2] or 1

        breadth_ratio = winners / (winners + losers) if (winners + losers) > 0 else 0.5
        heat_score = int(breadth_ratio * 100)

        # Quantitative Classification
        if vol_ratio >= 1.25:
            vol_label = "显著放量"
            vol_type = "high"
        elif vol_ratio <= 0.75:
            vol_label = "显著缩量"
            vol_type = "low"
        else:
            vol_label = "量能平稳"
            vol_type = "flat"

        if breadth_ratio >= 0.70:
            breadth_label = "普涨格局"
            breadth_type = "bull"
        elif breadth_ratio <= 0.30:
            breadth_label = "普跌格局"
            breadth_type = "bear"
        else:
            breadth_label = "震荡分化"
            breadth_type = "neutral"

        # --- 2. Sector Currents (Money Flow) --- #
        provider = MarketContextProvider()
        flow_data = provider.get_market_flow_context()
        
        # Simplified parsing of AkShare's returned comma-separated string
        # Expected: "A板块(+5.1亿), B板块(+2.3亿)"
        top_sectors = flow_data.get("top_inflow_sectors", "")
        sector_parts = [s.strip() for s in top_sectors.split(',') if s.strip()]
        
        main_currents = []
        if sector_parts and sector_parts[0] != "暂无数据":
            for s in sector_parts:
                if '(' in s and ')' in s:
                    name = s[:s.index('(')].strip()
                    flow = s[s.index('(')+1:s.index(')')].strip()
                    main_currents.append({"name": name, "flow": flow})
                else:
                    main_currents.append({"name": s, "flow": ""})
        
        # Default fallback for inverse if API doesn't provide it via sector flows context
        # In a full implementation we'd fetch Top Outflow, but here we synthesize
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
                {"tag": "静水深流", "meteo": "止水", "insight": f"地量震荡，市场犹如进入垃圾时间。主力进入蛰伏状态，资金普遍缺乏攻击意愿。空仓或极轻仓防守是上策，静待真龙。"},
                {"tag": "古潭微波", "meteo": "寒江", "insight": f"量能降至冰点，市场呈现失血状态。与其在【{top_sector_name}】微小的波动中沉浮，不如抽身而退，研学逻辑，静修其心。"},
                {"tag": "平湖秋月", "meteo": "清霜", "insight": f"一切都慢了下来。量能缩无可缩，大盘仿佛失去了心跳。此时不必在【{top_sector_name}】中苦苦寻觅机会，最好的机会是休息。"},
                {"tag": "绝声谷", "meteo": "空茫", "insight": f"全场肃静。交易者在观望，大鳄在潜伏。无量震荡是市场最寂寞的时刻，【{top_sector_name}】的冷清正是最好的防御理由。"}
            ],
            "high_bear": [
                {"tag": "泥沙俱下", "meteo": "罡风", "insight": f"放量大跌是最危险的信号，系统性风险正在疯狂宣泄。即使【{top_sector_name}】有局部抵抗，也难挡大势颓靡，空仓是唯一的修行。"},
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

        # Temporal Context Enrichment
        if is_monday:
            template = "【周一开篇】" + template + " 本周趋势将由此定调。"
        elif is_friday:
            template = "【周五收官】" + template + " 周末政策面动向及消息博弈将是关键。"
        
        if rng.random() < 0.4: # 40% chance for a "lucky charm" or extra advice
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

        # --- 4. Persist to DB --- #
        cursor.execute("SELECT 1 FROM market_almanacs WHERE target_date = ?", (target_date,))
        exists = cursor.fetchone()

        if exists:
            cursor.execute("""
                UPDATE market_almanacs SET 
                    mood_tag = ?, action_strategy = ?, meteorology = ?, 
                    market_entropy = ?, sector_currents = ?, ai_insight = ?,
                    created_at = datetime('now', '+8 hours')
                WHERE target_date = ?
            """, (
                mood_tag, action_strategy, meteorology,
                json.dumps(entropy_payload, ensure_ascii=False),
                json.dumps(sector_payload, ensure_ascii=False),
                template, target_date
            ))
            logger.info(f"✅ Almanac Updated for {target_date} -> {mood_tag}")
        else:
            cursor.execute("""
                INSERT INTO market_almanacs 
                (target_date, mood_tag, action_strategy, meteorology, market_entropy, sector_currents, ai_insight)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                target_date, mood_tag, action_strategy, meteorology,
                json.dumps(entropy_payload, ensure_ascii=False),
                json.dumps(sector_payload, ensure_ascii=False),
                template
            ))
            logger.info(f"✅ Almanac Inserted for {target_date} -> {mood_tag}")
        
        conn.commit()
        return True

    except Exception as e:
        logger.error(f"❌ Almanac Generation Failed: {traceback.format_exc()}")
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
        while current <= end:
            d_str = current.strftime("%Y-%m-%d")
            # Only generate for days that have trading data (sh000001)
            generate_almanac(d_str)
            current += timedelta(days=1)
    else:
        logger.info(f"🚀 Starting Rule-based Almanac Generator for {args.date or 'latest data'}")
        generate_almanac(args.date)
