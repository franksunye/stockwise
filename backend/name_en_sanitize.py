"""HK stock_meta.name_en quality — stdlib only (safe for tests / any import path)."""

from __future__ import annotations

import re
from typing import Optional

_CJK_IN_NAME_EN_RE = re.compile(r"[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]")


def sanitize_name_en_candidate(name_cn: str, name_en_candidate: Optional[str]) -> Optional[str]:
    """
    Reject bogus English fields (CJK / identical to Chinese / empty).
    Used for HK exchange columns, Yahoo Finance, Tushare enname, etc.
    """
    return _sanitize_name_en_impl(name_cn, name_en_candidate)


def sanitize_hk_name_en_candidate(name_cn: str, name_en_candidate: Optional[str]) -> Optional[str]:
    """
    HK 上游「英文名称」列偶尔会回填中文或与中文名相同；此类值不可写入 stock_meta.name_en。
    """
    return _sanitize_name_en_impl(name_cn, name_en_candidate)


def _sanitize_name_en_impl(name_cn: str, name_en_candidate: Optional[str]) -> Optional[str]:
    if not name_en_candidate:
        return None
    ne = name_en_candidate.strip()
    if not ne or ne.lower() in ("nan", "none"):
        return None
    if _CJK_IN_NAME_EN_RE.search(ne):
        return None
    cn = (name_cn or "").strip()
    if cn and ne == cn:
        return None
    return ne
