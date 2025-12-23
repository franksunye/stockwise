import sys
from pathlib import Path
import os

# 将 backend 目录加入路径
sys.path.append(str(Path(__file__).parent))

from main import init_db

if __name__ == "__main__":
    # 强制不使用 Turso，确保在本地 SQLite 执行
    if "TURSO_DB_URL" in os.environ:
        del os.environ["TURSO_DB_URL"]
        
    print("🚀 正在初始化本地 SQLite 数据库表结构...")
    init_db()
    print("✅ 初始化完成！")
