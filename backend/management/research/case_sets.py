from __future__ import annotations

from typing import Dict, List


ResearchCase = Dict[str, object]


PRESET_CASE_SETS: Dict[str, List[ResearchCase]] = {
    "poc_baseline": [
        {
            "symbol": "02171",
            "entry_date": "2026-03-09",
            "entry_price": 13.92,
            "position_size": 3000.0,
            "label": "02171_case_a",
            "note": "快速进入 ProfitProtection 的正样本。",
        },
        {
            "symbol": "02171",
            "entry_date": "2026-03-18",
            "entry_price": 16.62,
            "position_size": 3000.0,
            "label": "02171_case_b",
            "note": "BreakoutPending -> FailureRisk -> BreakoutPending。",
        },
        {
            "symbol": "02171",
            "entry_date": "2026-03-24",
            "entry_price": 15.54,
            "position_size": 3000.0,
            "label": "02171_case_c",
            "note": "FailureRisk -> BreakoutPending -> ProfitProtection。",
        },
        {
            "symbol": "01167",
            "entry_date": "2026-03-18",
            "entry_price": 6.93,
            "position_size": 3000.0,
            "label": "01167_case_a",
            "note": "FailureRisk 持续的对照样本。",
        },
        {
            "symbol": "01167",
            "entry_date": "2026-03-23",
            "entry_price": 6.23,
            "position_size": 3000.0,
            "label": "01167_case_b",
            "note": "低位反弹直接进入 ProfitProtection。",
        },
    ],
    "harmful_low_focus": [
        {
            "symbol": "000988",
            "entry_date": "2026-03-18",
            "entry_price": 114.78,
            "position_size": 3000.0,
            "label": "000988_20260318",
            "note": "FailureRisk -> EntryTriggered -> FailureRisk -> EntryTriggered -> FailureRisk。",
        },
        {
            "symbol": "000988",
            "entry_date": "2026-03-23",
            "entry_price": 113.34,
            "position_size": 3000.0,
            "label": "000988_20260323",
            "note": "FailureRisk -> EntryTriggered -> FailureRisk。",
        },
        {
            "symbol": "002837",
            "entry_date": "2026-03-23",
            "entry_price": 98.0,
            "position_size": 3000.0,
            "label": "002837_20260323",
            "note": "连续 FailureRisk，但早期 PnL 微修复后再次转坏。",
        },
        {
            "symbol": "00700",
            "entry_date": "2026-03-20",
            "entry_price": 508.0,
            "position_size": 3000.0,
            "label": "00700_20260320",
            "note": "连续 FailureRisk，被可修复特征误判为 early_mixed。",
        },
        {
            "symbol": "002837",
            "entry_date": "2026-03-18",
            "entry_price": 106.68,
            "position_size": 3000.0,
            "label": "002837_20260318",
            "note": "EntryTriggered 持续无确认，后续转入 FailureRisk。",
        },
        {
            "symbol": "01810",
            "entry_date": "2026-03-23",
            "entry_price": 32.06,
            "position_size": 3000.0,
            "label": "01810_20260323",
            "note": "FailureRisk -> EntryTriggered，之后未能真正重建结构。",
        },
        {
            "symbol": "300015",
            "entry_date": "2026-03-23",
            "entry_price": 9.6,
            "position_size": 3000.0,
            "label": "300015_20260323",
            "note": "连续 FailureRisk，PnL 微修复但未获得任何确认。",
        },
    ],
}


def get_case_set(name: str) -> List[ResearchCase]:
    try:
        return [dict(case) for case in PRESET_CASE_SETS[name]]
    except KeyError as exc:
        raise KeyError(f"Unknown case set: {name}") from exc
