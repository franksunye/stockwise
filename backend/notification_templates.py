"""
Centralized Notification Template Engine.
Industrial-grade implementation for StockWise scalability (Supports 5M+ users).
Handles rendering of localized, tier-based, and type-specific messaging.
"""
from typing import Dict, Any, Optional, Tuple
try:
    from backend.logger import logger
except ImportError:
    from logger import logger

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
        "daily_brief_bullish": {
            "free": {
                "zh": {
                    "title": "🚀 机会预警：多只股票看涨",
                    "body": "{push_hook}"
                }
            },
            "pro": {
                "zh": {
                    "title": "🟢 强力买入信号确认",
                    "body": "{push_hook} | Pro 级策略详情已解锁"
                }
            }
        },
        "daily_brief_bearish": {
            "free": {
                "zh": {
                    "title": "🛡️ 风险提示：持仓出现抛压",
                    "body": "{push_hook}"
                }
            },
            "pro": {
                "zh": {
                    "title": "🔴 关键避险信号触发",
                    "body": "{push_hook} | 机构减仓迹象深度分析"
                }
            }
        },
        "daily_brief_neutral": {
            "free": {
                "zh": {
                    "title": "📊 今日简报：市场平稳",
                    "body": "{push_hook}"
                }
            },
            "pro": {
                "zh": {
                    "title": "⚪ 震荡市策略更新",
                    "body": "{push_hook} | 观望与低吸区间分析"
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
            "free": {
                "zh": {
                    "title": "☕ 今日早报: AI 交易提醒",
                    "body": "📊 关注股中 {stock_names} 等有看多信号。{sentiment_snippet}"
                }
            },
            "pro": {
                "zh": {
                    "title": "☀️ Pro 专属：今日必读市场内参",
                    "body": "💡 重点关注：{stock_names} 等出现高胜率信号。{sentiment_snippet}"
                }
            }
        },
        "morning_call_neutral": {
            "all": {
                "zh": {
                    "title": "☕ 今日早报: 市场观望",
                    "body": "📉 今日市场整体观望为主。{sentiment_snippet}"
                }
            }
        },
        "validation_glory": {
            "free": {
                 "zh": {
                    "title": "🏅 验证成功：AI 再次击败市场",
                    "body": "您关注的 {stock_names} 走势完美符合昨日预测（最高涨幅 {max_gain}%）。这就是 AI 的力量！"
                }
            },
            "pro": {
                 "zh": {
                    "title": "🏆 精准复盘：Pro 策略价值验证",
                    "body": "昨日 Pro 级预测点中 {stock_names} 关键变盘，最高捕获 {max_gain}% 波动。明日策略已生成，请速查看。"
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
        },
        # --- Service Hooks (Short strings for previews/hooks) ---
        "brief_hook_bullish": {
            "all": {
                "zh": {
                    "body": "📈 {stocks}{etc}出现看涨信号，点击查看今日 AI 复盘。"
                }
            }
        },
        "brief_hook_bearish": {
            "all": {
                "zh": {
                    "body": "⚠️ {stocks}{etc}面临调整压力，点击查看风险提示。"
                }
            }
        },
        "brief_hook_neutral": {
            "all": {
                "zh": {
                    "body": "今日复盘：{count} 只股票走势平稳，点击查看详情。"
                }
            }
        },
        # --- Internal Admin / Monitoring Reports (Markdown supported) ---
        "admin_task_report": {
            "all": {
                "zh": {
                    "title": "### 🧠 StockWise: {task_title}\n",
                    "body": "> **Status**: {status}\n- **Target**: {total} Stocks\n- **Success**: {success} (AI: {ai}, Rule: {rule})\n- **Failed**: {failed}\n- **Duration**: {duration}s"
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
