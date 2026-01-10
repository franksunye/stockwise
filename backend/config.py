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
                    key = key.strip()
                    value = value.strip().strip("'").strip('"')
                    # 命令行环境变量优先：如果已存在则不覆盖
                    if key not in os.environ:
                        os.environ[key] = value
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

# 3. 同步并发配置
# 控制 ThreadPoolExecutor 的并发线程数，避免 Turso/libSQL 压力过大
SYNC_CONFIG = {
    "realtime_workers": int(os.getenv("SYNC_REALTIME_WORKERS", "2")),
    "daily_workers": int(os.getenv("SYNC_DAILY_WORKERS", "2")),
}

# 4. API 配置
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
WECOM_ROBOT_KEY = os.getenv("WECOM_ROBOT_KEY")

# 本地/云端 LLM 配置
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "openai").lower() # gemini, deepseek, openai, custom

# 预定义默认值
DEFAULTS = {
    "deepseek": {
        "api_key": os.getenv("DEEPSEEK_API_KEY"),
        "base_url": os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com/v1"),
        "model": os.getenv("DEEPSEEK_MODEL", "deepseek-chat"),
    },
    "gemini": {
        "api_key": os.getenv("GEMINI_API_KEY"),
        "model": os.getenv("GEMINI_MODEL", "gemini-pro"),
    },
    "gemini_local": {
        "api_key": os.getenv("GEMINI_LOCAL_API_KEY", os.getenv("LLM_API_KEY")),
        "base_url": os.getenv("GEMINI_LOCAL_BASE_URL", "http://127.0.0.1:8045"),
        "model": os.getenv("GEMINI_LOCAL_MODEL", "gemini-3-flash"),
    },
    "hunyuan": {
        "api_key": os.getenv("HUNYUAN_API_KEY"),
        "base_url": os.getenv("HUNYUAN_BASE_URL", "https://api.hunyuan.cloud.tencent.com/v1"),
        "model": os.getenv("HUNYUAN_MODEL", "hunyuan-lite"),
        "qps_limit": float(os.getenv("HUNYUAN_QPS_LIMIT", "2.0")),
    }
}

LLM_CONFIG = {
    "provider": LLM_PROVIDER,
    "enabled": os.getenv("LLM_ENABLED", "true").lower() != "false",
    
    # 基础配置 (兼容旧版环境变量，如果没有指定提供商则使用这些)
    "api_key": os.getenv("LLM_API_KEY"),
    "base_url": os.getenv("LLM_BASE_URL", "http://127.0.0.1:8045/v1"),
    "model": os.getenv("LLM_MODEL", "gpt-3.5-turbo"),
    
    # 模块化配置
    "deepseek": DEFAULTS["deepseek"],
    "gemini": DEFAULTS["gemini"],
    "gemini_local": DEFAULTS["gemini_local"],
    "hunyuan": DEFAULTS["hunyuan"]
}

# 动态覆盖基础配置 (如果指定了提供商且有对应配置)
if LLM_PROVIDER in DEFAULTS:
    provider_cfg = DEFAULTS[LLM_PROVIDER]
    if provider_cfg.get("api_key"):
        LLM_CONFIG["api_key"] = provider_cfg["api_key"]
    if provider_cfg.get("model"):
        LLM_CONFIG["model"] = provider_cfg["model"]
    if provider_cfg.get("base_url"):
        LLM_CONFIG["base_url"] = provider_cfg["base_url"]


# -----------------------------------------------------------------------------
# Chain Engine Strategies (LLM Multi-turn Workflows)
# -----------------------------------------------------------------------------
CHAIN_STRATEGIES = {
    # 策略名必须与 ModelFactory 中的 ID 匹配
    "hunyuan-lite": {
        "steps": [
            {"type": "anchor", "config": {"include_profile": True}},
            {"type": "indicator", "config": {}},
            {"type": "multi_period", "config": {}},
            {"type": "synthesis", "config": {"conservative": True, "inject_hard_facts": True}}
        ],
        # GitHub Actions 环境下，我们可以容忍更长的执行时间换取质量
        "max_retries_per_step": 2, 
        "total_timeout": 120
    }
}

