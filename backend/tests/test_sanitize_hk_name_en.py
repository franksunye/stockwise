"""sanitize_hk_name_en_candidate — reject bogus HK English-name column values."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from name_en_sanitize import sanitize_hk_name_en_candidate


def test_accepts_latin_english():
    assert sanitize_hk_name_en_candidate("腾讯控股", "TENCENT") == "TENCENT"


def test_rejects_cjk_in_english_column():
    assert sanitize_hk_name_en_candidate("腾讯控股", "腾讯控股") is None
    assert sanitize_hk_name_en_candidate("腾讯控股", "騰訊控股") is None


def test_rejects_identical_to_cn_name():
    assert sanitize_hk_name_en_candidate("FOO", "FOO") is None


def test_rejects_empty_and_nan_like():
    assert sanitize_hk_name_en_candidate("x", "") is None
    assert sanitize_hk_name_en_candidate("x", None) is None
    assert sanitize_hk_name_en_candidate("x", "nan") is None
