"""修复 02171 的名称"""
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / "data" / "stockwise.db"

conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

# 修复错误数据
cursor.execute("UPDATE stock_pool SET name='腾讯控股' WHERE symbol='00700'")
cursor.execute("UPDATE stock_pool SET name='映客' WHERE symbol='02171'")

# 实际上 02171 应该查一下是什么股票
cursor.execute("SELECT symbol, name FROM stock_pool ORDER BY symbol")
print("\n当前股票池:")
for row in cursor.fetchall():
    print(f"  {row[0]}: {row[1]}")

conn.commit()
conn.close()
print("\n✅ 数据已修复")
