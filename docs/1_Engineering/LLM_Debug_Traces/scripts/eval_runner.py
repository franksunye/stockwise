import argparse
import asyncio
import json
import os
import sys
import time
from dataclasses import asdict
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

WORKSPACE_ROOT = "/Users/yesun/Code/stockwise"
sys.path.insert(0, WORKSPACE_ROOT)

from backend.engine.llm_client import LLMClient
from backend.engine.parsers import parse_ai_response_with_diagnostics
from backend.engine.schema_normalizer import normalize_ai_response


BASE_DIR = Path(WORKSPACE_ROOT) / "docs" / "7_Debug_Traces"
PROMPT_DIR = BASE_DIR / "prompts"
RESULTS_DIR = BASE_DIR / "results"


LEGACY_SIGNALS = {"Long", "Short", "Side"}
FOUR_STATE_SIGNALS = {"TriggeredLong", "Watch", "RiskOff", "NoSetup"}


def _load_text(path_str: str) -> str:
    path = Path(path_str)
    if not path.is_absolute():
        path = BASE_DIR / path
    return path.read_text(encoding="utf-8")


def _signal_mode_allowed(mode: str) -> set[str]:
    if mode == "legacy":
        return LEGACY_SIGNALS
    if mode == "four_state":
        return FOUR_STATE_SIGNALS
    if mode == "any":
        return LEGACY_SIGNALS | FOUR_STATE_SIGNALS
    return LEGACY_SIGNALS


def _map_layer1_to_signal(layer1_status: str, signal_mode: str) -> Optional[str]:
    if not layer1_status:
        return None
    if signal_mode == "four_state":
        return layer1_status
    if signal_mode == "legacy":
        return "Long" if layer1_status == "TriggeredLong" else "Side"
    return None


def _extract_confidence(obj: Dict[str, Any]) -> Optional[float]:
    val = obj.get("confidence")
    if isinstance(val, (int, float)):
        return float(val)
    if isinstance(val, str) and val.endswith("%"):
        try:
            return float(val.strip("%")) / 100.0
        except ValueError:
            return None
    try:
        return float(val)
    except (TypeError, ValueError):
        return None


def _extract_raw_dict(content: Optional[str]) -> Dict[str, Any]:
    if not content:
        return {}
    from backend.engine.parsers import _extract_json_block, _parse_dict_funnel  # internal helper reuse

    json_block = _extract_json_block(content)
    if not json_block:
        return {}
    try:
        data, _ = _parse_dict_funnel(json_block)
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def _check_tactics_contract(obj: Dict[str, Any]) -> Dict[str, Any]:
    tactics = obj.get("tactics")
    buckets = ["holding_profit", "holding_loss", "empty"]
    result = {
        "present": isinstance(tactics, dict),
        "all_buckets_present": False,
        "all_lists": False,
        "all_len_2": False,
        "compliant": False,
    }
    if not isinstance(tactics, dict):
        return result
    result["all_buckets_present"] = all(bucket in tactics for bucket in buckets)
    lists_ok = True
    len_ok = True
    for bucket in buckets:
        items = tactics.get(bucket)
        if not isinstance(items, list):
            lists_ok = False
            len_ok = False
            continue
        if len(items) != 2:
            len_ok = False
    result["all_lists"] = lists_ok
    result["all_len_2"] = len_ok
    result["compliant"] = result["all_buckets_present"] and result["all_lists"] and result["all_len_2"]
    return result


def _check_key_levels_contract(obj: Dict[str, Any]) -> Dict[str, Any]:
    kl = obj.get("key_levels")
    result = {
        "present": isinstance(kl, dict),
        "support_len_2": False,
        "resistance_len_2": False,
        "semantic_order_ok": False,
        "compliant": False,
    }
    if not isinstance(kl, dict):
        return result
    support = kl.get("immediate_support")
    resistance = kl.get("immediate_resistance")
    close = _extract_float(obj.get("close_anchor")) if "close_anchor" in obj else None
    result["support_len_2"] = isinstance(support, list) and len(support) == 2
    result["resistance_len_2"] = isinstance(resistance, list) and len(resistance) == 2
    if result["support_len_2"] and result["resistance_len_2"]:
        try:
            l1 = float(support[0])
            l2 = float(support[1])
            r1 = float(resistance[0])
            r2 = float(resistance[1])
            semantic_ok = l2 < l1 and r2 > r1
            if close is not None:
                semantic_ok = semantic_ok and l1 <= close and r1 >= close
            result["semantic_order_ok"] = semantic_ok
        except (TypeError, ValueError):
            result["semantic_order_ok"] = False
    result["compliant"] = result["support_len_2"] and result["resistance_len_2"] and result["semantic_order_ok"]
    return result


def _extract_float(val: Any) -> Optional[float]:
    try:
        return float(val)
    except (TypeError, ValueError):
        return None


def _detect_close_anchor(raw_user_prompt: str) -> Optional[float]:
    import re
    patterns = [
        r"收盘价\s*[(:：]\s*([0-9]+(?:\.[0-9]+)?)",
        r"\|\s*2026-03-12\s*\|[^|]*\|[^|]*\|[^|]*\|\s*([0-9]+(?:\.[0-9]+)?)\s*\|",
        r"今日收盘价\s*([0-9]+(?:\.[0-9]+)?)",
    ]
    for pattern in patterns:
        match = re.search(pattern, raw_user_prompt)
        if match:
            try:
                return float(match.group(1))
            except ValueError:
                continue
    return None


def _evaluate_case(case: Dict[str, Any], content: Optional[str], meta: Dict[str, Any], elapsed: float, user_prompt: str) -> Dict[str, Any]:
    signal_mode = case.get("signal_mode", "legacy")
    allowed_signals = _signal_mode_allowed(signal_mode)
    raw_dict = _extract_raw_dict(content)
    raw_signal = str(raw_dict.get("signal")) if raw_dict.get("signal") is not None else None
    raw_confidence = _extract_confidence(raw_dict) if raw_dict else None

    parse_success = False
    parse_diag: Dict[str, Any] | None = None
    parsed_model_dict: Dict[str, Any] | None = None
    parse_error: Optional[str] = None
    try:
        parsed_model, diag = parse_ai_response_with_diagnostics(content or "")
        parse_success = True
        parse_diag = asdict(diag)
        parsed_model_dict = parsed_model.model_dump(mode="json")
    except Exception as exc:
        parse_error = str(exc)

    normalized = normalize_ai_response(dict(raw_dict)) if raw_dict else {}
    close_anchor = _detect_close_anchor(user_prompt)
    if close_anchor is not None:
        raw_dict["close_anchor"] = close_anchor
        normalized["close_anchor"] = close_anchor
        if parsed_model_dict is not None:
            parsed_model_dict["close_anchor"] = close_anchor

    raw_tactics = _check_tactics_contract(raw_dict)
    normalized_tactics = _check_tactics_contract(normalized)
    raw_key_levels = _check_key_levels_contract(raw_dict)
    normalized_key_levels = _check_key_levels_contract(normalized)

    expected_layer1 = case.get("expected_layer1_status")
    expected_signal = _map_layer1_to_signal(expected_layer1, signal_mode) if expected_layer1 else None
    normalized_signal = normalized.get("signal")
    raw_enum_ok = raw_signal in allowed_signals if raw_signal is not None else False
    normalized_enum_ok = normalized_signal in allowed_signals if normalized_signal is not None else False
    layer1_alignment_ok = normalized_signal == expected_signal if expected_signal else None

    assertions: List[Dict[str, Any]] = []
    for assertion in case.get("assertions", []):
        name = assertion["name"]
        passed = True
        actual: Any = None
        if name == "raw_signal_in":
            actual = raw_signal
            passed = raw_signal in assertion.get("values", [])
        elif name == "normalized_signal_in":
            actual = normalized_signal
            passed = normalized_signal in assertion.get("values", [])
        elif name == "raw_confidence_gte":
            actual = raw_confidence
            passed = raw_confidence is not None and raw_confidence >= float(assertion["value"])
        elif name == "raw_confidence_lte":
            actual = raw_confidence
            passed = raw_confidence is not None and raw_confidence <= float(assertion["value"])
        elif name == "normalized_tactics_compliant":
            actual = normalized_tactics["compliant"]
            passed = bool(actual) is bool(assertion.get("value", True))
        elif name == "normalized_key_levels_compliant":
            actual = normalized_key_levels["compliant"]
            passed = bool(actual) is bool(assertion.get("value", True))
        elif name == "layer1_alignment":
            actual = layer1_alignment_ok
            passed = bool(actual) is bool(assertion.get("value", True))
        elif name == "raw_enum_compliant":
            actual = raw_enum_ok
            passed = bool(actual) is bool(assertion.get("value", True))
        elif name == "parse_success":
            actual = parse_success
            passed = bool(actual) is bool(assertion.get("value", True))
        assertions.append({"name": name, "passed": passed, "actual": actual, "expected": assertion.get("value", assertion.get("values"))})

    return {
        "case_id": case["id"],
        "group": case.get("group"),
        "signal_mode": signal_mode,
        "meta": meta,
        "latency_s": round(elapsed, 3),
        "raw": {
            "signal": raw_signal,
            "confidence": raw_confidence,
            "enum_compliant": raw_enum_ok,
            "tactics_contract": raw_tactics,
            "key_levels_contract": raw_key_levels,
            "content": content,
        },
        "parser": {
            "parse_success": parse_success,
            "parse_error": parse_error,
            "diagnostics": parse_diag,
            "parsed_model": parsed_model_dict,
        },
        "normalized": {
            "signal": normalized_signal,
            "confidence": _extract_confidence(normalized) if normalized else None,
            "enum_compliant": normalized_enum_ok,
            "tactics_contract": normalized_tactics,
            "key_levels_contract": normalized_key_levels,
            "layer1_expected_signal": expected_signal,
            "layer1_alignment_ok": layer1_alignment_ok,
            "key_levels_meta": normalized.get("key_levels_meta"),
            "output": normalized,
        },
        "assertions": assertions,
        "all_assertions_passed": all(item["passed"] for item in assertions) if assertions else True,
    }


def _build_summary(results: List[Dict[str, Any]]) -> Dict[str, Any]:
    total = len(results)
    parse_success_count = sum(1 for r in results if r["parser"]["parse_success"])
    raw_enum_ok_count = sum(1 for r in results if r["raw"]["enum_compliant"])
    normalized_enum_ok_count = sum(1 for r in results if r["normalized"]["enum_compliant"])
    tactics_ok_count = sum(1 for r in results if r["normalized"]["tactics_contract"].get("compliant"))
    key_levels_ok_count = sum(1 for r in results if r["normalized"]["key_levels_contract"].get("compliant"))
    assertion_ok_count = sum(1 for r in results if r["all_assertions_passed"])
    latencies = [r["latency_s"] for r in results if isinstance(r["latency_s"], (int, float))]
    tokens = [r["meta"].get("total_tokens", 0) for r in results if r["meta"].get("total_tokens", 0)]

    by_group: Dict[str, Dict[str, Any]] = {}
    for r in results:
        group = r.get("group") or "ungrouped"
        g = by_group.setdefault(group, {"cases": 0, "assertion_pass": 0, "avg_latency_s": 0.0, "avg_total_tokens": 0.0})
        g["cases"] += 1
        if r["all_assertions_passed"]:
            g["assertion_pass"] += 1

    for group in by_group:
        group_rows = [r for r in results if (r.get("group") or "ungrouped") == group]
        group_latencies = [r["latency_s"] for r in group_rows]
        group_tokens = [r["meta"].get("total_tokens", 0) for r in group_rows if r["meta"].get("total_tokens", 0)]
        by_group[group]["avg_latency_s"] = round(sum(group_latencies) / len(group_latencies), 3) if group_latencies else 0.0
        by_group[group]["avg_total_tokens"] = round(sum(group_tokens) / len(group_tokens), 1) if group_tokens else 0.0

    return {
        "total_cases": total,
        "parse_success_rate": round(parse_success_count / total, 4) if total else 0.0,
        "raw_enum_compliance_rate": round(raw_enum_ok_count / total, 4) if total else 0.0,
        "normalized_enum_compliance_rate": round(normalized_enum_ok_count / total, 4) if total else 0.0,
        "normalized_tactics_compliance_rate": round(tactics_ok_count / total, 4) if total else 0.0,
        "normalized_key_levels_compliance_rate": round(key_levels_ok_count / total, 4) if total else 0.0,
        "assertion_pass_rate": round(assertion_ok_count / total, 4) if total else 0.0,
        "avg_latency_s": round(sum(latencies) / len(latencies), 3) if latencies else 0.0,
        "avg_total_tokens": round(sum(tokens) / len(tokens), 1) if tokens else 0.0,
        "by_group": by_group,
    }


async def _run_case(
    client: LLMClient,
    case: Dict[str, Any],
    *,
    temperature: float,
    max_tokens: int,
    retries: int,
    retry_delay_s: float,
) -> Dict[str, Any]:
    system_prompt = _load_text(case["system_prompt"])
    user_prompt = _load_text(case["user_prompt"])
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]
    last_content: Optional[str] = None
    last_meta: Dict[str, Any] = {}
    last_elapsed = 0.0

    for attempt in range(retries + 1):
        start = time.time()
        content, meta = await client.chat_async(messages, temperature=temperature, max_tokens=max_tokens)
        elapsed = time.time() - start
        last_content = content
        last_meta = meta
        last_elapsed = elapsed

        error_text = str((meta or {}).get("error") or "")
        capacity_error = "Too Many Requests" in error_text or "MODEL_CAPACITY_EXHAUSTED" in error_text or "No capacity available" in error_text
        if not capacity_error:
            break
        if attempt < retries:
            wait_s = retry_delay_s * (attempt + 1)
            print(f"   Capacity limited, retrying in {wait_s:.0f}s...")
            await asyncio.sleep(wait_s)

    return _evaluate_case(case, last_content, last_meta, last_elapsed, user_prompt)


async def main() -> int:
    parser = argparse.ArgumentParser(description="Unified prompt eval runner for docs/7_Debug_Traces.")
    parser.add_argument("--manifest", default=str(BASE_DIR / "eval_manifest.json"), help="Path to eval manifest JSON.")
    parser.add_argument("--group", default="", help="Optional group filter.")
    parser.add_argument("--case", default="", help="Optional case id filter.")
    parser.add_argument("--output-dir", default=str(RESULTS_DIR / "eval_runs"), help="Directory for eval outputs.")
    parser.add_argument("--provider", default="gemini_local")
    parser.add_argument("--model", default="gemini-3-flash")
    parser.add_argument("--base-url", default="http://127.0.0.1:8045")
    parser.add_argument("--api-key", default="dummy")
    parser.add_argument("--temperature", type=float, default=0.7)
    parser.add_argument("--max-tokens", type=int, default=8192)
    parser.add_argument("--cooldown-s", type=float, default=20.0, help="Sleep between cases to avoid hammering local Gemini.")
    parser.add_argument("--retries", type=int, default=1, help="Retry capacity-limited cases.")
    parser.add_argument("--retry-delay-s", type=float, default=25.0, help="Base delay before retry on capacity errors.")
    args = parser.parse_args()

    manifest = json.loads(Path(args.manifest).read_text(encoding="utf-8"))
    cases = manifest.get("cases", [])
    if args.group:
        cases = [case for case in cases if case.get("group") == args.group]
    if args.case:
        cases = [case for case in cases if case.get("id") == args.case]
    if not cases:
        raise SystemExit("No eval cases selected.")

    client = LLMClient(args.provider, base_url=args.base_url, model=args.model, api_key=args.api_key)
    run_id = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_root = Path(args.output_dir) / run_id
    output_root.mkdir(parents=True, exist_ok=True)

    results: List[Dict[str, Any]] = []
    for case in cases:
        print(f"\n--- RUNNING EVAL CASE: {case['id']} ---")
        result = await _run_case(
            client,
            case,
            temperature=args.temperature,
            max_tokens=args.max_tokens,
            retries=args.retries,
            retry_delay_s=args.retry_delay_s,
        )
        print(
            "   Done | raw_signal={raw} | normalized_signal={norm} | tokens={tokens} | assertions={assertions}".format(
                raw=result["raw"]["signal"],
                norm=result["normalized"]["signal"],
                tokens=result["meta"].get("total_tokens"),
                assertions=result["all_assertions_passed"],
            )
        )
        results.append(result)
        if args.cooldown_s > 0 and case != cases[-1]:
            print(f"   Cooling down for {args.cooldown_s:.0f}s...")
            await asyncio.sleep(args.cooldown_s)

    summary = _build_summary(results)
    payload = {
        "run_id": run_id,
        "manifest": {
            "path": args.manifest,
            "case_count": len(cases),
        },
        "provider": {
            "provider": args.provider,
            "model": args.model,
            "base_url": args.base_url,
            "temperature": args.temperature,
            "max_tokens": args.max_tokens,
            "cooldown_s": args.cooldown_s,
            "retries": args.retries,
            "retry_delay_s": args.retry_delay_s,
        },
        "summary": summary,
        "results": results,
    }

    (output_root / "eval_results.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    (output_root / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n✅ Eval run saved to {output_root}")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
