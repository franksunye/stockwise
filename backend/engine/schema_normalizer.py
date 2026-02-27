from typing import Dict, Any, List

import re

def _semantic_normalize_price(val: Any, is_range: bool = False) -> Any:
    """
    语义化价格处理：
    1. 如果是区间 (is_range=True)，确保为 [min, max] 排序数组。
    2. 如果是单值，保持原样。
    3. 如果是多重水位，保持 LLM 给出的原始顺序。
    """
    if isinstance(val, list):
        # 过滤非数字
        nums = []
        for x in val:
            try: nums.append(float(x))
            except: pass
        
        if not nums: return val
        if is_range and len(nums) >= 2:
            return sorted(nums)[:2] # 取最小的两个作为区间边界
        return nums
    return val

def normalize_ai_response(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Standardize the data format returned by LLM...
    """
    if not isinstance(data, dict): return {}

    # ... (前序信号/新闻处理保持不变) ...

    # 处理 Tactics 中的价格语义
    if "tactics" in data and isinstance(data["tactics"], dict):
        for category in ["holding_profit", "holding_loss", "empty"]:
            if category in data["tactics"]:
                for item in data["tactics"][category]:
                    if "buy_zone_price" in item:
                        item["buy_zone_price"] = _semantic_normalize_price(item["buy_zone_price"], is_range=True)
                    if "target_price" in item:
                        item["target_price"] = _semantic_normalize_price(item["target_price"], is_range=False)

    # 处理 Key Levels 中的价格语义
    if "key_levels" in data and isinstance(data["key_levels"], dict):
        kl = data["key_levels"]
        for k in ["immediate_support", "immediate_resistance"]:
            if k in kl:
                kl[k] = _semantic_normalize_price(kl[k], is_range=False)
        for k in ["strong_support", "strong_resistance"]:
            if k in kl:
                kl[k] = _semantic_normalize_price(kl[k], is_range=True) # 强支撑通常也是个区间

    # 4. Normalize key_levels (Final structural normalization)
    # ... (保持原有的 legacy support 映射) ...

    # 0. Normalize Signal (Must be "Long", "Short", or "Side")
    # Handle cases where Enum string representation might have leaked (e.g. "SignalEnum.SIDE")
    if "signal" in data:
        sig = str(data["signal"])
        if "LONG" in sig.upper(): data["signal"] = "Long"
        elif "SHORT" in sig.upper(): data["signal"] = "Short"
        elif "SIDE" in sig.upper(): data["signal"] = "Side"
        elif sig not in ["Long", "Short", "Side"]:
            data["signal"] = "Side" # Default fallback
    else:
        data["signal"] = "Side"

    # 1. Normalize news_analysis (Must be List[str])
    # Ensure it's in the dict first
    if "news_analysis" not in data:
        data["news_analysis"] = []
        
    news = data["news_analysis"]
    if isinstance(news, str):
        # Fix: "Single string" -> ["Single string"]
        data["news_analysis"] = [news]
    elif not isinstance(news, list):
        # Fix: Null/Other -> []
        data["news_analysis"] = []
    
    # Ensure all elements are strings
    data["news_analysis"] = [str(n) for n in data["news_analysis"] if n]


    # 2. Normalize reasoning_trace (Must be List[Dict])
    if "reasoning_trace" not in data:
        data["reasoning_trace"] = []
    
    trace = data.get("reasoning_trace")
    if isinstance(trace, str) and trace:
        # Handle string-based trace (common in weak models)
        # Try to split by semicolon or comma to separate trend from momentum
        parts = re.split(r'[；;，,]', trace)
        if len(parts) > 1:
            data["reasoning_trace"] = [
                { "step": "trend", "data": parts[0].strip(), "conclusion": "趋势观察" },
                { "step": "momentum", "data": parts[1].strip(), "conclusion": "动能监测" },
                { "step": "decision", "data": "综合研判", "conclusion": str(data.get('summary', '观望'))[:10] }
            ]
        else:
            data["reasoning_trace"] = [{"step": "analysis", "data": trace, "conclusion": "AI综述"}]
    elif not isinstance(trace, list):
        data["reasoning_trace"] = []
    # 2.5 Normalize counter_argument (Must be str)
    if "counter_argument" not in data:
        data["counter_argument"] = ""
    elif not isinstance(data["counter_argument"], str):
        data["counter_argument"] = str(data["counter_argument"])
    
    # 3. Normalize tactics (Must be Dict with 'holding_profit', 'holding_loss', 'empty')
    if "tactics" not in data or not isinstance(data["tactics"], dict):
        data["tactics"] = {
            "holding_profit": [],
            "holding_loss": [],
            "empty": []
        }
    else:
        # Ensure sub-keys exist for new structure
        for key in ["holding_profit", "holding_loss", "empty"]:
            if key not in data["tactics"] or not isinstance(data["tactics"][key], list):
                data["tactics"][key] = []
        
        # Legacy support (migration during normalization if needed)
        if "holding" in data["tactics"] and not data["tactics"].get("holding_profit"):
             data["tactics"]["holding_profit"] = data["tactics"]["holding"]

    # 4. Normalize key_levels (Must be Dict)
    if "key_levels" not in data or not isinstance(data["key_levels"], dict):
        data["key_levels"] = {
            "immediate_support": [],
            "immediate_resistance": [],
            "strong_support": 0,
            "strong_resistance": 0,
            "breakout_confirmation_level": 0,
            "stop_loss_reference": 0
        }
    else:
        # Ensure new fields exist
        for key in ["immediate_support", "immediate_resistance"]:
            if key not in data["key_levels"] or not isinstance(data["key_levels"][key], list):
                data["key_levels"][key] = []
        
        for key in ["strong_support", "strong_resistance", "breakout_confirmation_level", "stop_loss_reference"]:
            if key not in data["key_levels"]:
                data["key_levels"][key] = 0
        
        # Legacy support: Auto-populate support/resistance/stop_loss from new fields if missing
        kl = data["key_levels"]
        
        def _get_float(val):
            if isinstance(val, list):
                val = val[0] if val else 0
            try:
                return float(val)
            except (ValueError, TypeError):
                return 0.0

        if kl.get("immediate_support") and not kl.get("support"):
            kl["support"] = _get_float(kl["immediate_support"])
        if kl.get("strong_support") and not kl.get("support"):
            kl["support"] = _get_float(kl["strong_support"])
            
        if kl.get("immediate_resistance") and not kl.get("resistance"):
            kl["resistance"] = _get_float(kl["immediate_resistance"])
        if kl.get("strong_resistance") and not kl.get("resistance"):
            kl["resistance"] = _get_float(kl["strong_resistance"])
            
        if kl.get("stop_loss_reference") and not kl.get("stop_loss"):
            kl["stop_loss"] = _get_float(kl["stop_loss_reference"])

    return data
