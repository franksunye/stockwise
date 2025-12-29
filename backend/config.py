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

# 本地 LLM 代理配置
LLM_CONFIG = {
    "base_url": os.getenv("LLM_BASE_URL", "http://127.0.0.1:8045/v1"),
    "api_key": os.getenv("LLM_API_KEY", "sk-920cf3a0a4e54b53b0ec8a44ebd97271"),
    "model": os.getenv("LLM_MODEL", "gpt-3.5-turbo"),  # 本地代理映射到实际模型
    "enabled": os.getenv("LLM_ENABLED", "true").lower() == "true",
}

