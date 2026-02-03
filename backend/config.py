import os
import sys
import logging
from datetime import datetime
try:
    from zoneinfo import ZoneInfo
except ImportError:
    from backports.zoneinfo import ZoneInfo

# Configure Logger
try:
    from backend.logger import logger
except ImportError:
    try:
        from logger import logger
    except ImportError:
        logger = logging.getLogger("config")
        if not logger.handlers:
            handler = logging.StreamHandler()
            formatter = logging.Formatter('%(asctime)s [%(levelname)s] %(message)s (%(filename)s:%(lineno)d)')
            handler.setFormatter(formatter)
            logger.addHandler(handler)
            logger.setLevel(logging.INFO)

def load_env_file(env_path):
    if not os.path.exists(env_path):
        return
    logger.info(f"📖 加载环境配置: {env_path}")
    with open(env_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            if '=' in line:
                key, val = line.split('=', 1)
                key = key.strip()
                if key not in os.environ:
                    os.environ[key] = val.strip().strip('"').strip("'")

# 1. 加载环境变量 (优先级: Current Env > .env)
root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
root_env = os.path.join(root_dir, ".env")
backend_env = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")

load_env_file(root_env)
load_env_file(backend_env)

# -----------------------------------------------------------------------------
# Proxy Configuration Strategy
# -----------------------------------------------------------------------------
if os.environ.get("HTTP_PROXY") or os.environ.get("HTTPS_PROXY"):
    logger.info("🌍 Proxy Environment Detected. Auto-configuring NO_PROXY for stock sources...")
    
    dom_domains = [
        "eastmoney.com", "sina.com.cn", "163.com", "qq.com", 
        "cninfo.com.cn", "chinamoney.com.cn", "shfe.com.cn", 
        "dce.com.cn", "czce.com.cn", "cffex.com.cn",
        "sse.com.cn", "szse.cn", "bjs.com.cn", "akshare.xyz",
        ".eastmoney.com", ".sina.com.cn", ".akshare.xyz",
        "88.push2.eastmoney.com", "33.push2his.eastmoney.com",
        "push2his.eastmoney.com", "push2.eastmoney.com"
    ]
    
    current_no_proxy = os.environ.get("NO_PROXY", os.environ.get("no_proxy", ""))
    new_no_proxy = ",".join(dom_domains)
    if current_no_proxy:
        new_no_proxy = f"{new_no_proxy},{current_no_proxy}"
    
    os.environ["NO_PROXY"] = new_no_proxy
    os.environ["no_proxy"] = new_no_proxy
    logger.info(f"🛡️  Added {len(dom_domains)} domains to NO_PROXY rules.")


# 2. 数据库源选择
DB_SOURCE = os.getenv("DB_SOURCE", "cloud").lower()

if DB_SOURCE == "local":
    logger.info("🔧 模式切换: 强制使用本地 SQLite (DB_SOURCE=local)")
    TURSO_DB_URL = None
    TURSO_AUTH_TOKEN = None
else:
    TURSO_DB_URL = os.getenv("TURSO_DB_URL")
    TURSO_AUTH_TOKEN = os.getenv("TURSO_AUTH_TOKEN")

# 3. 同步并发配置
SYNC_CONFIG = {
    "realtime_workers": int(os.getenv("SYNC_REALTIME_WORKERS", "2")),
    "daily_workers": int(os.getenv("SYNC_DAILY_WORKERS", "5")),
}

# 4. LLM 配置
# -----------------------------------------------------------------------------
# LLM Provider Registry (Centralized knowledge of providers)
# -----------------------------------------------------------------------------
LLM_PROVIDER_REGISTRY = {
    "deepseek": {
        "base_url": "https://api.deepseek.com/v1",
        "default_model": "deepseek-chat",
    },
    "gemini": {
        "default_model": "gemini-pro",
    },
    "gemini_local": {
        "base_url": "http://127.0.0.1:8045",
        "default_model": "gemini-3-flash",
    },
    "hunyuan": {
        "base_url": "https://api.hunyuan.cloud.tencent.com/v1",
        "default_model": "hunyuan-lite",
        "qps_limit": 2.0
    },
    "aliyun": {
        "base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1",
        "default_model": "deepseek-v3",
    },
    "openai": {
        "base_url": "http://127.0.0.1:8045/v1",
        "default_model": "gpt-3.5-turbo",
    }
}

LLM_CONFIG = {
    "api_key": os.getenv("LLM_API_KEY"),
    "base_url": os.getenv("LLM_BASE_URL"),
    "model": os.getenv("LLM_MODEL"),
    "timeout": int(os.getenv("LLM_TIMEOUT", "60")),
    "provider": os.getenv("LLM_PROVIDER", "openai"),
    
    # 供应商特定配置 (从 Registry 获取保底值)
    "deepseek": {
        "api_key": os.getenv("DEEPSEEK_API_KEY"),
        "base_url": os.getenv("DEEPSEEK_BASE_URL") or LLM_PROVIDER_REGISTRY["deepseek"]["base_url"],
        "model": os.getenv("DEEPSEEK_MODEL") or LLM_PROVIDER_REGISTRY["deepseek"]["default_model"],
    },
    "gemini": {
        "api_key": os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY"),
        "model": os.getenv("GEMINI_MODEL") or LLM_PROVIDER_REGISTRY["gemini"]["default_model"],
    },
    "gemini_local": {
        "api_key": os.getenv("GEMINI_LOCAL_API_KEY"),
        "base_url": os.getenv("GEMINI_LOCAL_BASE_URL") or LLM_PROVIDER_REGISTRY["gemini_local"]["base_url"],
        "model": os.getenv("GEMINI_LOCAL_MODEL") or LLM_PROVIDER_REGISTRY["gemini_local"]["default_model"],
    },
    "hunyuan": {
        "api_key": os.getenv("HUNYUAN_API_KEY"),
        "base_url": os.getenv("HUNYUAN_BASE_URL") or LLM_PROVIDER_REGISTRY["hunyuan"]["base_url"],
        "model": os.getenv("HUNYUAN_MODEL") or LLM_PROVIDER_REGISTRY["hunyuan"]["default_model"],
        "qps_limit": float(os.getenv("HUNYUAN_QPS_LIMIT", "2.0")),
    },
    "aliyun": {
        "api_key": os.getenv("ALIYUN_API_KEY") or os.getenv("QWEN_API_KEY"),
        "base_url": os.getenv("ALIYUN_BASE_URL") or os.getenv("QWEN_BASE_URL") or os.getenv("QWEN_VS_URL") or LLM_PROVIDER_REGISTRY["aliyun"]["base_url"],
        "model": os.getenv("ALIYUN_MODEL") or os.getenv("QWEN_MODEL") or LLM_PROVIDER_REGISTRY["aliyun"]["default_model"],
    },
    "gemini_local": {
        "api_key": os.getenv("GEMINI_LOCAL_API_KEY") or os.getenv("LLM_API_KEY"),
        "base_url": os.getenv("GEMINI_LOCAL_BASE_URL") or LLM_PROVIDER_REGISTRY["gemini_local"]["base_url"],
        "model": os.getenv("GEMINI_LOCAL_MODEL") or LLM_PROVIDER_REGISTRY["gemini_local"]["default_model"],
    },
    "openai": {
        "api_key": os.getenv("OPENAI_API_KEY") or os.getenv("LLM_API_KEY"),
        "base_url": os.getenv("OPENAI_BASE_URL") or os.getenv("LLM_BASE_URL") or LLM_PROVIDER_REGISTRY["openai"]["base_url"],
        "model": os.getenv("OPENAI_MODEL") or os.getenv("LLM_MODEL") or LLM_PROVIDER_REGISTRY["openai"]["default_model"],
    }
}

# 5. 时区与时间
BEIJING_TZ = ZoneInfo("Asia/Shanghai")

# 6. 企业微信机器人
WECOM_ROBOT_KEY = os.getenv("WECOM_ROBOT_KEY")

# 7. 系统路径
DB_PATH = os.path.join(root_dir, "data", "stockwise.db")

# 7.1 通知密钥
INTERNAL_API_SECRET = os.getenv("INTERNAL_API_SECRET")
NEXT_PUBLIC_SITE_URL = os.getenv("NEXT_PUBLIC_SITE_URL", "https://swx.visutry.com")

# 8. 默认北京时间
def get_now_beijing():
    return datetime.now(BEIJING_TZ)

# Extra configs if any were lost (Best guess based on common project patterns)
# Admin/Special Users
ADMIN_USER_IDS = os.getenv("ADMIN_USER_IDS", "").split(",")
PRO_USER_IDS = os.getenv("PRO_USER_IDS", "").split(",")

# Admin Mobiles for WeCom Alerts (e.g. "13800000000,13900000000")
ADMIN_MOBILES = [m.strip() for m in os.getenv("ADMIN_MOBILES", "").split(",") if m.strip()]

# Tiers
TIER_PROVIDER_MAP = {
    "free": os.getenv("LLM_MODEL_FREE", "gpt-3.5-turbo"),
    "pro": os.getenv("LLM_MODEL_PRO", "gpt-4"),
}

# Chain Engine Strategies
CHAIN_STRATEGIES = {
    "hunyuan-lite": {
        "steps": [
            {"type": "anchor", "config": {"include_profile": True}},
            {"type": "indicator", "config": {}},
            {"type": "multi_period", "config": {}},
            {"type": "synthesis", "config": {"conservative": True, "inject_hard_facts": True}}
        ]
    }
}

# Notification Settings
ENABLE_SMART_NOTIFICATIONS = os.getenv("ENABLE_SMART_NOTIFICATIONS", "true").lower() == "true"
