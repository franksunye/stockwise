"""
Metaphor Engine: The Sidecar interpretation layer for StockWise.
Translates cold quantitative data into warm, intuitive visual metaphors (Silent Math).
Ensures zero-impact on core trading logic through a decoupled sidecar pattern.
"""

from typing import Dict, Any, Optional
import math

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
        
        # 1. Base Strategy: Interpret by Signal & Confidence
        if signal == 'Long':
            if confidence >= 0.8:
                theme = "能量涌现"
                almanac = "宜：顺风起帆；吉：良辰吉日"
                icon_state = "pulse_high"
                color_hue = "indigo-emerald"
                mood = "晴空"
            else:
                theme = "微光潜行"
                almanac = "宜：逢低播种；平：静待花开"
                icon_state = "breathing_up"
                color_hue = "slate-indigo"
                mood = "微光"
        elif signal == 'Short':
            theme = "暗影规避"
            almanac = "忌：高位接力；防：贪海无涯"
            icon_state = "constrict"
            color_hue = "rose-slate"
            mood = "雷阵雨"
        else: # Side / Waiting
            theme = "静水深流"
            almanac = "宜：闭目养神；吉：深水潜伏"
            icon_state = "stable_circle"
            color_hue = "slate-gray"
            mood = "晨雾"

        # 2. Advanced: Indicator Overlays (Silent Math)
        # We handle market data cautiously to ensure decoupling
        indicator_clues = []
        if market_data:
            rsi = market_data.get('rsi', 50)
            if rsi > 70:
                indicator_clues.append("磁场过载")
            elif rsi < 30:
                indicator_clues.append("能量枯竭点")
            
            # MA Slope as Energy
            ma5 = market_data.get('ma5', 0)
            ma20 = market_data.get('ma20', 0)
            if ma5 > ma20 and ma20 > 0:
                indicator_clues.append("动能填充中")

        return {
            "token": theme,
            "almanac": almanac,
            "visual_state": icon_state, # Used for Silent Math symbols
            "aesthetic": {
                "hue": color_hue,
                "mood": mood,
                "dynamic_clues": indicator_clues
            },
            "meta_version": "v4.1-alpha"
        }

# Global Instance if needed for singleton behavior
metaphor_engine = MetaphorEngine()
