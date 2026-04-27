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

    PRICE_FIELD_NAMES = {
        "price",
        "current_price",
        "support_price",
        "pressure_price",
        "discipline_price",
        "resistance_price",
        "observation_price",
        "trigger_price",
    }
    
    # 1. Template Registry
    # Structure: [Type] -> [Tier] -> [Language] -> {title, body}
    # For now, we use 'zh' as default language.
    TEMPLATES: Dict[str, Dict[str, Dict[str, Any]]] = {
        "daily_brief": {
            "free": {
                "zh": {
                    "title": "📊 今日复盘已就绪",
                    "body": "{push_hook}"
                },
                "en": {
                    "title": "📊 Daily Recap Ready",
                    "body": "{push_hook}"
                }
            },
            "paid": {
                "zh": {
                    "title": "⭐ Pro 深度复盘已就绪",
                    "body": "{push_hook} | 含明日执行计划"
                },
                "en": {
                    "title": "⭐ Pro Daily Recap Ready",
                    "body": "{push_hook} | Action plan for tomorrow included"
                }
            }
        },
        "daily_brief_bullish": {
            "free": {
                "zh": {
                    "title": "🚀 今日复盘：机会信号集中",
                    "body": "{push_hook}"
                },
                "en": {
                    "title": "🚀 Daily Recap: Bullish Signals",
                    "body": "{push_hook}"
                }
            },
            "paid": {
                "zh": {
                    "title": "🟢 Pro 机会窗口已确认",
                    "body": "{push_hook} | 已附仓位与节奏建议"
                },
                "en": {
                    "title": "🟢 Pro Opportunity Confirmed",
                    "body": "{push_hook} | Sizing & timing advice included"
                }
            }
        },
        "daily_brief_bearish": {
            "free": {
                "zh": {
                    "title": "🛡️ 今日复盘：风险信号升温",
                    "body": "{push_hook}"
                },
                "en": {
                    "title": "🛡️ Daily Recap: Risk Warning",
                    "body": "{push_hook}"
                }
            },
            "paid": {
                "zh": {
                    "title": "🔴 Pro 避险信号已触发",
                    "body": "{push_hook} | 已附减仓与防守方案"
                },
                "en": {
                    "title": "🔴 Pro Risk-Off Alert",
                    "body": "{push_hook} | Exit & defense plans included"
                }
            }
        },
        "daily_brief_neutral": {
            "free": {
                "zh": {
                    "title": "📊 今日复盘：市场偏中性",
                    "body": "{push_hook}"
                },
                "en": {
                    "title": "📊 Daily Recap: Neutral Mood",
                    "body": "{push_hook}"
                }
            },
            "paid": {
                "zh": {
                    "title": "⚪ Pro 震荡策略更新",
                    "body": "{push_hook} | 已附观望与试仓边界"
                },
                "en": {
                    "title": "⚪ Pro Neutral Strategy Update",
                    "body": "{push_hook} | Observation & entry levels included"
                }
            }
        },
        "signal_flip": {
            "free": {
                "zh": {
                    "title": "🚨 信号反转：{stock_name}",
                    "body": "观点从 [{old_signal}] 变为 [{new_signal}]，置信度 {confidence_pct}%。点开看原因。"
                },
                "en": {
                    "title": "🚨 Signal Flip: {stock_name}",
                    "body": "Signal changed from [{old_signal}] to [{new_signal}] ({confidence_pct}% conf). Tap for details."
                }
            },
            "paid": {
                "zh": {
                    "title": "🎯 Pro 反转提醒：{stock_name}",
                    "body": "核心方向已切换到 [{new_signal}]。已生成仓位动作与风险阈值。"
                },
                "en": {
                    "title": "🎯 Pro Signal Flip: {stock_name}",
                    "body": "Direction flipped to [{new_signal}]. Sizing & risk levels updated."
                }
            }
        },
        "signal_flip_batch": {
            "free": {
                "zh": {
                    "title": "🎯 {count} 只关注股信号更新",
                    "body": "{stock_names} 等股票出现新的交易信号，点击查看详情。"
                },
                "en": {
                    "title": "🎯 {count} Signal Updates in Watchlist",
                    "body": "New signals for {stock_names}. Check details now."
                }
            },
            "paid": {
                "zh": {
                    "title": "🚨 Pro 自选池信号集中反转: {count} 只",
                    "body": "观测到 {stock_names} 等标的结构性转向。建议立即核对 Pro 盘中计划。"
                },
                "en": {
                    "title": "🚨 Pro Batch Signal Flip: {count} Symbols",
                    "body": "Structural reversal detected in {stock_names}. Please review Pro intraday plans."
                }
            }
        },
        "morning_call": {
            "free": {
                "zh": {
                    "title": "☕ 开盘前早报",
                    "body": "自选池情绪：[{sentiment_tag}]。重点观察 {stock_names} 等标的盘口异动。"
                },
                "en": {
                    "title": "☕ Pre-Market Brief",
                    "body": "Watchlist Mood: [{sentiment_tag}]. Watch {stock_names} for opening action."
                }
            },
            "paid": {
                "zh": {
                    "title": "☀️ Pro 开盘作战简报",
                    "body": "高优盯盘资产：{stock_names}。自选池情绪：[{sentiment_tag}]。带好战术防线入场。"
                },
                "en": {
                    "title": "☀️ Pro Opening Brief",
                    "body": "High-Priority: {stock_names}. Mood: [{sentiment_tag}]. Enter with tactical levels."
                }
            }
        },
        "morning_call_neutral": {
            "free": {
                "zh": {
                    "title": "☕ 开盘前早报：观望日",
                    "body": "自选池无明确多头信号，情绪：[{sentiment_tag}]。今日以耐心等待为主。"
                },
                "en": {
                    "title": "☕ Pre-Market: Wait & See",
                    "body": "No strong entry signals in watchlist. Mood: [{sentiment_tag}]. Patience is key today."
                }
            },
            "paid": {
                "zh": {
                    "title": "⚪ Pro 晨间简报：无进入机会",
                    "body": "池内标的处于逻辑真空期。情绪：[{sentiment_tag}]。建议保持空仓/低位观察，等待信号。"
                },
                "en": {
                    "title": "⚪ Pro Morning Brief: No Entry",
                    "body": "Logic vacuum in watchlist. Mood: [{sentiment_tag}]. Stay neutral and wait for resonance."
                }
            }
        },
        "validation_glory": {
            "free": {
                 "zh": {
                    "title": "📊 AI 策略执行追踪：{stock_names}",
                    "body": "该标的今日触及预测网格，录得日内最高浮盈 {peak_gain}%。进入详情查看 AI 复盘。"
                },
                "en": {
                    "title": "📊 AI Strategy Tracking: {stock_names}",
                    "body": "Grid hit! Intra-day peak gain: {peak_gain}%. Tap to view AI recap."
                }
            },
            "paid": {
                 "zh": {
                    "title": "🎯 Pro 策略复盘与进阶：{stock_names}",
                    "body": "已达成预期推演 (日内最高浮盈 {peak_gain}%)。最新止损边界与持仓计划已更新，请检查。"
                }
            }
        },
        "prediction_updated_alert": {
            "free": {
                "zh": {
                    "title": "⚡ {market_name} 最新异动已捕获",
                    "body": "模型扫描已完成。您的自选池中析出 {action_count} 个核心形态变化，建议立即查看 AI 评级。"
                },
                "en": {
                    "title": "⚡ {market_name} Movement Detected",
                    "body": "Scan complete. {action_count} core pattern changes found in your watchlist. Check AI ratings now."
                }
            },
            "paid": {
                "zh": {
                    "title": "🚨 Pro 盘后核心沙盘：发现战机",
                    "body": "{market_name} 模型算力结算完毕。已锁定 {action_count} 处建仓/防守级拐点，风控参数与进场节点已更新。"
                },
                "en": {
                    "title": "🚨 Pro Post-Market Sandbox: Opportunities",
                    "body": "{market_name} compute complete. {action_count} entry/defense pivots locked. Risk levels & entry points updated."
                }
            }
        },
        "prediction_updated_routine": {
            "free": {
                "zh": {
                    "title": "🔄 {market_name} 夜间推演完成",
                    "body": "全场标的走势模拟已更新。当前无结构性发散，请继续跟踪网格支撑位。"
                },
                "en": {
                    "title": "🔄 {market_name} Nightly Simulation Done",
                    "body": "Market simulation updated. No structural divergence found. Keep tracking grid support levels."
                }
            },
            "paid": {
                "zh": {
                    "title": "🛡️ Pro 盘后例行维护：阵型稳固",
                    "body": "{market_name} 核心标的深度评估完毕。当日无系统性风控事件，明日纪律计划已下发。"
                },
                "en": {
                    "title": "🛡️ Pro Post-Market Maintenance: Solid",
                    "body": "{market_name} assessment done. No systemic risk detected. Discipline plan for tomorrow issued."
                }
            }
        },
        # Canonical event type used by NotificationManager aggregation.
        # Keep this in sync with docs: `prediction_updated`.
        "prediction_updated": {
            "free": {
                "zh": {
                    "title": "🔄 {market_name} 预测已更新",
                    "body": "新一轮模型结算已完成，点击查看最新 AI 评级与关键位。"
                },
                "en": {
                    "title": "🔄 {market_name} Predictions Updated",
                    "body": "New model cycle is ready. Tap to view latest AI ratings and key levels."
                }
            },
            "paid": {
                "zh": {
                    "title": "🛡️ Pro {market_name} 盘后推演已完成",
                    "body": "策略计划与风控边界已同步更新，点击查看可执行动作。"
                },
                "en": {
                    "title": "🛡️ Pro {market_name} Post-Market Update",
                    "body": "Execution plan and risk boundaries are updated. Tap for actionable steps."
                }
            }
        },
        "price_update": {
            "all": {
                "zh": {
                    "title": "{stock_name} {emoji} {change_pct}%",
                    "body": "最新: {price} | 成交: {volume_formatted}"
                },
                "en": {
                    "title": "{stock_name} {emoji} {change_pct}%",
                    "body": "Last: {price} | Vol: {volume_formatted}"
                }
            }
        },
        "ai_radar_alert": {
            "paid": {
                "zh": {
                    "title": "🕵️ 结构雷达：{resonance_type}",
                    "body": "{stock_names} 现价 {current_price}。{strategy_tip}"
                },
                "en": {
                    "title": "🕵️ Structure Radar: {resonance_type}",
                    "body": "{stock_names} Price: {current_price}. {strategy_tip}"
                }
            }
        },
        "almanac_preview": {
            "all": {
                "zh": {
                    "title": "📜 明日投资黄历已出炉",
                    "body": "意境：{mood_tag} | 宜：{strategy}。抢先看明日市场势能推演。"
                },
                "en": {
                    "title": "📜 Tomorrow's Market Almanac Ready",
                    "body": "Mood: {mood_tag} | Best for: {strategy}. View tomorrow's energy map."
                }
            }
        },
        "almanac_ritual": {
            "all": {
                "zh": {
                    "title": "📜 今日投资黄历：{mood_tag}",
                    "body": "{strategy} | AI 天机：{insight_snippet}"
                },
                "en": {
                    "title": "📜 Daily Almanac: {mood_tag}",
                    "body": "{strategy} | AI Insight: {insight_snippet}"
                }
            }
        },
        # --- Service Hooks (Short strings for previews/hooks) ---
        "brief_hook_bullish": {
            "all": {
                "zh": {
                    "body": "📈 {stocks}{etc}出现上行动能，点击查看复盘与计划。"
                },
                "en": {
                    "body": "📈 Bullish momentum for {stocks}{etc}. Tap for recap & plan."
                }
            }
        },
        "brief_hook_bearish": {
            "all": {
                "zh": {
                    "body": "⚠️ {stocks}{etc}下行压力加大，点击查看风控建议。"
                },
                "en": {
                    "body": "⚠️ Bearish pressure for {stocks}{etc}. Tap for risk-off advice."
                }
            }
        },
        "brief_hook_neutral": {
            "all": {
                "zh": {
                    "body": "今日复盘：{count} 只股票中性震荡，点击查看执行边界。"
                },
                "en": {
                    "body": "Daily Recap: {count} stocks neutral/range-bound. Tap for levels."
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
        kwargs = dict(kwargs)
        if not kwargs.get("stock_name") and kwargs.get("symbol"):
            kwargs["stock_name"] = kwargs["symbol"]
        if kwargs.get("confidence_pct") is None and kwargs.get("confidence") is not None:
            try:
                kwargs["confidence_pct"] = int(float(kwargs["confidence"]) * 100)
            except Exception:
                pass
        kwargs = cls._normalize_template_kwargs(kwargs)

        # A. Resolve Tier & Type
        # Normalize Tier: Semantic distinction between 'free' and 'paid' (members)
        effective_tier = "free" if tier == "free" else "paid"

        type_group = cls.TEMPLATES.get(notif_type)
        if not type_group:
            logger.warning(f"⚠️ Template for type '{notif_type}' not found. Using default.")
            return cls._fallback_render(kwargs)

        # Tier Priority: Effective Tier -> 'all' -> 'free' -> 'paid' (last resort)
        tier_data = (
            type_group.get(effective_tier) 
            or type_group.get("all") 
            or type_group.get("free") 
            or type_group.get("paid")
        )
        if not tier_data:
            logger.error(f"❌ Failed to find tier '{effective_tier}' or fallback for type '{notif_type}'")
            return cls._fallback_render(kwargs)

        # B. Resolve Language
        lang_data = tier_data.get(lang) or tier_data.get("zh") # Default to zh if lang missing
        if not lang_data:
            logger.error(f"❌ Failed to find language '{lang}' for notification '{notif_type}'")
            return cls._fallback_render(kwargs)

        # C. Render with safe formatting
        try:
            title_tpl = lang_data.get("title", "重要更新")
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
        title = payload.get("title") or "重要更新"
        body = payload.get("body") or "您有一条新的 AI 策略通知，点击查看。"
        return str(title), str(body)

    @classmethod
    def _normalize_template_kwargs(cls, payload: Dict[str, Any]) -> Dict[str, Any]:
        normalized = dict(payload)
        for key, value in list(normalized.items()):
            if key == "stock_name" or not cls._should_format_price_field(key, value):
                continue
            normalized[key] = cls._format_price_value(value)
        return normalized

    @classmethod
    def _should_format_price_field(cls, key: str, value: Any) -> bool:
        if value is None:
            return False
        if not isinstance(value, (int, float)):
            return False
        if isinstance(value, bool):
            return False
        return key in cls.PRICE_FIELD_NAMES or key.endswith("_price")

    @staticmethod
    def _format_price_value(value: float) -> str:
        return f"{float(value):.2f}".rstrip("0").rstrip(".")
