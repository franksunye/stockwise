from __future__ import annotations

from typing import Sequence, TypeVar

T = TypeVar("T")


def normalize_shard_args(shard_index: int = 0, shard_total: int = 1) -> tuple[int, int]:
    try:
        total = int(shard_total)
    except Exception:
        total = 1
    try:
        index = int(shard_index)
    except Exception:
        index = 0

    if total < 1:
        total = 1
    if index < 0:
        index = 0
    if index >= total:
        index = index % total
    return index, total


def select_shard(items: Sequence[T], shard_index: int = 0, shard_total: int = 1) -> list[T]:
    index, total = normalize_shard_args(shard_index, shard_total)
    if total <= 1:
        return list(items)
    return [item for pos, item in enumerate(items) if pos % total == index]
