"""
Centralized Notification Template Engine.
Industrial-grade implementation for StockWise scalability (Supports 5M+ users).
Handles rendering of localized, tier-based, and type-specific messaging.
"""
import logging
from typing import Dict, Any, Optional, Tuple

logger = logging.getLogger("stockwise")

class NotificationTemplates:
    """
    High-performance template engine for push notifications.
    Uses localized dictionaries and safe rendering with fallbacks.
    """
    
    # 1. Template Registry
    # Structure: [Type] -> [Tier] -> [Language] -> {title, body}
    # For now, we use 'zh' as default language.
    TEMPLATES: Dict[str, Dict[str, Dict[str, Any]]] = {
        "daily_brief": {
            "free": {
                "zh": {
                    "title": "📊 今日简报已生成",
                    "body": "{push_hook}"
                }
            },
            "pro": {
                "zh": {
                    "title": "⭐ Pro 深度复盘已就绪",
                    "body": "{push_hook} | 首席主笔深度解读"
                }
            }
        },
        "signal_flip": {
            "free": {
                "zh": {
                    "title": "🚨 AI 信号转向: {symbol}",
                    "body": "评级已从 [{old_signal}] 调整为 [{new_signal}]。信心指数: {confidence_pct}%。"
                }
            },
            "pro": {
                "zh": {
                    "title": "🎯 专属：{symbol} 信号发生重要逆转",
                    "body": "深度评估显示评级已转向 [{new_signal}]。点击查看 Pro 级操作建议。"
                }
            }
        },
        "signal_flip_batch": {
            "all": {
                "zh": {
                    "title": "🎯 {count} 只关注股信号更新",
                    "body": "{symbols} 等股票出现新的交易信号，点击查看 AI 深度复盘。"
                }
            }
        },
        "morning_call": {
            "all": {
                "zh": {
                    "title": "{title}", # For legacy reasons, sometimes title is passed as payload
                    "body": "{body}"
                }
            }
        },
        "validation_glory": {
            "free": {
                 "zh": {
                    "title": "🏅 AI 预测验证成功!",
                    "body": "昨日为您追踪的 {win_details_text} 走势符合 AI 预期。点击查看复盘对比。"
                }
            },
            "pro": {
                 "zh": {
                    "title": "🏆 精准捕获：AI 策略大获成功",
                    "body": "正如昨日 Pro 预测，{win_details_text} 走势极其精准。点击查看复盘与明日策略。"
                }
            }
        },
        "prediction_updated": {
            "free": {
                "zh": {
                    "title": "🤖 AI 预测已更新",
                    "body": "您关注的 {market_name} AI 预测数据已全部更新，点击查看最新趋势。"
                }
            },
            "pro": {
                "zh": {
                    "title": "⭐ Pro 专属：深度预测已就绪",
                    "body": "今日 {market_name} AI 深度分析已生成，包含机构级情绪建模与策略解读。"
                }
            }
        },
        "price_update": {
            "all": {
                "zh": {
                    "title": "{stock_name} ({symbol}) {emoji} {change_pct}%",
                    "body": "最新: {price} | 成交: {volume_formatted}"
                }
            }
        }
    }

    @classmethod
    def render(
        cls, 
        notif_type: str, 
        tier: str = "free", 
        lang: str = "zh", 
        **kwargs
    ) -> Tuple[str, str]:
        """
        Renders a notification title and body with sophisticated fallback logic.
        
        Args:
            notif_type: The notification event type (e.g. 'daily_brief').
            tier: User subscription tier ('free', 'pro').
            lang: Language code ('zh', 'en').
            **kwargs: Placeholder variables.
            
        Returns:
            A tuple of (title, body).
        """
        # A. Resolve Tier & Type
        type_group = cls.TEMPLATES.get(notif_type)
        if not type_group:
            logger.warning(f"⚠️ Template for type '{notif_type}' not found. Using default.")
            return cls._fallback_render(kwargs)

        # Tier Priority: Requested Tier -> 'all' -> 'free'
        tier_data = type_group.get(tier) or type_group.get("all") or type_group.get("free")
        if not tier_data:
            logger.error(f"❌ Failed to find tier '{tier}' or fallback for type '{notif_type}'")
            return cls._fallback_render(kwargs)

        # B. Resolve Language
        lang_data = tier_data.get(lang) or tier_data.get("zh") # Default to zh if lang missing
        if not lang_data:
            logger.error(f"❌ Failed to find language '{lang}' for notification '{notif_type}'")
            return cls._fallback_render(kwargs)

        # C. Render with safe formatting
        try:
            title_tpl = lang_data.get("title", "StockWise 通知")
            body_tpl = lang_data.get("body", "点击查看行情详情")
            
            title = title_tpl.format(**kwargs)
            body = body_tpl.format(**kwargs)
            
            return title, body
        except KeyError as e:
            logger.error(f"❌ Missing placeholder {e} in template '{notif_type}' (tier: {tier}, data: {kwargs})")
            # Return templates with placeholders if formatting fails to prevent data loss
            return title_tpl, body_tpl
        except Exception as e:
            logger.error(f"❌ Rendering error for '{notif_type}': {e}")
            return cls._fallback_render(kwargs)

    @staticmethod
    def _fallback_render(payload: Dict[str, Any]) -> Tuple[str, str]:
        """Final safety net."""
        title = payload.get("title") or "StockWise 重要更新"
        body = payload.get("body") or "您有一条新的 AI 策略通知，点击查看。"
        return str(title), str(body)
