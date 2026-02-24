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
        random.seed(seed_val)

        # 2. Market Condition Variables
        rsi = market_data.get('rsi', 50) if market_data else 50
        ma5 = market_data.get('ma5', 0) if market_data else 0
        ma20 = market_data.get('ma20', 0) if market_data else 0
        is_uptrend = (ma5 > ma20 > 0)

        # 3. Rich Variant Pools
        POOLS = {
            "high_bull": { # Long + High Confidence
                "tokens": ["势如破竹", "飞龙在天", "雷霆万钧", "金光叠影", "气贯长虹", "绝尘而去"],
                "actions": ["宜：加筹乘风 / 忌：恐高弃马", "宜：重仓持股 / 忌：中途落车", "宜：顺风起帆 / 忌：微利即逃", "宜：守株待兔 / 忌：频繁调仓"],
                "moods": ["烈火", "骄阳", "赤龙", "长虹"],
                "hues": "indigo-emerald"
            },
            "mid_bull": { # Long + Medium/Low Confidence
                "tokens": ["微光潜行", "暗香浮动", "枯木逢春", "春风化雨", "小步快跑", "潜移默化"],
                "actions": ["宜：逢低播种 / 忌：激进追高", "宜：底仓待变 / 忌：满仓博弈", "宜：细水长流 / 忌：急于求成", "宜：步步为营 / 忌：后知后觉"],
                "moods": ["晨曦", "微光", "暖阳", "和风"],
                "hues": "slate-indigo"
            },
            "bear": { # Short
                "tokens": ["暗影规避", "泥沙俱下", "落叶知秋", "冷雨萧瑟", "金石裂变", "绝迹空山"],
                "actions": ["忌：高位接力 / 宜：岸边观火", "忌：徒手接刀 / 宜：缩衣节食", "忌：盲目抄底 / 宜：止损断腕", "忌：死扛到底 / 宜：轻装上阵"],
                "moods": ["雷阵雨", "罡风", "寒星", "残月"],
                "hues": "rose-slate"
            },
            "wait": { # Side / Neural
                "tokens": ["静水深流", "雾里看花", "暗流涌动", "蛰伏静待", "混沌未明", "心如止水"],
                "actions": ["宜：闭目养神 / 忌：盲动乱序", "宜：深水潜伏 / 忌：随波逐流", "宜：静待变盘 / 忌：频繁操作", "宜：磨刀练兵 / 忌：情绪下单"],
                "moods": ["晨雾", "停云", "微雨", "星海"],
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
        theme = random.choice(selected["tokens"])
        almanac = random.choice(selected["actions"])
        mood = random.choice(selected["moods"])
        color_hue = selected["hues"]

        # 5. Meteorology Overlays based on RSI
        if rsi > 75:
            mood = "酷暑" if category != "bear" else "回光"
        elif rsi < 25:
            mood = "大雪" if category != "wait" else "冰封"

        # 6. Wisdom Pearl (The "Humanity" touch)
        WISDOM_POOL = [
            "心如止水，方能看透迷雾。",
            "记住，本金比利润更重要。",
            "所有的机会都是等出来的。",
            "弱水三千，只取一瓢饮。",
            "趋势是你的朋友，而非敌人。",
            "善战者之胜，无智名，无勇功。",
            "胜可知，而不可为。",
            "买入靠机会，卖出靠忍耐。",
            "市场不会关门，机会永远都在。",
            "宁可错过，不要做错。",
            "止损是交易的一部分，像呼吸一样自然。",
            "不要试图接住下坠的飞刀。",
            "第一准则是保住本金。",
            "利润是市场给你的奖金。",
            "逆势而为往往是毁灭的开始。",
            "耐心是交易者最昂贵的资产。",
            "别在别人的贪婪中迷失。",
            "每一笔交易都该有它的逻辑。",
            "学会与自己的本能对抗。",
            "进场前的思考，重于进场后的祈祷。",
            "保持敬畏，市场永远是对的。",
            "孤独是交易者的常态。",
            "在喧嚣中保持冷峻。"
        ]
        
        wisdom = ""
        if random.random() < 0.4:
            wisdom = random.choice(WISDOM_POOL)

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
            "meta_version": "v4.3-humanity"
        }

# Global Instance
metaphor_engine = MetaphorEngine()
