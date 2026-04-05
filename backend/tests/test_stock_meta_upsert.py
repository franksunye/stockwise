"""stock_meta UPSERT must not wipe profile fields and must preserve name_en when upstream is empty."""
import sqlite3
import unittest
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend.db_repo.queries import build_upsert_stock_meta_sql


class TestStockMetaUpsert(unittest.TestCase):
    def setUp(self):
        self.conn = sqlite3.connect(":memory:")
        self.conn.execute(
            """
            CREATE TABLE stock_meta (
                symbol TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                name_en TEXT,
                market TEXT NOT NULL,
                last_updated TEXT,
                pinyin TEXT,
                pinyin_abbr TEXT,
                industry TEXT,
                main_business TEXT,
                description TEXT
            )
            """
        )

    def test_upsert_preserves_profile_and_name_en_on_empty_upstream(self):
        cur = self.conn.cursor()
        cur.execute(
            """
            INSERT INTO stock_meta (
                symbol, name, name_en, market, last_updated, pinyin, pinyin_abbr, industry
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            ("00700", "腾讯控股", "Tencent", "HK", "t1", "p", "tx", "Tech"),
        )
        sql = build_upsert_stock_meta_sql(1)
        cur.execute(sql, ("00700", "腾讯控股", None, "HK", "t2", "p2", "tx2"))
        row = cur.execute(
            "SELECT industry, name_en, pinyin_abbr FROM stock_meta WHERE symbol='00700'"
        ).fetchone()
        self.assertEqual(row[0], "Tech")
        self.assertEqual(row[1], "Tencent")
        self.assertEqual(row[2], "tx2")

    def test_upsert_writes_new_name_en_when_provided(self):
        cur = self.conn.cursor()
        sql = build_upsert_stock_meta_sql(1)
        cur.execute(sql, ("09988", "阿里巴巴-SW", None, "HK", "t", "p", "a"))
        cur.execute(sql, ("09988", "阿里巴巴-SW", "Alibaba", "HK", "t2", "p", "b"))
        row = cur.execute("SELECT name_en FROM stock_meta WHERE symbol='09988'").fetchone()
        self.assertEqual(row[0], "Alibaba")


if __name__ == "__main__":
    unittest.main()
