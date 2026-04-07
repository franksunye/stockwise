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
                    "title": "📊 今日复盘已就绪",
                    "body": "{push_hook}"
                }
            },
            "pro": {
                "zh": {
                    "title": "⭐ Pro 深度复盘已就绪",
                    "body": "{push_hook} | 含明日执行计划"
                }
            }
        },
        "daily_brief_bullish": {
            "free": {
                "zh": {
                    "title": "🚀 今日复盘：机会信号集中",
                    "body": "{push_hook}"
                }
            },
            "pro": {
                "zh": {
                    "title": "🟢 Pro 机会窗口已确认",
                    "body": "{push_hook} | 已附仓位与节奏建议"
                }
            }
        },
        "daily_brief_bearish": {
            "free": {
                "zh": {
                    "title": "🛡️ 今日复盘：风险信号升温",
                    "body": "{push_hook}"
                }
            },
            "pro": {
                "zh": {
                    "title": "🔴 Pro 避险信号已触发",
                    "body": "{push_hook} | 已附减仓与防守方案"
                }
            }
        },
        "daily_brief_neutral": {
            "free": {
                "zh": {
                    "title": "📊 今日复盘：市场偏中性",
                    "body": "{push_hook}"
                }
            },
            "pro": {
                "zh": {
                    "title": "⚪ Pro 震荡策略更新",
                    "body": "{push_hook} | 已附观望与试仓边界"
                }
            }
        },
        "signal_flip": {
            "free": {
                "zh": {
                    "title": "🚨 信号反转：{symbol}",
                    "body": "观点从 [{old_signal}] 变为 [{new_signal}]，置信度 {confidence_pct}%。点开看原因。"
                }
            },
            "pro": {
                "zh": {
                    "title": "🎯 Pro 反转提醒：{symbol}",
                    "body": "核心方向已切换到 [{new_signal}]。已生成仓位动作与风险阈值。"
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
                    "title": "☕ 开盘前早报",
                    "body": "自选池情绪：[{sentiment_tag}]。重点观察 {stock_names} 等标的盘口异动。"
                }
            },
            "pro": {
                "zh": {
                    "title": "☀️ Pro 开盘作战简报",
                    "body": "高优盯盘资产：{stock_names}。自选池情绪：[{sentiment_tag}]。带好战术防线入场。"
                }
            }
        },
        "morning_call_neutral": {
            "all": {
                "zh": {
                    "title": "☕ 开盘前早报：观望日",
                    "body": "自选池无明确多头信号，情绪：[{sentiment_tag}]。今日以耐心等待为主。"
                }
            }
        },
        "validation_glory": {
            "free": {
                 "zh": {
                    "title": "📊 AI 策略执行追踪：{stock_names}",
                    "body": "该标的今日触及预测网格，录得日内最高浮盈 {peak_gain}%。进入详情查看 AI 复盘。"
                }
            },
            "pro": {
                 "zh": {
                    "title": "🎯 Pro 策略复盘与进阶：{stock_names}",
                    "body": "已达成预期推演 (日内最高浮盈 {peak_gain}%)。最新止损边界与持仓计划已更新，请检查。"
                }
            }
        },
        "prediction_updated": {
            "free": {
                "zh": {
                    "title": "🤖 预测数据已更新",
                    "body": "{market_name} 监控池已完成刷新，可查看最新趋势。"
                }
            },
            "pro": {
                "zh": {
                    "title": "⭐ Pro 深度预测已就绪",
                    "body": "{market_name} 深度分析已生成，含情绪建模与策略解释。"
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
        "almanac_preview": {
            "all": {
                "zh": {
                    "title": "📜 明日投资黄历已出炉",
                    "body": "意境：{mood_tag} | 宜：{strategy}。抢先看明日市场势能推演。"
                }
            }
        },
        "almanac_ritual": {
            "all": {
                "zh": {
                    "title": "📜 今日投资黄历：{mood_tag}",
                    "body": "{strategy} | AI 天机：{insight_snippet}"
                }
            }
        },
        # --- Service Hooks (Short strings for previews/hooks) ---
        "brief_hook_bullish": {
            "all": {
                "zh": {
                    "body": "📈 {stocks}{etc}出现上行动能，点击查看复盘与计划。"
                }
            }
        },
        "brief_hook_bearish": {
            "all": {
                "zh": {
                    "body": "⚠️ {stocks}{etc}下行压力加大，点击查看风控建议。"
                }
            }
        },
        "brief_hook_neutral": {
            "all": {
                "zh": {
                    "body": "今日复盘：{count} 只股票中性震荡，点击查看执行边界。"
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
