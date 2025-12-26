import os
from pathlib import Path
from datetime import timedelta, timezone

# 时区配置
BEIJING_TZ = timezone(timedelta(hours=8))

# 路径配置
BASE_DIR = Path(__file__).parent.parent
DB_PATH = BASE_DIR / "data" / "stockwise.db"

# 数据库连接配置
TURSO_DB_URL = os.getenv("TURSO_DB_URL")
TURSO_AUTH_TOKEN = os.getenv("TURSO_AUTH_TOKEN")

# API 配置
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
WECOM_ROBOT_KEY = os.getenv("WECOM_ROBOT_KEY")
