from typing import Dict, Any, List
from threading import Lock
import os
import copy

import re
from backend.logger import logger


_PRIORITY_RANK = {"P1": 1, "P2": 2, "P3": 3}
_TACTIC_BUCKETS = ["holding_profit", "holding_loss", "empty"]
_TACTIC_PRICE_FIELDS = ["target_price", "stop_advance_price", "stop_loss_price", "buy_zone_price"]
_QUALITY_LOCK = Lock()
_QUALITY_STATS = {
    "total": 0,
    "fully_compliant": 0,
    "fixed_count": 0,
    "scenario_repairs": 0,
}
_QUALITY_REPORT_INTERVAL = int(os.getenv("TACTICS_QUALITY_REPORT_INTERVAL", "50"))
_QUALITY_ALERT_MIN_SAMPLES = int(os.getenv("TACTICS_QUALITY_ALERT_MIN_SAMPLES", "30"))
_QUALITY_ALERT_THRESHOLD = float(os.getenv("TACTICS_QUALITY_ALERT_THRESHOLD", "0.90"))

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


def _to_float(val: Any) -> float | None:
    if isinstance(val, list):
        if not val:
            return None
        val = val[0]
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


def _to_float_list(val: Any) -> List[float]:
    if isinstance(val, list):
        out = []
        for x in val:
            try:
                out.append(float(x))
            except (ValueError, TypeError):
                pass
        return out
    n = _to_float(val)
    return [n] if n is not None else []


def _positive_or_none(val: float | None) -> float | None:
    if val is None:
        return None
    return val if val > 0 else None


def _pick_nearest_higher(base: float, candidates: List[float]) -> float | None:
    highs = sorted([x for x in candidates if x > base])
    return highs[0] if highs else None


def _pick_nearest_lower(base: float, candidates: List[float]) -> float | None:
    lows = sorted([x for x in candidates if x < base], reverse=True)
    return lows[0] if lows else None


def _ensure_two_key_levels(kl: Dict[str, Any]) -> Dict[str, str]:
    meta = {
        "immediate_support_source": "model",
        "immediate_resistance_source": "model",
    }

    raw_support = [x for x in _to_float_list(kl.get("immediate_support")) if x > 0]
    raw_resistance = [x for x in _to_float_list(kl.get("immediate_resistance")) if x > 0]
    strong_support = [x for x in _to_float_list(kl.get("strong_support")) if x > 0]
    strong_resistance = [x for x in _to_float_list(kl.get("strong_resistance")) if x > 0]
    support_scalar = _positive_or_none(_to_float(kl.get("support")))
    resistance_scalar = _positive_or_none(_to_float(kl.get("resistance")))
    stop_ref = _positive_or_none(_to_float(kl.get("stop_loss_reference"))) or _positive_or_none(_to_float(kl.get("stop_loss")))
    breakout = _positive_or_none(_to_float(kl.get("breakout_confirmation_level")))

    # Support: semantic order is [L1 nearest, L2 secondary], so L1 > L2.
    support_levels = sorted(list(set(raw_support)), reverse=True)
    if len(support_levels) >= 2:
        kl["immediate_support"] = support_levels[:2]
    else:
        meta["immediate_support_source"] = "derived"
        if support_levels:
            l1 = support_levels[0]
        else:
            l1_candidates = []
            if support_scalar is not None:
                l1_candidates.append(support_scalar)
            if strong_support:
                l1_candidates.append(max(strong_support))
            if stop_ref is not None:
                l1_candidates.append(stop_ref * 1.02)
            l1 = max(l1_candidates) if l1_candidates else 0.0

        l2_candidates = []
        if strong_support:
            l2_candidates.extend(strong_support)
        if support_scalar is not None:
            l2_candidates.append(support_scalar)
        if stop_ref is not None:
            l2_candidates.append(stop_ref)
        l2 = _pick_nearest_lower(l1, l2_candidates)
        if l2 is None:
            meta["immediate_support_source"] = "fallback"
            l2 = l1 * 0.985 if l1 > 0 else 0.0
        if l2 >= l1:
            l2 = l1 * 0.985 if l1 > 0 else 0.0
        kl["immediate_support"] = [round(l1, 4), round(l2, 4)]

    # Resistance: semantic order is [R1 nearest, R2 secondary], so R1 < R2.
    resistance_levels = sorted(list(set(raw_resistance)))
    if len(resistance_levels) >= 2:
        kl["immediate_resistance"] = resistance_levels[:2]
    else:
        meta["immediate_resistance_source"] = "derived"
        if resistance_levels:
            r1 = resistance_levels[0]
        else:
            r1_candidates = []
            if resistance_scalar is not None:
                r1_candidates.append(resistance_scalar)
            if strong_resistance:
                r1_candidates.append(min(strong_resistance))
            if breakout is not None:
                r1_candidates.append(breakout)
            r1 = min(r1_candidates) if r1_candidates else 0.0

        r2_candidates = []
        if strong_resistance:
            r2_candidates.extend(strong_resistance)
        if resistance_scalar is not None:
            r2_candidates.append(resistance_scalar)
        if breakout is not None:
            r2_candidates.append(breakout)
        r2 = _pick_nearest_higher(r1, r2_candidates)
        if r2 is None:
            meta["immediate_resistance_source"] = "fallback"
            r2 = r1 * 1.015 if r1 > 0 else 0.0
        if r2 <= r1:
            r2 = r1 * 1.015 if r1 > 0 else 0.0
        kl["immediate_resistance"] = [round(r1, 4), round(r2, 4)]

    return meta


def _normalize_priority(val: Any, fallback: str) -> str:
    p = str(val or "").upper()
    return p if p in _PRIORITY_RANK else fallback


def _default_tactic(category: str, idx: int) -> Dict[str, Any]:
    templates = {
        "holding_profit": [
            {"priority": "P1", "action": "持仓观察", "trigger": "不跌破一防位", "reason": "趋势未被破坏，先守纪律。"},
            {"priority": "P2", "action": "分批止盈预案", "trigger": "接近一攻位且动能放缓", "reason": "锁定波段利润，避免冲高回落。"},
        ],
        "holding_loss": [
            {"priority": "P1", "action": "严格止损", "trigger": "有效跌破一防位", "reason": "先控制回撤，避免亏损扩大。"},
            {"priority": "P2", "action": "反弹减仓", "trigger": "反抽至压力位但未能突破", "reason": "弱势反弹优先降风险。"},
        ],
        "empty": [
            {"priority": "P1", "action": "等待确认", "trigger": "回踩一防位企稳后再评估", "reason": "先等右侧信号，再考虑入场。"},
            {"priority": "P2", "action": "突破跟随预案", "trigger": "放量突破一攻位并站稳", "reason": "只做确定性，不做猜顶猜底。"},
        ],
    }
    base = templates.get(category, templates["empty"])[0 if idx <= 0 else 1].copy()
    for field in _TACTIC_PRICE_FIELDS:
        base[field] = None
    return base


def _normalize_tactic_item(item: Any, category: str, idx: int) -> Dict[str, Any]:
    if not isinstance(item, dict):
        return _default_tactic(category, idx)

    fallback = _default_tactic(category, idx)
    out: Dict[str, Any] = {
        "priority": _normalize_priority(item.get("priority"), fallback["priority"]),
        "action": str(item.get("action") or fallback["action"]).strip(),
        "trigger": str(item.get("trigger") or fallback["trigger"]).strip(),
        "reason": str(item.get("reason") or fallback["reason"]).strip(),
    }
    for field in _TACTIC_PRICE_FIELDS:
        out[field] = item.get(field, None)

    if not out["action"]:
        out["action"] = fallback["action"]
    if not out["trigger"]:
        out["trigger"] = fallback["trigger"]
    if not out["reason"]:
        out["reason"] = fallback["reason"]
    return out


def _dedupe_tactics(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    seen = set()
    deduped: List[Dict[str, Any]] = []
    for item in items:
        key = (
            str(item.get("action", "")).strip().lower(),
            str(item.get("trigger", "")).strip().lower(),
        )
        if key in seen:
            continue
        seen.add(key)
        deduped.append(item)
    return deduped


def _normalize_tactic_bucket(raw_items: Any, category: str, target_count: int = 2) -> List[Dict[str, Any]]:
    items = raw_items if isinstance(raw_items, list) else []
    normalized = [
        _normalize_tactic_item(item, category, idx)
        for idx, item in enumerate(items)
    ]
    normalized.sort(key=lambda x: _PRIORITY_RANK.get(str(x.get("priority", "P3")).upper(), 99))
    normalized = _dedupe_tactics(normalized)
    normalized = normalized[:target_count]
    while len(normalized) < target_count:
        normalized.append(_default_tactic(category, len(normalized)))
    return normalized


def _record_quality_metrics(raw_tactics: Dict[str, Any], normalized_tactics: Dict[str, Any]) -> None:
    if not isinstance(raw_tactics, dict):
        raw_tactics = {}

    compliant = True
    repairs = 0
    for category in _TACTIC_BUCKETS:
        raw_list = raw_tactics.get(category)
        norm_list = normalized_tactics.get(category, [])

        # Contract: exactly 2 items.
        if not isinstance(raw_list, list) or len(raw_list) != 2:
            compliant = False
            repairs += 1
            continue

        # Contract: distinct action+trigger between 2 items.
        keys = []
        for item in raw_list:
            if not isinstance(item, dict):
                compliant = False
                repairs += 1
                break
            key = (
                str(item.get("action", "")).strip().lower(),
                str(item.get("trigger", "")).strip().lower(),
            )
            keys.append(key)
        if len(keys) == 2 and keys[0] == keys[1]:
            compliant = False
            repairs += 1

        # Post state should be stable with 2 items.
        if len(norm_list) != 2:
            compliant = False
            repairs += 1

    with _QUALITY_LOCK:
        _QUALITY_STATS["total"] += 1
        if compliant:
            _QUALITY_STATS["fully_compliant"] += 1
        else:
            _QUALITY_STATS["fixed_count"] += 1
            _QUALITY_STATS["scenario_repairs"] += repairs

        total = _QUALITY_STATS["total"]
        compliant_total = _QUALITY_STATS["fully_compliant"]
        compliance_rate = compliant_total / total if total else 1.0

        if total % _QUALITY_REPORT_INTERVAL == 0:
            logger.info(
                "[TACTICS_QUALITY] total=%s compliant=%s fixed=%s repairs=%s rate=%.2f",
                total,
                _QUALITY_STATS["fully_compliant"],
                _QUALITY_STATS["fixed_count"],
                _QUALITY_STATS["scenario_repairs"],
                compliance_rate,
            )

        if (
            total >= _QUALITY_ALERT_MIN_SAMPLES
            and total % _QUALITY_REPORT_INTERVAL == 0
            and compliance_rate < _QUALITY_ALERT_THRESHOLD
        ):
            logger.warning(
                "[TACTICS_QUALITY_ALERT] compliance rate dropped: total=%s rate=%.2f threshold=%.2f",
                total,
                compliance_rate,
                _QUALITY_ALERT_THRESHOLD,
            )

def normalize_ai_response(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Standardize the data format returned by LLM...
    """
    if not isinstance(data, dict): return {}

    # ... (前序信号/新闻处理保持不变) ...

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
    raw_tactics_snapshot = copy.deepcopy(data.get("tactics")) if isinstance(data.get("tactics"), dict) else {}
    if "tactics" not in data or not isinstance(data["tactics"], dict):
        data["tactics"] = {
            "holding_profit": [],
            "holding_loss": [],
            "empty": []
        }
    else:
        # Ensure sub-keys exist for new structure
        for key in _TACTIC_BUCKETS:
            if key not in data["tactics"] or not isinstance(data["tactics"][key], list):
                data["tactics"][key] = []
        
        # Legacy support (migration during normalization if needed)
        if "holding" in data["tactics"] and not data["tactics"].get("holding_profit"):
             data["tactics"]["holding_profit"] = data["tactics"]["holding"]

    # 3.1 Enforce tactics contract:
    # each scenario must be exactly 2 strategy items with stable fields.
    for category in _TACTIC_BUCKETS:
        data["tactics"][category] = _normalize_tactic_bucket(data["tactics"].get(category), category, target_count=2)
        for item in data["tactics"][category]:
            if "buy_zone_price" in item:
                item["buy_zone_price"] = _semantic_normalize_price(item["buy_zone_price"], is_range=True)
            if "target_price" in item:
                item["target_price"] = _semantic_normalize_price(item["target_price"], is_range=False)
    _record_quality_metrics(raw_tactics_snapshot, data["tactics"])

    # Remove legacy buckets from normalized output.
    # Keep compatibility for input parsing/migration, but avoid leaking deprecated fields downstream.
    data["tactics"].pop("holding", None)
    data["tactics"].pop("general", None)

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
            kl["support"] = _to_float(kl["immediate_support"]) or 0.0
        if kl.get("strong_support") and not kl.get("support"):
            kl["support"] = _to_float(kl["strong_support"]) or 0.0
            
        if kl.get("immediate_resistance") and not kl.get("resistance"):
            kl["resistance"] = _to_float(kl["immediate_resistance"]) or 0.0
        if kl.get("strong_resistance") and not kl.get("resistance"):
            kl["resistance"] = _to_float(kl["strong_resistance"]) or 0.0
            
        if kl.get("stop_loss_reference") and not kl.get("stop_loss"):
            kl["stop_loss"] = _to_float(kl["stop_loss_reference"]) or 0.0

    # 4.1 Enforce key levels contract: immediate_support/resistance must both be length 2.
    if isinstance(data.get("key_levels"), dict):
        key_level_meta = _ensure_two_key_levels(data["key_levels"])
        data["key_levels_meta"] = {
            **(data.get("key_levels_meta") if isinstance(data.get("key_levels_meta"), dict) else {}),
            **key_level_meta,
        }

    return data
