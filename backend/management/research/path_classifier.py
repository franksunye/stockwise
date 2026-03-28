from __future__ import annotations

from typing import Any, Dict, List

from backend.management.domain.position_state import PositionState


def build_early_path_features(snapshots: List[PositionState], lookahead_days: int = 3) -> Dict[str, Any]:
    window = snapshots[: max(1, lookahead_days)]
    if not window:
        return {}

    first = window[0]
    min_pnl = min(s.unrealized_pnl_pct for s in window)
    max_pnl = max(s.unrealized_pnl_pct for s in window)
    risk_days = sum(1 for s in window if s.state_id == "FailureRisk")
    breakout_days = sum(1 for s in window if s.state_id in {"BreakoutPending", "TrendHolding"})
    riskoff_days = sum(1 for s in window if s.signal_state == "RiskOff")
    no_setup_days = sum(1 for s in window if s.signal_state == "NoSetup")
    triggered_days = sum(1 for s in window if s.signal_state == "TriggeredLong")
    positive_pnl_days = sum(1 for s in window if s.unrealized_pnl_pct > 0)
    support_breach_days = sum(1 for s in window if s.failed_breakout_risk)
    confidence_values = [s.confidence for s in window if s.confidence is not None]
    pnl_rebound_pct = window[-1].unrealized_pnl_pct - min_pnl
    state_sequence = [s.state_id for s in window]
    signal_sequence = [s.signal_state for s in window]
    pnl_improving_days = sum(
        1
        for idx in range(1, len(window))
        if window[idx].unrealized_pnl_pct > window[idx - 1].unrealized_pnl_pct
    )

    first_risk_idx = next((idx for idx, s in enumerate(window) if s.state_id == "FailureRisk"), None)
    recovery_days_after_risk = 0
    triggered_after_risk = 0
    breakout_after_risk = 0
    positive_pnl_after_risk = 0
    re_failure_after_recovery = 0
    risk_rebound_recovery = 0
    weak_recovery_without_signal = 0
    shallow_risk_repair_candidate = 0
    contained_rebuild_candidate = 0
    late_rebuild_seed_candidate = 0
    secondary_failure_loop_candidate = 0
    persistent_risk_but_positive_pnl_candidate = 0
    no_confirmation_entry_drift_candidate = 0
    if first_risk_idx is not None:
        after_risk = window[first_risk_idx + 1 :]
        for s in after_risk:
            if s.state_id != "FailureRisk":
                recovery_days_after_risk += 1
            if s.signal_state == "TriggeredLong":
                triggered_after_risk += 1
            if s.state_id in {"BreakoutPending", "TrendHolding", "ProfitProtection"}:
                breakout_after_risk += 1
            if s.unrealized_pnl_pct > 0:
                positive_pnl_after_risk += 1
        recovery_started = False
        for s in after_risk:
            if s.state_id != "FailureRisk":
                recovery_started = True
            elif recovery_started and s.state_id == "FailureRisk":
                re_failure_after_recovery += 1

        # Even if state_id remains FailureRisk for all 3 days, some cases have already
        # stopped deteriorating and are repairing in PnL terms. We mark those separately
        # so the scorer does not overreact to "risk days" alone.
        end_pnl_pct = window[-1].unrealized_pnl_pct
        if risk_days >= 2 and end_pnl_pct >= 0 and pnl_rebound_pct >= 0.03:
            risk_rebound_recovery = 1

        # A rebound without signal confirmation is materially weaker than a rebound that
        # regains TriggeredLong / BreakoutPending style confirmation.
        if (
            recovery_days_after_risk >= 1
            and triggered_after_risk == 0
            and breakout_after_risk == 0
            and signal_sequence[-1] == "NoSetup"
        ):
            weak_recovery_without_signal = 1

        # Some harmful false positives are not deep collapses: they spend the first
        # 2-3 days in FailureRisk, but losses remain shallow and PnL is already
        # improving. We mark them as "repair candidates" and let the scorer be more
        # conservative before pushing them into score_high.
        if (
            risk_days >= 2
            and pnl_improving_days >= 1
            and min_pnl > -0.05
            and window[-1].unrealized_pnl_pct > -0.02
            and support_breach_days <= 1
        ):
            shallow_risk_repair_candidate = 1

        # A stricter subset of shallow repair: drawdown stayed relatively contained
        # and price has already stopped slipping materially. This is our first-pass
        # proxy for "structure rebuild candidate" inside an early FailureRisk pocket.
        if (
            risk_days >= 2
            and pnl_improving_days >= 1
            and min_pnl > -0.02
            and window[-1].unrealized_pnl_pct > -0.01
            and support_breach_days <= 1
        ):
            contained_rebuild_candidate = 1

        # A very narrow "late rebuild seed" pattern: the first 3 days still look weak,
        # but the path started from EntryTriggered/NoSetup, drawdown stayed bounded,
        # and PnL has already stopped deteriorating. This targets the last small set of
        # harmful score_high false positives without broadly weakening the risk bucket.
        if (
            first.state_id == "EntryTriggered"
            and first.signal_state == "NoSetup"
            and risk_days >= 2
            and riskoff_days >= 2
            and breakout_days == 0
            and triggered_days == 0
            and support_breach_days == 0
            and pnl_improving_days >= 1
            and min_pnl > -0.05
            and window[-1].unrealized_pnl_pct > -0.045
        ):
            late_rebuild_seed_candidate = 1

        # Research-only: risk appears to "recover" only into EntryTriggered/NoSetup,
        # with no real confirmation, and then often fails again later.
        if (
            first.state_id == "FailureRisk"
            and recovery_days_after_risk >= 1
            and breakout_after_risk == 0
            and triggered_after_risk == 0
            and positive_pnl_after_risk >= 1
            and weak_recovery_without_signal == 1
        ):
            secondary_failure_loop_candidate = 1

    # Research-only: some harmful low-score cases sit in uninterrupted FailureRisk,
    # but PnL turns slightly positive without any state/signal confirmation.
    if (
        risk_days == len(window)
        and riskoff_days == len(window)
        and breakout_days == 0
        and triggered_days == 0
        and positive_pnl_days >= 1
    ):
        persistent_risk_but_positive_pnl_candidate = 1

    # Research-only: entry never gets confirmation, remains NoSetup, and PnL is still negative.
    if (
        first.state_id == "EntryTriggered"
        and first.signal_state == "NoSetup"
        and risk_days == 0
        and no_setup_days == len(window)
        and breakout_days == 0
        and triggered_days == 0
        and window[-1].unrealized_pnl_pct < 0
        and pnl_rebound_pct < 0.02
    ):
        no_confirmation_entry_drift_candidate = 1

    return {
        "lookahead_days": len(window),
        "entry_state": first.state_id,
        "entry_signal": first.signal_state,
        "state_sequence": state_sequence,
        "signal_sequence": signal_sequence,
        "pnl_improving_days": pnl_improving_days,
        "min_pnl_pct": min_pnl,
        "max_pnl_pct": max_pnl,
        "end_pnl_pct": window[-1].unrealized_pnl_pct,
        "pnl_rebound_pct": pnl_rebound_pct,
        "risk_days": risk_days,
        "breakout_days": breakout_days,
        "riskoff_days": riskoff_days,
        "no_setup_days": no_setup_days,
        "triggered_days": triggered_days,
        "positive_pnl_days": positive_pnl_days,
        "support_breach_days": support_breach_days,
        "recovery_days_after_risk": recovery_days_after_risk,
        "triggered_after_risk": triggered_after_risk,
        "breakout_after_risk": breakout_after_risk,
        "positive_pnl_after_risk": positive_pnl_after_risk,
        "re_failure_after_recovery": re_failure_after_recovery,
        "risk_rebound_recovery": risk_rebound_recovery,
        "weak_recovery_without_signal": weak_recovery_without_signal,
        "shallow_risk_repair_candidate": shallow_risk_repair_candidate,
        "contained_rebuild_candidate": contained_rebuild_candidate,
        "late_rebuild_seed_candidate": late_rebuild_seed_candidate,
        "secondary_failure_loop_candidate": secondary_failure_loop_candidate,
        "persistent_risk_but_positive_pnl_candidate": persistent_risk_but_positive_pnl_candidate,
        "no_confirmation_entry_drift_candidate": no_confirmation_entry_drift_candidate,
        "confidence_avg": (sum(confidence_values) / len(confidence_values)) if confidence_values else None,
    }


def compute_recovery_quality_score(features: Dict[str, Any]) -> int:
    if not features:
        return 0

    score = 0
    end_pnl_pct = float(features.get("end_pnl_pct", 0.0))
    pnl_rebound_pct = float(features.get("pnl_rebound_pct", 0.0))
    positive_pnl_days = int(features.get("positive_pnl_days", 0))
    pnl_improving_days = int(features.get("pnl_improving_days", 0))
    breakout_days = int(features.get("breakout_days", 0))
    breakout_after_risk = int(features.get("breakout_after_risk", 0))
    triggered_after_risk = int(features.get("triggered_after_risk", 0))
    support_breach_days = int(features.get("support_breach_days", 0))
    re_failure_after_recovery = int(features.get("re_failure_after_recovery", 0))
    risk_rebound_recovery = int(features.get("risk_rebound_recovery", 0))
    signal_sequence = list(features.get("signal_sequence", []))
    last_signal = signal_sequence[-1] if signal_sequence else ""

    if end_pnl_pct > 0:
        score += 2
    if pnl_rebound_pct >= 0.05:
        score += 2
    elif pnl_rebound_pct >= 0.03:
        score += 1
    if positive_pnl_days >= 2:
        score += 1
    if pnl_improving_days >= 2:
        score += 1
    if last_signal != "RiskOff":
        score += 1
    if breakout_days >= 1 or breakout_after_risk >= 1:
        score += 1
    if triggered_after_risk >= 1:
        score += 1
    if risk_rebound_recovery >= 1:
        score += 1
    if support_breach_days >= 1:
        score -= 1
    if re_failure_after_recovery >= 1:
        score -= 2

    return max(0, score)


def classify_early_path_risk(features: Dict[str, Any]) -> str:
    if not features:
        return "unknown"

    risk_days = int(features.get("risk_days", 0))
    riskoff_days = int(features.get("riskoff_days", 0))
    support_breach_days = int(features.get("support_breach_days", 0))
    min_pnl_pct = float(features.get("min_pnl_pct", 0.0))
    end_pnl_pct = float(features.get("end_pnl_pct", 0.0))
    breakout_days = int(features.get("breakout_days", 0))
    no_setup_days = int(features.get("no_setup_days", 0))
    triggered_days = int(features.get("triggered_days", 0))
    positive_pnl_days = int(features.get("positive_pnl_days", 0))
    pnl_rebound_pct = float(features.get("pnl_rebound_pct", 0.0))
    recovery_days_after_risk = int(features.get("recovery_days_after_risk", 0))
    breakout_after_risk = int(features.get("breakout_after_risk", 0))
    triggered_after_risk = int(features.get("triggered_after_risk", 0))
    positive_pnl_after_risk = int(features.get("positive_pnl_after_risk", 0))
    re_failure_after_recovery = int(features.get("re_failure_after_recovery", 0))
    risk_rebound_recovery = int(features.get("risk_rebound_recovery", 0))
    weak_recovery_without_signal = int(features.get("weak_recovery_without_signal", 0))
    shallow_risk_repair_candidate = int(features.get("shallow_risk_repair_candidate", 0))
    contained_rebuild_candidate = int(features.get("contained_rebuild_candidate", 0))
    late_rebuild_seed_candidate = int(features.get("late_rebuild_seed_candidate", 0))
    recovery_quality_score = compute_recovery_quality_score(features)

    if risk_days >= 2 and (riskoff_days >= 2 or support_breach_days >= 1 or min_pnl_pct <= -0.08):
        if (
            breakout_days >= 1
            and (
                triggered_days >= 1
                or positive_pnl_days >= 1
                or pnl_rebound_pct >= 0.05
                or breakout_after_risk >= 1
                or triggered_after_risk >= 1
                or positive_pnl_after_risk >= 1
                or recovery_quality_score >= 4
                or risk_rebound_recovery >= 1
                or shallow_risk_repair_candidate >= 1
            )
            and re_failure_after_recovery == 0
        ):
            return "early_mixed"
        if risk_rebound_recovery >= 1 and weak_recovery_without_signal == 0:
            return "early_mixed"
        if contained_rebuild_candidate >= 1:
            return "early_mixed"
        if late_rebuild_seed_candidate >= 1:
            return "early_mixed"
        if shallow_risk_repair_candidate >= 1 and recovery_quality_score >= 1:
            return "early_mixed"
        return "early_risk_dominant"

    if (
        risk_days >= 1
        and (breakout_days >= 1 or breakout_after_risk >= 1)
        and pnl_rebound_pct >= 0.04
        and min_pnl_pct > -0.10
        and (no_setup_days == 0 or triggered_days >= 1 or triggered_after_risk >= 1)
        and recovery_days_after_risk >= 1
        and re_failure_after_recovery == 0
    ):
        return "early_risk_then_recovery"

    if breakout_days >= 2 and risk_days == 0:
        return "early_breakout_observation"

    return "early_mixed"


def score_early_path_risk(features: Dict[str, Any]) -> int:
    if not features:
        return 0

    score = 0
    risk_days = int(features.get("risk_days", 0))
    riskoff_days = int(features.get("riskoff_days", 0))
    support_breach_days = int(features.get("support_breach_days", 0))
    breakout_days = int(features.get("breakout_days", 0))
    no_setup_days = int(features.get("no_setup_days", 0))
    triggered_days = int(features.get("triggered_days", 0))
    positive_pnl_days = int(features.get("positive_pnl_days", 0))
    min_pnl_pct = float(features.get("min_pnl_pct", 0.0))
    end_pnl_pct = float(features.get("end_pnl_pct", 0.0))
    pnl_rebound_pct = float(features.get("pnl_rebound_pct", 0.0))
    recovery_days_after_risk = int(features.get("recovery_days_after_risk", 0))
    breakout_after_risk = int(features.get("breakout_after_risk", 0))
    triggered_after_risk = int(features.get("triggered_after_risk", 0))
    positive_pnl_after_risk = int(features.get("positive_pnl_after_risk", 0))
    re_failure_after_recovery = int(features.get("re_failure_after_recovery", 0))
    risk_rebound_recovery = int(features.get("risk_rebound_recovery", 0))
    weak_recovery_without_signal = int(features.get("weak_recovery_without_signal", 0))
    shallow_risk_repair_candidate = int(features.get("shallow_risk_repair_candidate", 0))
    contained_rebuild_candidate = int(features.get("contained_rebuild_candidate", 0))
    late_rebuild_seed_candidate = int(features.get("late_rebuild_seed_candidate", 0))
    recovery_quality_score = compute_recovery_quality_score(features)
    confidence_avg = features.get("confidence_avg")
    confidence_avg = float(confidence_avg) if confidence_avg is not None else None
    entry_state = str(features.get("entry_state", ""))
    entry_signal = str(features.get("entry_signal", ""))

    score += risk_days * 2
    score += riskoff_days * 2
    score += support_breach_days * 3

    if min_pnl_pct <= -0.08:
        score += 3
    elif min_pnl_pct <= -0.05:
        score += 2
    elif min_pnl_pct < 0:
        score += 1

    if end_pnl_pct < 0:
        score += 1
    if no_setup_days >= 2:
        score += 1
    if entry_state == "FailureRisk":
        score += 2
    if entry_signal == "RiskOff":
        score += 2
    if weak_recovery_without_signal >= 1:
        score += 2

    score -= breakout_days
    score -= triggered_days
    score -= positive_pnl_days
    score -= recovery_quality_score
    if contained_rebuild_candidate >= 1:
        score -= 5
    if late_rebuild_seed_candidate >= 1:
        score -= 1
    if shallow_risk_repair_candidate >= 1:
        score -= 3
    if breakout_days >= 1 and triggered_days >= 1:
        score -= 2
    if breakout_after_risk >= 1:
        score -= 2
    if triggered_after_risk >= 1:
        score -= 2
    if positive_pnl_after_risk >= 1:
        score -= 1
    if recovery_days_after_risk >= 1:
        score -= 1
    if re_failure_after_recovery >= 1:
        score += 3
    if risk_rebound_recovery >= 1:
        score -= 2
    if pnl_rebound_pct >= 0.08:
        score -= 4
    elif pnl_rebound_pct >= 0.05:
        score -= 3
    elif pnl_rebound_pct >= 0.03:
        score -= 2

    if confidence_avg is not None and confidence_avg >= 0.75:
        score += 1

    return max(0, score)


def bucket_early_risk_score(score: int) -> str:
    if score >= 10:
        return "score_high"
    if score >= 6:
        return "score_medium"
    return "score_low"


def recommend_policy_for_early_score(score: int) -> str:
    if score >= 10:
        return "failure_risk_exit_all"
    if score >= 6:
        return "failure_risk_reduce_50"
    return "buy_and_hold_baseline"


def recommend_policy_for_thresholds(score: int, exit_all_threshold: int, reduce_threshold: int) -> str:
    if exit_all_threshold <= reduce_threshold:
        raise ValueError("exit_all_threshold must be greater than reduce_threshold")
    if score >= exit_all_threshold:
        return "failure_risk_exit_all"
    if score >= reduce_threshold:
        return "failure_risk_reduce_50"
    return "buy_and_hold_baseline"
