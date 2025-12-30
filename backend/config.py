import os
from pathlib import Path
from datetime import timedelta, timezone
from logger import logger

# 时区配置
BEIJING_TZ = timezone(timedelta(hours=8))

# 路径配置
BASE_DIR = Path(__file__).parent.parent
DB_PATH = BASE_DIR / "data" / "stockwise.db"

# 数据库连接配置
# 1. 加载优先级: backend/.env > ../.env (Root)
root_env = BASE_DIR / ".env"
backend_env = Path(__file__).parent / ".env"

def load_env_file(path):
    if not path.exists(): return
    try:
        logger.info(f"📖 加载环境配置: {path}")
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"): continue
                if "=" in line:
                    key, value = line.split("=", 1)
                    value = value.strip().strip("'").strip('"')
                    # 总是覆盖 (Allow Overwrite) 以支持 backend/.env 覆盖 root/.env
                    # 或者如果遵循 "已存在不覆盖"，则 backend/.env 应该先加载但要注意顺序
                    # 这里策略：先加载 root, 再加载 backend (覆盖之)
                    os.environ[key.strip()] = value
    except Exception as e:
        logger.warning(f"⚠️ 加载 {path} 失败: {e}")

load_env_file(root_env)
load_env_file(backend_env)

# 2. 数据库源选择 (Cloud vs Local)
# 默认为 'cloud'，如果在 .env 中设置 DB_SOURCE=local 则强制使用本地 SQLite
DB_SOURCE = os.getenv("DB_SOURCE", "cloud").lower()

if DB_SOURCE == "local":
    logger.info("🔧 模式切换: 强制使用本地 SQLite (DB_SOURCE=local)")
    TURSO_DB_URL = None
    TURSO_AUTH_TOKEN = None
else:
    TURSO_DB_URL = os.getenv("TURSO_DB_URL")
    TURSO_AUTH_TOKEN = os.getenv("TURSO_AUTH_TOKEN")

# API 配置
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
WECOM_ROBOT_KEY = os.getenv("WECOM_ROBOT_KEY")

# 本地 LLM 代理配置
LLM_CONFIG = {
    "base_url": os.getenv("LLM_BASE_URL", "http://127.0.0.1:8045/v1"), # 默认保留本地 URL 方便开发
    "api_key": os.getenv("LLM_API_KEY"), # ❌ 移除硬编码 Key，必须从环境变量获取
    "model": os.getenv("LLM_MODEL", "gpt-3.5-turbo"),
    "enabled": os.getenv("LLM_ENABLED", "true").lower() == "true",
}

