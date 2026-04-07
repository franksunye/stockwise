"""
LLM Registry — Unified Model Management for StockWise.

Single source of truth for all LLM model routing across
the Stock Prediction and Daily Brief pipelines.

All models live in the `prediction_models` DB table.
Each model declares which roles it serves via a JSON `roles` column.

Roles:
  "prediction"  → AI stock prediction (multi-model, runs ALL active)
  "brief_free"  → Daily briefing for free-tier users (single best model)
  "brief_pro"   → Daily briefing for pro-tier users (single best model)

Usage:
    from backend.engine.llm_registry import LLMRegistry

    # Get a ready-to-use LLM client for a role
    client = LLMRegistry.get_client("brief_pro")
    content, meta = await client.chat_async(messages)

    # Get model metadata for logging
    info = LLMRegistry.get_model_info("brief_pro")
    print(f"Using {info['display_name']} ({info['model']})")

    # List all active prediction model IDs
    ids = LLMRegistry.get_active_model_ids("prediction")
"""

import json
import os
import time
from typing import Dict, List, Optional, Any
from backend.engine.model_policy import normalize_tier, parse_model_policy

try:
    from backend.database import get_connection
    from backend.logger import logger
except ImportError:
    from database import get_connection
    from logger import logger


class LLMRegistry:
    """
    Unified LLM Model Registry with in-memory caching.

    All model configs are stored in the `prediction_models` DB table.
    Role-based routing replaces the old scattered env-var approach.
    """

    _cache: Optional[List[Dict]] = None
    _cache_ts: float = 0
    CACHE_TTL: int = 300  # 5-minute cache

    # Map DB adapter provider types → LLMClient provider names (protocol selection)
    _PROTOCOL_MAP = {
        "adapter-openai": "openai",      # OpenAI-compatible HTTP
        "hunyuan": "hunyuan",            # OpenAI-compatible + rate limiter
        "adapter-gemini-local": "gemini_local",  # Gemini V2 SDK via local proxy
        "legacy": "openai",
    }

    # ─── Internal ──────────────────────────────────────────────────

    @classmethod
    def _load(cls) -> List[Dict]:
        """Load all models from DB, ordered by priority DESC. Cached."""
        now = time.time()
        if cls._cache is not None and (now - cls._cache_ts) < cls.CACHE_TTL:
            return cls._cache

        conn = get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM prediction_models ORDER BY priority DESC")
            cols = [d[0] for d in cursor.description]
            rows = cursor.fetchall()

            models = []
            for row in rows:
                if isinstance(row, (tuple, list)):
                    models.append(dict(zip(cols, row)))
                elif hasattr(row, 'keys'):
                    models.append(dict(row))
                else:
                    models.append(dict(zip(cols, row)))

            cls._cache = models
            cls._cache_ts = now
            logger.debug(f"📦 LLMRegistry: Loaded {len(models)} models from DB")
            return models
        except Exception as e:
            logger.error(f"❌ LLMRegistry: Failed to load models: {e}")
            return cls._cache or []
        finally:
            conn.close()

    @classmethod
    def invalidate(cls):
        """Force reload on next access."""
        cls._cache = None
        cls._cache_ts = 0

    @classmethod
    def _has_role(cls, model: Dict, role: str) -> bool:
        """Check if a model has the specified role."""
        roles_raw = model.get('roles')
        if not roles_raw:
            # Backward compat: models without roles column are prediction-only
            return role == "prediction"
        try:
            roles = json.loads(roles_raw)
            return role in roles
        except (json.JSONDecodeError, TypeError):
            return role == "prediction"

    @classmethod
    def _resolve_config(cls, model: Dict) -> Dict[str, str]:
        """Resolve a model's config_json, replacing env-var references with actual values."""
        config = json.loads(model.get('config_json') or '{}')

        def _norm_provider_id(pid: str) -> str:
            # ENV keys should be stable and case-insensitive in config_json.
            # We normalize to UPPER with underscores to fit common env style.
            pid = (pid or "").strip()
            pid = pid.replace("-", "_").replace(".", "_")
            return pid.upper()

        def _env_provider_key(pid: str, field: str) -> str:
            # Canonical naming: LLM_PROVIDER__<PROVIDER_ID>__API_KEY / BASE_URL
            return f"LLM_PROVIDER__{_norm_provider_id(pid)}__{field}"

        # Legacy env var fallbacks for backward compatibility during migration.
        # Keep this list small and explicit to avoid accidental misrouting.
        _LEGACY_API_KEY_FALLBACKS = {
            # Historical: Aliyun DashScope was sometimes referred as Qwen.
            "ALIYUN_DASHSCOPE": ["ALIYUN_API_KEY", "QWEN_API_KEY", "LLM_API_KEY"],
            # Official DeepSeek endpoint
            "DEEPSEEK_OFFICIAL": ["DEEPSEEK_API_KEY", "LLM_API_KEY"],
            # Tencent Hunyuan
            "TENCENT_HUNYUAN": ["HUNYUAN_API_KEY", "LLM_API_KEY"],
            # Generic
            "OPENAI": ["OPENAI_API_KEY", "LLM_API_KEY"],
        }
        _LEGACY_BASE_URL_FALLBACKS = {
            "ALIYUN_DASHSCOPE": ["ALIYUN_BASE_URL", "QWEN_VS_URL", "LLM_BASE_URL"],
            "DEEPSEEK_OFFICIAL": ["DEEPSEEK_BASE_URL", "LLM_BASE_URL"],
        }

        provider_id = config.get("provider_id") or config.get("provider")  # provider_id preferred
        provider_env_api_key = _env_provider_key(provider_id, "API_KEY") if provider_id else None
        provider_env_base_url = _env_provider_key(provider_id, "BASE_URL") if provider_id else None
        
        # Resolve base_url: env var takes priority, then static config fallback
        base_url = None
        base_url_env = config.get('base_url_env') or provider_env_base_url
        if base_url_env:
            base_url = os.getenv(base_url_env)  # None if not set, '' if set but empty
        if (not base_url) and provider_id:
            for k in _LEGACY_BASE_URL_FALLBACKS.get(_norm_provider_id(provider_id), []):
                v = os.getenv(k)
                if v:
                    base_url = v
                    break
        if not base_url:
            base_url = config.get('base_url', '')

        # Resolve api_key: env var takes priority, then legacy/provider fallbacks
        api_key = ""
        api_key_env = config.get("api_key_env") or provider_env_api_key
        if api_key_env:
            api_key = os.getenv(api_key_env, "") or ""
        if (not api_key) and provider_id:
            for k in _LEGACY_API_KEY_FALLBACKS.get(_norm_provider_id(provider_id), []):
                v = os.getenv(k, "")
                if v:
                    api_key = v
                    break

        return {
            'model': config.get('model', ''),
            'base_url': base_url,
            'api_key': api_key,
        }

    # ─── Public API ────────────────────────────────────────────────

    @classmethod
    def get_client(cls, role: str):
        """
        Get a configured LLMClient for the highest-priority active model in this role.

        Args:
            role: One of "prediction", "brief_free", "brief_pro"

        Returns:
            A ready-to-use LLMClient instance.

        Raises:
            ValueError: If no active model is found for the role.
        """
        from backend.engine.llm_client import LLMClient

        models = cls._load()
        for m in models:
            if m.get('is_active') and cls._has_role(m, role):
                resolved = cls._resolve_config(m)
                llm_provider = cls._PROTOCOL_MAP.get(m['provider'], 'openai')

                logger.info(
                    f"🎯 LLMRegistry: role='{role}' → "
                    f"{m['display_name']} ({resolved['model']}) via {llm_provider}"
                )

                return LLMClient(
                    provider=llm_provider,
                    base_url=resolved['base_url'],
                    api_key=resolved['api_key'],
                    model=resolved['model'],
                )

        raise ValueError(f"No active model found for role '{role}'")

    @classmethod
    def get_model_info(cls, role: str) -> Dict[str, Any]:
        """Get display metadata for the highest-priority active model in a role."""
        models = cls._load()
        for m in models:
            if m.get('is_active') and cls._has_role(m, role):
                config = json.loads(m.get('config_json') or '{}')
                return {
                    'model_id': m['model_id'],
                    'display_name': m['display_name'],
                    'model': config.get('model', ''),
                    'provider': m['provider'],
                }
        return {}

    @classmethod
    def get_active_model_ids(cls, role: str) -> List[str]:
        """Get all active model IDs for a role, ordered by priority DESC."""
        models = cls._load()
        return [
            m['model_id'] for m in models
            if m.get('is_active') and cls._has_role(m, role)
        ]

    @classmethod
    def get_active_model_ids_for_tier(cls, role: str, tier: str) -> List[str]:
        """
        Tier-aware model list for SSOT policy enforcement.
        Uses config_json.access visibility_tiers/prediction_tiers.
        """
        normalized_tier = normalize_tier(tier)
        ids: List[str] = []
        for m in cls._load():
            if not (m.get("is_active") and cls._has_role(m, role)):
                continue
            policy = parse_model_policy(m.get("model_id", "unknown"), m.get("config_json"))
            visibility = set(policy.get("visibility_tiers") or policy.get("prediction_tiers") or [])
            if normalized_tier in visibility:
                ids.append(m["model_id"])
        return ids

    @classmethod
    def list_all(cls) -> List[Dict]:
        """List all registered models with parsed roles (for admin/debug views)."""
        models = cls._load()
        result = []
        for m in models:
            entry = {
                'model_id': m['model_id'],
                'display_name': m['display_name'],
                'provider': m['provider'],
                'is_active': bool(m.get('is_active')),
                'priority': m.get('priority', 0),
            }
            try:
                entry['roles'] = json.loads(m.get('roles') or '[]')
            except (json.JSONDecodeError, TypeError):
                entry['roles'] = []
            try:
                config = json.loads(m.get('config_json') or '{}')
                entry['model'] = config.get('model', '')
            except (json.JSONDecodeError, TypeError):
                entry['model'] = ''
            result.append(entry)
        return result
