from typing import Dict, Any, List

def normalize_ai_response(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Standardize the data format returned by LLM to ensure consistent storage structure.
    This acts as an Anti-Corruption Layer (ACL) between the LLM and the Database.
    """
    if not isinstance(data, dict):
        return {}

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
    
    trace = data["reasoning_trace"]
    if not isinstance(trace, list):
        data["reasoning_trace"] = []
    
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
        if kl.get("immediate_support") and not kl.get("support"):
            kl["support"] = kl["immediate_support"][0] if kl["immediate_support"] else 0
        if kl.get("strong_support") and not kl.get("support"):
            try: kl["support"] = float(kl["strong_support"])
            except: pass
            
        if kl.get("immediate_resistance") and not kl.get("resistance"):
            kl["resistance"] = kl["immediate_resistance"][0] if kl["immediate_resistance"] else 0
        if kl.get("strong_resistance") and not kl.get("resistance"):
            try: kl["resistance"] = float(kl["strong_resistance"])
            except: pass
            
        if kl.get("stop_loss_reference") and not kl.get("stop_loss"):
            try: kl["stop_loss"] = float(kl["stop_loss_reference"])
            except: pass

    return data
