"""
Metaphor Engine: The Sidecar interpretation layer for StockWise.
Translates cold quantitative data into warm, intuitive visual metaphors (Silent Math).
Ensures zero-impact on core trading logic through a decoupled sidecar pattern.
"""

import random
import hashlib
from typing import Dict, Any, Optional
from datetime import datetime

class MetaphorEngine:
    @staticmethod
    def get_visual_story(prediction: Dict[str, Any], market_data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Main entry point for generating the visual metaphor.
        Args:
            prediction: Current AI prediction result (V2 schema)
            market_data: Optional current price/indicator data (RSI, MA, etc.)
        Returns:
            A dictionary containing visual tokens, metaphors, and aesthetic markers.
        """
        signal = prediction.get('signal', 'Side')
        confidence = prediction.get('confidence', 0.5)
        symbol = prediction.get('symbol', 'unknown')
        target_date = prediction.get('target_date', datetime.now().strftime('%Y-%m-%d'))
        
        # 1. Deterministic Daily Seed per Stock
        # Combine date and symbol to ensure same stock gets same metaphor on same day, 
        # but different stocks or different days get different ones.
        seed_str = f"{target_date}_{symbol}"
        seed_val = int(hashlib.md5(seed_str.encode()).hexdigest(), 16) % (2**32)
        rng = random.Random(seed_val)

        # 2. Market Condition Variables
        rsi = market_data.get('rsi', 50) if market_data else 50
        ma5 = market_data.get('ma5', 0) if market_data else 0
        ma20 = market_data.get('ma20', 0) if market_data else 0
        is_uptrend = (ma5 > ma20 > 0)

        # 3. Rich Variant Pools (Industrial-grade expansion aligned with ZISO DNA)
        POOLS = {
            "high_bull": { # Long + High Confidence (ZISO: The Rational Blunt Weapon - Trade)
                "tokens": [
                    "势如破竹", "飞龙在天", "雷霆万钧", "金光叠影", "气贯长虹", "绝尘而去", 
                    "龙吟九霄", "破浪乘风", "主升浪潮", "光芒万丈", "一骑绝尘", "直上青云",
                    "乾坤扭转", "红岩突围", "万马奔腾", "旭日东升", "铁律交易", "共振高潮"
                ],
                "actions": {
                    "yi": [
                        "顺势加仓", "握紧筹码", "乘胜追击", "上移止盈", "持股待涨", "让利润奔跑", 
                        "顺应趋势", "逢低吸纳", "看大做小", "享受复利", "拥抱主升", "格局打开",
                        "坚定持有", "右侧加注", "捕捉龙头", "极致聚焦", "冷酷交易", "主线守仓"
                    ],
                    "ji": [
                        "恐高抛售", "逆势做空", "轻易下车", "微利即逃", "左侧猜顶", "频繁换手", 
                        "听信杂音", "杞人忧天", "畏首畏尾", "拔掉鲜花", "落袋为安", "主观臆断",
                        "患得患失", "中途落车", "盲目换股", "赚了就跑", "看多做空", "纠结微波动"
                    ]
                },
                "moods": ["烈火", "骄阳", "赤龙", "长虹", "惊雷", "极昼", "紫气", "金辉", "熔炉", "沸点"],
                "hues": "indigo-emerald"
            },
            "mid_bull": { # Long + Medium/Low Confidence (ZISO: Rational Sanctuary - Seed)
                "tokens": [
                    "微光潜行", "暗香浮动", "枯木逢春", "春风化雨", "小步快跑", "潜移默化", 
                    "蓄势待发", "星火燎原", "初露锋芒", "渐入佳境", "润物无声", "含苞待放",
                    "水滴石穿", "暗流转暖", "黎明破晓", "小径通幽", "有序修复", "基石构建"
                ],
                "actions": {
                    "yi": [
                        "逢低播种", "底仓待变", "细水长流", "步步为营", "分批建仓", "耐心潜伏", 
                        "关注支撑", "右侧试错", "保持定力", "顺水推舟", "静待花开", "稳扎稳打",
                        "左侧埋伏", "低吸伏击", "研学逻辑", "小量试盘", "温和布局", "守株待兔"
                    ],
                    "ji": [
                        "激进追高", "满仓博弈", "急于求成", "后知后觉", "重仓单只", "追涨杀跌", 
                        "听消息炒", "盲目自信", "忘记止损", "孤注一掷", "心浮气躁", "重仓出击",
                        "情绪下单", "频繁止损", "焦虑盯盘", "打听小道", "过度意淫", "幻觉入场"
                    ]
                },
                "moods": ["晨曦", "微光", "暖阳", "和风", "春雨", "星芒", "初晴", "朝露", "新绿", "柔光"],
                "hues": "slate-indigo"
            },
            "bear": { # Short (ZISO: The Rational Blunt Weapon - Defense)
                "tokens": [
                    "暗影规避", "泥沙俱下", "落叶知秋", "冷雨萧瑟", "金石裂变", "绝迹空山", 
                    "凛冬将至", "狂风骤雨", "乌云压顶", "断崖坠落", "深渊凝视", "暮气沉沉",
                    "众木成林", "寒蝉凄切", "覆巢之下", "冰裂预警", "残阳如血", "绝望洗盘"
                ],
                "actions": {
                    "yi": [
                        "岸边观火", "缩衣节食", "止损断腕", "轻装上阵", "持币观望", "风控为王", 
                        "回归生活", "研习反思", "保护本金", "承认错误", "清仓避险", "修心养性",
                        "果断离场", "拒绝骗炮", "删APP断网", "阅读非金融书", "锻炼身体", "等待冰点"
                    ],
                    "ji": [
                        "高位接力", "徒手接刀", "盲目抄底", "死扛到底", "借钱加仓", "情绪失控", 
                        "心存侥幸", "逆势死磕", "急于翻本", "不设止损", "摊平亏损", "不甘失败",
                        "深夜焦虑", "到处找利好", "幻想反弹", "重仓搏杀", "赌徒心态", "怨天尤人"
                    ]
                },
                "moods": ["雷阵雨", "罡风", "寒星", "残月", "冰霜", "暗潮", "苦雨", "冷夜", "铅云", "幽渊"],
                "hues": "rose-slate"
            },
            "wait": { # Side / Neural (ZISO: The Rational Sanctuary - Silence)
                "tokens": [
                    "静水深流", "雾里看花", "暗流涌动", "蛰伏静待", "混沌未明", "心如止水", 
                    "静观其变", "韬光养晦", "平湖秋月", "风平浪静", "疑云密布", "按兵不动",
                    "罗生门", "围炉煮茶", "空旷荒原", "棋局焦灼", "等待风起", "收敛三角"
                ],
                "actions": {
                    "yi": [
                        "闭目养神", "深水潜伏", "静待变盘", "磨刀练兵", "控制手艺", "耐心旁观", 
                        "梳理逻辑", "场外休整", "寻找右侧", "高低切换", "整理复盘", "冷眼旁观",
                        "保持中性", "专注个股", "等待放量", "建立条件单", "去噪减压", "自我迭代"
                    ],
                    "ji": [
                        "盲动乱序", "随波逐流", "频繁操作", "情绪下单", "追高杀跌", "左右挨打", 
                        "耐不住寂寞", "赌徒心态", "主观臆断", "强行开仓", "打听小道", "过度意淫",
                        "追求满仓", "过度复盘", "死磕大盘", "妄图预测", "由于无聊交易", "乱扣扳机"
                    ]
                },
                "moods": ["晨雾", "停云", "微雨", "星海", "薄暮", "清霜", "孤月", "宿霭", "止水", "烟云"],
                "hues": "slate-gray"
            }
        }

        # 4. Selection Logic
        if signal == 'Long':
            category = "high_bull" if confidence >= 0.75 else "mid_bull"
        elif signal == 'Short':
            category = "bear"
        else:
            category = "wait"

        selected = POOLS[category]
        theme = rng.choice(selected["tokens"])
        
        # Dynamically compose the almanac action strategy (Systematic Variety)
        pool_actions = selected["actions"]
        yi_list = rng.sample(pool_actions["yi"], 2)
        ji_list = rng.sample(pool_actions["ji"], 2)
        almanac = f"宜：{' / '.join(yi_list)} · 忌：{' / '.join(ji_list)}"
        
        mood = rng.choice(selected["moods"])
        color_hue = selected["hues"]

        # 5. Meteorology Overlays based on RSI
        if rsi > 75:
            mood = "酷暑" if category != "bear" else "回光"
        elif rsi < 25:
            mood = "大雪" if category != "wait" else "冰封"

        # 6. Wisdom Pearl (Deeply integrated with ZISO Culture & Masters)
        WISDOM_POOL = [
            # ZISO Brand Mantras
            "知其白，守其黑。知行合一，守正出奇。",
            "记住，本金比利润更重要。风险来自你不知道自己在做什么。",
            "所有的机会都是等出来的。真正的猎人从不频繁射击。",
            "交易是你的钝器，不是你的手术刀。钝器重在纪律。",
            "大A没有新鲜事，只有不断重复的情绪轮回。",
            "别用肉身对抗算法，学会成为算法的一部分。",
            "弱水三千，只取一瓢饮。弱水是欲望，这一瓢才是系统。",
            "止损是交易的呼吸，不呼吸的人无法在深海生存。",
            "行情在绝望中诞生，在分歧中成长，在狂热中幻灭。",
            "放弃预测。优秀的交易者只做“如果...就...”的条件反射。",
            
            # Masters (Elder, Minervini, Dalio, Marks, Simons)
            "艾德勒：你的目标是成为一名优秀的交易者，而不是赚快钱。",
            "米内尔维尼：交易不仅是买什么，更是什么时候不买。",
            "达利欧：如果你不觉得尴尬，说明你没有在进化。",
            "霍华德·马克斯：你不能预测，但你可以做准备。",
            "西蒙斯：我们只相信模型，不相信眼泪。",
            "马克斯：在别人恐惧时贪婪，这不仅是格言，更是数学。",
            "利弗莫尔：钱是坐着赚来的，而不是动着赚来的。",
            "巴菲特：如果你不能看着你的股票跌去50%还面不改色，你就不该买。",
            "塔勒布：千万别向那些靠预测未来为生的人咨询任何事。",
            
            # Physical & Vivid Metaphors
            "跳楼机正在上升，但安全带坏了，你还要坐多久？",
            "在悬崖边跳舞确实刺激，但碎裂声响了你得跑得比光还快。",
            "市场是一面镜子，映出的只有你自己的贪婪与恐惧。",
            "没有成交量的上涨，就像没有地基的沙堡。",
            "别在别人的酒局里买单，那是他们的利润，你的教训。",
            "牛市是散户亏钱最多的地方，因为那时他们胆子最大。",
            "像石头一样沉稳，像机器一样冷酷。这就是知守之道。",
            "现在的噪音是万丈红尘，你的逻辑是那根定海神针。",
            "如果这就是你要死磕的高地，请先确认撤退路线是否通畅。"
        ]
        
        wisdom = ""
        if rng.random() < 0.6: # Increased wisdom chance for more cultural depth
            wisdom = rng.choice(WISDOM_POOL)

        # 7. Aesthetic Visual State (for symbols)
        icon_state = "stable_circle"
        if signal == 'Long':
            icon_state = "pulse_high" if confidence >= 0.8 else "breathing_up"
        elif signal == 'Short':
            icon_state = "constrict"
        
        # 8. Indicator Clues (Dynamic Hashtags)
        indicator_clues = []
        if rsi > 70: indicator_clues.append("超买预警")
        if rsi < 30: indicator_clues.append("超卖寻底")
        if is_uptrend: indicator_clues.append("均线多排")
        if ma5 < ma20 and ma20 > 0: indicator_clues.append("趋势承压")
        if confidence >= 0.85: indicator_clues.append("高度共振")
        if confidence <= 0.55: indicator_clues.append("分歧加剧")

        return {
            "token": theme,
            "almanac": almanac,
            "visual_state": icon_state,
            "wisdom": wisdom,
            "aesthetic": {
                "hue": color_hue,
                "mood": mood,
                "dynamic_clues": indicator_clues
            },
            "meta_version": "v5.0-industrial-ziso"
        }


# Global Instance
metaphor_engine = MetaphorEngine()
