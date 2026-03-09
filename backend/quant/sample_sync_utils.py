from __future__ import annotations

import hashlib
from datetime import datetime, timedelta
from typing import Dict, List, Tuple


CandidateRow = Tuple[str, str, int, str | None, int]


def stable_bucket(symbol: str) -> int:
    return int(hashlib.md5(symbol.encode("utf-8")).hexdigest()[:8], 16)


def board_quota(board_sizes: Dict[str, int], total_limit: int) -> Dict[str, int]:
    total = sum(board_sizes.values()) or 1
    positive_boards = [board for board, size in board_sizes.items() if size > 0]
    if total_limit <= 0 or not positive_boards:
        return {}

    # Keep at most one guaranteed slot per active board; higher floors can deadlock
    # rebalancing when the requested limit is small.
    min_quota = 1 if total_limit >= len(positive_boards) else 0
    quotas = {board: max(min_quota, round(total_limit * size / total)) for board, size in board_sizes.items() if size > 0}
    assigned = sum(quotas.values())
    ordered = sorted(board_sizes, key=lambda board: board_sizes[board], reverse=True)
    while assigned > total_limit and ordered:
        changed = False
        for board in ordered:
            if assigned <= total_limit:
                break
            if quotas.get(board, 0) > min_quota:
                quotas[board] -= 1
                assigned -= 1
                changed = True
        if not changed:
            break
    while assigned < total_limit and ordered:
        changed = False
        for board in ordered:
            if assigned >= total_limit:
                break
            quotas[board] = quotas.get(board, 0) + 1
            assigned += 1
            changed = True
        if not changed:
            break
    return quotas


def select_cn_candidates(candidates: List[CandidateRow], limit: int) -> List[CandidateRow]:
    grouped: Dict[str, List[CandidateRow]] = {"6": [], "0": [], "3": []}
    for row in candidates:
        board = row[0][0]
        if board in grouped:
            grouped[board].append(row)

    board_sizes = {board: len(rows) for board, rows in grouped.items()}
    quotas = board_quota(board_sizes, limit)
    selected: List[CandidateRow] = []

    for board, rows in grouped.items():
        rows = sorted(rows, key=lambda row: (row[4], row[2], stable_bucket(row[0])))
        selected.extend(rows[: quotas.get(board, 0)])

    if len(selected) < limit:
        selected_symbols = {row[0] for row in selected}
        remainder = [row for row in candidates if row[0] not in selected_symbols]
        remainder.sort(key=lambda row: (row[4], row[2], stable_bucket(row[0])))
        selected.extend(remainder[: limit - len(selected)])

    return selected[:limit]


def resolve_sync_start_date(history_start_date: str, last_date: str | None, incremental_buffer_days: int) -> str:
    if not last_date:
        return history_start_date

    base_dt = datetime.strptime(history_start_date, "%Y-%m-%d")
    last_dt = datetime.strptime(last_date, "%Y-%m-%d")
    incremental_dt = last_dt - timedelta(days=max(1, incremental_buffer_days))
    return max(base_dt, incremental_dt).strftime("%Y-%m-%d")
