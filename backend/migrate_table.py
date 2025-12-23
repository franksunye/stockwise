"""
数据库表重命名脚本
core_pool -> stock_pool
"""
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / "data" / "stockwise.db"

conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

try:
    # 检查旧表是否存在
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='core_pool'")
    if cursor.fetchone():
        print("✅ 发现 core_pool 表，开始重命名...")
        cursor.execute("ALTER TABLE core_pool RENAME TO stock_pool")
        conn.commit()
        print("✅ 重命名完成: core_pool -> stock_pool")
    else:
        print("⚠️  core_pool 表不存在，可能已经重命名或未初始化")
        
    # 验证新表
    cursor.execute("SELECT COUNT(*) FROM stock_pool")
    count = cursor.fetchone()[0]
    print(f"✅ stock_pool 表包含 {count} 只股票")
    
except Exception as e:
    print(f"❌ 迁移失败: {e}")
    conn.rollback()
finally:
    conn.close()
