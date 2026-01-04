from typing import Dict, Any, List

def normalize_ai_response(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Standardize the data format returned by LLM to ensure consistent storage structure.
    This acts as an Anti-Corruption Layer (ACL) between the LLM and the Database.
    """
    if not isinstance(data, dict):
        return {}

    # 1. Normalize news_analysis (Must be List[str])
    # LLM often returns a single string instead of a list when there is only one news item.
    news = data.get("news_analysis", [])
    if isinstance(news, str):
        # Fix: "Single string" -> ["Single string"]
        data["news_analysis"] = [news]
    elif not isinstance(news, list):
        # Fix: Null/Other -> []
        data["news_analysis"] = []
    
    # Ensure all elements are strings
    data["news_analysis"] = [str(n) for n in data["news_analysis"] if n]


    # 2. Normalize reasoning_trace (Must be List[Dict])
    # Ensure it's a list, even if empty
    trace = data.get("reasoning_trace", [])
    if not isinstance(trace, list):
        data["reasoning_trace"] = []
    
    # 3. Normalize tactics (Must be Dict with 'holding', 'empty', 'general')
    if "tactics" not in data or not isinstance(data["tactics"], dict):
        data["tactics"] = {
            "holding": [],
            "empty": [],
            "general": []
        }
    else:
        # Ensure sub-keys exist
        for key in ["holding", "empty", "general"]:
            if key not in data["tactics"] or not isinstance(data["tactics"][key], list):
                data["tactics"][key] = []

    # 4. Normalize key_levels (Must be Dict)
    if "key_levels" not in data or not isinstance(data["key_levels"], dict):
        data["key_levels"] = {
            "support": 0,
            "resistance": 0,
            "stop_loss": 0
        }

    return data
