"""
Notification Service Core Module.
Part of Phase 2: NotificationManager Core.
Handles notification logic, state tracking, and aggregation.
"""
import json
import uuid
from datetime import datetime
try:
    from backend.config import BEIJING_TZ
except ImportError:
    from config import BEIJING_TZ
from typing import List, Dict, Set, Optional

from database import get_connection, execute_with_retry
from backend.db_repo.queries import (
    SAVE_NOTIFICATION_LOG_QUERY, 
    GET_SIGNAL_STATE_QUERY, 
    UPDATE_SIGNAL_STATE_QUERY,
    GET_USER_TIER_QUERY,
    GET_USER_NOTIF_SETTINGS_QUERY
)
from backend.logger import logger
from notifications import send_push_notification
from notification_templates import NotificationTemplates
from backend.engine.signal_semantics import signal_weight


class NotificationManager:
    """
    Central manager for intelligent notifications.
    Handles signal flip detection, aggregation, and analytics logging.
    """

    def __init__(self, conn=None, dry_run=False):
        """
        Args:
            conn: Optional database connection. If None, handles connections internally.
            dry_run: If True, simulates sending without calling external APIs.
        """
        self.conn = conn
        self.dry_run = dry_run
        self.queued_notifications: Dict[str, List[dict]] = {}  # user_id -> List[event]
        self.signal_cache: Dict[str, Dict[str, dict]] = {}  # user_id -> {symbol -> state_dict}
        self.pending_state_updates: List[dict] = []  # List of state updates to flush to DB
        self.user_profile_cache: Dict[str, Dict[str, str]] = {}  # user_id -> {tier, locale}
        self._sub_cache: Dict[str, bool] = {}  # user_id -> has_subscription
        
        # Internal stats
        self.stats = {
            "processed": 0,
            "flips_detected": 0,
            "notifications_queued": 0,
            "notifications_sent": 0,
            "skipped_by_preference": 0,
            "errors": 0
        }

    def _get_conn(self):
        """Helper to get a connection if one wasn't provided."""
        return self.conn if self.conn else get_connection()

    def load_signal_states(self, user_ids: List[str], symbols: List[str]):
        """
        Pre-load signal states from DB into memory for efficient comparison.
        Optimized for the runner's loop.
        """
        if not user_ids or not symbols:
            return

        conn = self._get_conn()
        try:
            cursor = conn.cursor()
            # Construct placeholders for large sets if needed, but usually limited by runner batch
            # For simplicity using simple query
            user_placeholders = ",".join(["?"] * len(user_ids))
            symbol_placeholders = ",".join(["?"] * len(symbols))
            
            query = f"""
                SELECT user_id, symbol, last_signal, last_confidence, last_notified_at
                FROM signal_states
                WHERE user_id IN ({user_placeholders}) AND symbol IN ({symbol_placeholders})
            """
            params = tuple(user_ids) + tuple(symbols)
            cursor.execute(query, params)
            rows = cursor.fetchall()
            
            for row in rows:
                uid, sym, sig, conf, notified_at = row
                if uid not in self.signal_cache:
                    self.signal_cache[uid] = {}
                self.signal_cache[uid][sym] = {
                    "signal": sig,
                    "confidence": conf,
                    "notified_at": notified_at
                }
            
            logger.info(f"📥 [NotificationManager] Loaded {len(rows)} signal states into cache")
            
        except Exception as e:
            logger.error(f"❌ [NotificationManager] Failed to load signal states: {e}")
        finally:
            if not self.conn:
                conn.close()

    # Signal Weights definition
    SIGNAL_WEIGHTS = {
        "Strong Bullish": 2,
        "Bullish": 1,
        "Neutral": 0,
        "Bearish": -1,
        "Strong Bearish": -2,
    }

    # Tag → preference key mapping. Normalizes sub-variant tags to the
    # canonical preference key used in users.notification_settings.
    # KEEP IN SYNC with: frontend/src/app/api/internal/notify/route.ts::PREF_KEY_MAP
    PREF_KEY_MAP = {
        "daily_brief_bullish": "daily_brief",
        "daily_brief_bearish": "daily_brief",
        "daily_brief_neutral": "daily_brief",
        "morning_call_neutral": "morning_call",
        "signal_flip_batch": "signal_flip",
        "almanac_preview": "market_almanac",
        "almanac_ritual": "market_almanac",
        "prediction_ready": "prediction_updated",  # Legacy tag compat
    }

    # [Option A Implementation]
    # Categories that are ONLY available to Pro/Premium users.
    # If a Free user triggers these, they will be silently dropped.
    ADVANCED_CATEGORIES = {
        "signal_flip_batch",
        "ai_radar_alert"
    }

    def check_signal_flip(self, user_id: str, symbol: str, new_signal: str, new_confidence: float) -> Optional[dict]:
        """
        Compare new prediction with cached state to detect a 'Signal Flip'.
        Implements Cross-Zero Logic: Only notifies if trend direction changes fundamentally.
        """
        self.stats["processed"] += 1
        
        cached_state = self.signal_cache.get(user_id, {}).get(symbol)
        
        # Always update the registry with the latest state
        self.pending_state_updates.append({
            "user_id": user_id,
            "symbol": symbol,
            "signal": new_signal,
            "confidence": new_confidence
        })

        if not cached_state:
            # Initial state: No flip notification to avoid spam
            return None

        old_signal = cached_state["signal"]
        
        # --- Cross-Zero Logic Implementation ---
        
        old_weight = self.SIGNAL_WEIGHTS.get(old_signal, signal_weight(old_signal))
        new_weight = self.SIGNAL_WEIGHTS.get(new_signal, signal_weight(new_signal))
        
        # Criteria 1: Zero-Crossing (Fundamental Direction Change)
        # Examples: -1 -> 1 (Flip), 1 -> -1 (Flip), 0 -> 1 (Flip), 1 -> 0 (Exit Signal - Optional)
        
        # We define a "Flip" as entering a NEW active territory (Bullish or Bearish)
        # from a different territory (Opposite or Neutral).
        
        is_flip = False
        
        # Case A: Bullish Entry (Previous was Neutral or Bearish)
        if new_weight > 0 and old_weight <= 0:
            is_flip = True
            
        # Case B: Bearish Entry (Previous was Neutral or Bullish)
        elif new_weight < 0 and old_weight >= 0:
            is_flip = True
            
        # Note: We intentionally ignore:
        # 1. 1 -> 2 (Strengthening): Good, but not a "Flip"
        # 2. 2 -> 1 (Weakening): Still bullish, hold.
        # 3. 1 -> 0 (Neutralizing): This is an 'Exit' signal, could be treated separately, 
        #    but for now we focus on 'Entry' flips based on user feedback.
        
        if is_flip:
            self.stats["flips_detected"] += 1
            flip_event = {
                "symbol": symbol,
                "old_signal": old_signal,
                "new_signal": new_signal,
                "confidence": new_confidence,
                "timestamp": datetime.now(BEIJING_TZ).isoformat()
            }
            
            # Queue for aggregation
            self.queue_notification(user_id, "signal_flip", flip_event)
            
            return flip_event
            
        return None

    def queue_notification(self, user_id: str, event_type: str, payload: dict):
        """Add to user's pending notification queue."""
        if user_id not in self.queued_notifications:
            self.queued_notifications[user_id] = []
        
        payload["type"] = event_type
        self.queued_notifications[user_id].append(payload)
        self.stats["notifications_queued"] += 1

    def flush(self) -> int:
        """
        Main exit point:
        1. Aggregates queued notifications per user.
        2. Sends them via Push API (with analytics tracking).
        3. Persists state changes to signal_states.
        4. Logs to notification_logs.
        """
        total_sent = 0
        
        # 1 & 2: Process Queued Notifications
        for user_id, events in self.queued_notifications.items():
            if not events:
                continue
                
            # Pre-fetch user profile for rendering
            profile = self._get_user_profile(user_id)
            payload = self._aggregate_notifications(user_id, events, profile)
            if payload:
                success = self._send_notification(user_id, payload)
                if success:
                    total_sent += 1
                    self.stats["notifications_sent"] += 1
        
        # 3: Flush State Updates
        if self.pending_state_updates:
            self._persist_signal_states()
            
        # Clear queues
        self.queued_notifications.clear()
        self.pending_state_updates.clear()
        
        return total_sent

    def _get_user_profile(self, user_id: str) -> Dict[str, str]:
        """Fetch or return cached user profile (tier and locale)."""
        if user_id in self.user_profile_cache:
            return self.user_profile_cache[user_id]
        
        conn = self._get_conn()
        try:
            cursor = conn.cursor()
            cursor.execute(GET_USER_TIER_QUERY, (user_id,))
            row = cursor.fetchone()
            
            # Default profile: free tier, cn locale
            profile = {"tier": "free", "locale": "cn"}
            
            if row:
                if len(row) >= 1 and row[0] in {"free", "go", "plus", "pro", "premium"}:
                    profile["tier"] = row[0] or "free"
                if len(row) >= 2 and row[1]:
                    profile["locale"] = row[1] or "cn"
                
            self.user_profile_cache[user_id] = profile
            return profile
        except Exception as e:
            logger.warning(f"⚠️ Failed to get user profile for {user_id}: {e}")
            return {"tier": "free", "locale": "cn"}
        finally:
            if not self.conn:
                conn.close()

    def _resolve_stock_display_names(self, symbols: List[str], lang: str = "zh") -> List[str]:
        """
        Resolve stock display names from stock_meta for push copy.
        Falls back to symbol when name is unavailable.
        """
        if not symbols:
            return []

        unique_symbols = list(dict.fromkeys(symbols))
        conn = self._get_conn()
        name_map: Dict[str, str] = {}
        try:
            cursor = conn.cursor()
            placeholders = ",".join(["?"] * len(unique_symbols))
            cursor.execute(
                f"SELECT symbol, name, name_en FROM stock_meta WHERE symbol IN ({placeholders})",
                tuple(unique_symbols),
            )
            for row in cursor.fetchall():
                symbol, name_zh, name_en = row
                chosen_name = name_en if lang == "en" and name_en else name_zh
                if chosen_name and str(chosen_name).strip():
                    name_map[str(symbol)] = str(chosen_name).strip()
        except Exception as e:
            logger.debug(f"⚠️ Failed to resolve stock names for symbols {unique_symbols}: {e}")
        finally:
            if not self.conn:
                conn.close()

        return [name_map.get(sym, sym) for sym in unique_symbols]

    def _aggregate_notifications(
        self,
        user_id: str,
        events: List[dict],
        user_profile: Optional[dict] = None,
        user_tier: Optional[str] = None,
        user_locale: Optional[str] = None,
    ) -> Optional[dict]:
        """
        Logic to merge multiple notifications into a single, clean push message.
        """
        if not events:
            return None

        if not user_profile:
            user_profile = self._get_user_profile(user_id)
        if user_tier:
            user_profile["tier"] = user_tier
        if user_locale:
            user_profile["locale"] = user_locale
            
        tier = user_profile.get("tier", "free")
        lang = user_profile.get("locale", "cn")
            
        # 1. Handle Morning Call (Take the first one if multiple, usually just one)
        mc_events = [e for e in events if e["type"] in ("morning_call", "morning_call_neutral")]
        if mc_events:
            e = mc_events[0]
            # Use all fields from event as context for template rendering
            title, body = NotificationTemplates.render(
                e["type"], 
                tier=tier, 
                lang=lang,
                **e
            )
            return {
                "title": title,
                "body": body,
                "url": e.get("url") or "/monitor?utm_source=push&utm_campaign=morning_call",
                "type": e["type"],
                "related_symbols": e.get("related_symbols") or []
            }

        # 2. Handle Signal Flips
        flips = [e for e in events if e["type"] == "signal_flip"]
        
        if flips:
            if len(flips) == 1:
                e = flips[0]
                stock_name = self._resolve_stock_display_names([e["symbol"]], lang=lang)[0]
                title, body = NotificationTemplates.render(
                    "signal_flip", 
                    tier=tier, 
                    lang=lang,
                    stock_name=stock_name,
                    old_signal=e["old_signal"], 
                    new_signal=e["new_signal"],
                    confidence_pct=int(e["confidence"]*100)
                )
                url = f"/dashboard?symbol={e['symbol']}&utm_source=push&utm_medium=smart_notify"
            else:
                symbols = [e["symbol"] for e in flips]
                stock_names = self._resolve_stock_display_names(symbols, lang=lang)
                title, body = NotificationTemplates.render(
                    "signal_flip_batch", 
                    tier=tier, 
                    lang=lang,
                    count=len(flips),
                    stock_names=", ".join(stock_names)
                )
                url = f"/dashboard?utm_source=push&utm_medium=smart_notify_batch"
                
            return {
                "title": title,
                "body": body,
                "url": url,
                "type": "signal_flip",
                "related_symbols": [e["symbol"] for e in flips]
            }

        # 3. Handle Validation Glory (AI Wins)
        wins = [e for e in events if e["type"] == "validation_glory"]
        if wins:
            # Usually only one per run, but we take the most recent
            e = wins[0]
            title, body = NotificationTemplates.render(
                "validation_glory", 
                tier=tier, 
                lang=lang,
                **e
            )
            return {
                "title": title,
                "body": body,
                "url": e["url"],
                "type": "validation_glory",
                "related_symbols": e.get("related_symbols", [])
            }

        # 4. Handle Daily Brief variants
        daily_briefs = [
            e for e in events
            if e["type"] in ("daily_brief", "daily_brief_bullish", "daily_brief_bearish", "daily_brief_neutral")
        ]
        if daily_briefs:
            e = daily_briefs[0]
            push_hook = e.get("push_hook") or "点击查看今日 AI 复盘"
            title, body = NotificationTemplates.render(
                e["type"],
                tier=tier,
                lang=lang,
                push_hook=push_hook
            )
            return {
                "title": title,
                "body": body,
                "url": e.get("url", "/dashboard?brief=true"),
                "type": e["type"],
                "related_symbols": e.get("related_symbols", [])
            }

        # 5. Handle Prediction Updated (Service Level)
        updates = [e for e in events if e["type"] == "prediction_updated"]
        if updates:
            # Aggregate: "HK Market updated" or "5 stocks updated"
            market_names = {e.get("market", "CN") for e in updates} # distinct markets
            m_str = "/".join(sorted(market_names)) + " 市场"
            
            title, body = NotificationTemplates.render(
                "prediction_updated",
                tier=tier,
                lang=lang,
                market_name=m_str
            )
            
            return {
                "title": title,
                "body": body,
                "url": "/dashboard?utm_source=push&utm_medium=prediction_updated",
                "type": "prediction_updated",
                "related_symbols": list(dict.fromkeys([e["symbol"] for e in updates]))
            }
            
        # 6. Handle Market Almanac
        almanacs = [e for e in events if e["type"] in ("almanac_preview", "almanac_ritual")]
        if almanacs:
            e = almanacs[0]
            title, body = NotificationTemplates.render(
                e["type"], 
                tier=tier, 
                lang=lang,
                **e
            )
            return {
                "title": title,
                "body": body,
                "url": e["url"],
                "type": e["type"],
                "related_symbols": []
            }

        return None

    def _check_user_preference(self, user_id: str, notif_type: str) -> bool:
        """
        Check if user has enabled this notification type.
        Returns True if allowed to send, False to skip.
        """
        conn = self._get_conn()
        try:
            cursor = conn.cursor()
            cursor.execute(GET_USER_NOTIF_SETTINGS_QUERY, (user_id,))
            row = cursor.fetchone()
            
            if not row or not row[0]:
                return True  # Default: all enabled if no settings
            
            settings = json.loads(row[0])
            
            # Global switch check
            if not settings.get("enabled", True):
                return False
            
            # Type-specific check
            pref_key = self.PREF_KEY_MAP.get(notif_type, notif_type)

            type_settings = settings.get("types", {}).get(pref_key, {})
            return type_settings.get("enabled", True)
            
        except Exception as e:
            logger.debug(f"⚠️ Failed to check user preference: {e}")
            return True  # Fail-open: send if we can't check
        finally:
            if not self.conn:
                conn.close()

    def _has_push_subscription(self, user_id: str) -> bool:
        """Check if user has at least one active push subscription.
        Cached per-instance to avoid repeated DB queries within one flush cycle."""
        if user_id in self._sub_cache:
            return self._sub_cache[user_id]

        conn = self._get_conn()
        try:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT 1 FROM push_subscriptions WHERE user_id = ? LIMIT 1",
                (user_id,)
            )
            has_sub = cursor.fetchone() is not None
            self._sub_cache[user_id] = has_sub
            return has_sub
        except Exception as e:
            logger.debug(f"⚠️ Failed to check push subscription for {user_id}: {e}")
            return True  # Fail-open
        finally:
            if not self.conn:
                conn.close()

    def _send_notification(self, user_id: str, payload: dict) -> bool:
        """Helper to send push and log it."""
        log_id = f"notif_{uuid.uuid4().hex[:12]}"
        
        # 1. Tier & Category Guard (Option A)
        notif_type = payload.get("type", "unknown")
        profile = self._get_user_profile(user_id)
        tier = profile.get("tier", "free")
        
        if tier == "free" and notif_type in self.ADVANCED_CATEGORIES:
            logger.debug(f"🛑 [TierGuard] User {user_id} is FREE, blocking advanced notification '{notif_type}'")
            return False

        # 2. Check user preferences before sending
        if not self._check_user_preference(user_id, notif_type):
            logger.debug(f"⏭️ User {user_id} has disabled '{notif_type}' notifications, skipping")
            self.stats["skipped_by_preference"] += 1
            return False

        # 3. Pre-check: Skip HTTP call if user has no push subscription
        if not self.dry_run and not self._has_push_subscription(user_id):
            logger.debug(f"⏭️ User {user_id} has no push subscription, skipping HTTP call")
            return False
        
        # Add tracking ID to URL
        tracked_url = payload["url"]
        if "?" in tracked_url:
            tracked_url += f"&nid={log_id}"
        else:
            tracked_url += f"?nid={log_id}"
            
        if self.dry_run:
            logger.info(f"🧪 [DryRun] User {user_id} <- {payload['title']} | ID: {log_id}")
            dry_payload = dict(payload)
            dry_payload["url"] = tracked_url
            self._log_to_db(log_id, user_id, dry_payload)
            return True
            
        try:
            # Call existing notifications.py utility
            delivered = send_push_notification(
                title=payload["title"],
                body=payload["body"],
                url=tracked_url,
                target_user_id=user_id,
                tag=payload["type"],
                skip_log=True
            )
            if not delivered:
                logger.warning(f"⚠️ Notification {log_id} ({notif_type}) 未成功送达，跳过落库")
                self.stats["errors"] += 1
                return False
            
            # Log successful dispatch
            logged_payload = dict(payload)
            logged_payload["url"] = tracked_url
            self._log_to_db(log_id, user_id, logged_payload)
            return True
        except Exception as e:
            logger.error(f"❌ Failed to send notification {log_id} (type: {notif_type}): {e}")
            self.stats["errors"] += 1
            return False

    def _log_to_db(self, log_id: str, user_id: str, payload: dict):
        """Persist notification record for analytics."""
        conn = self._get_conn()
        try:
            cursor = conn.cursor()
            cursor.execute(SAVE_NOTIFICATION_LOG_QUERY, (
                log_id, user_id, payload["type"], 
                json.dumps(payload.get("related_symbols", [])), 
                payload["title"], payload["body"], payload["url"]
            ))
            if not self.conn:
                conn.commit()
        except Exception as e:
            logger.error(f"❌ Failed to log notification to DB: {e}")
        finally:
            if not self.conn:
                conn.close()

    def _persist_signal_states(self):
        """Bulk update signal states to avoid O(N) queries."""
        conn = self._get_conn()
        try:
            cursor = conn.cursor()
            now = datetime.now(BEIJING_TZ).isoformat()
            
            for update in self.pending_state_updates:
                cursor.execute(UPDATE_SIGNAL_STATE_QUERY, (
                    update["user_id"], update["symbol"], 
                    update["signal"], update["confidence"], now
                ))
            
            if not self.conn:
                conn.commit()
            logger.info(f"💾 [NotificationManager] Persisted {len(self.pending_state_updates)} signal state changes")
        except Exception as e:
            logger.error(f"❌ Failed to persist signal states: {e}")
        finally:
            if not self.conn:
                conn.close()

    def broadcast_price_alert(self, symbol: str, event_type: str, context: dict, tag: str = "price_update"):
        """
        Intraday specific: Send immediate alert to all users watching this stock.
        Used by IntradayMonitor and Prices Sync.
        """
        conn = get_connection()
        try:
            cursor = conn.cursor()
            # 1. Get all users watching this stock
            cursor.execute("SELECT user_id FROM user_watchlist WHERE symbol = ?", (symbol,))
            users = [r[0] for r in cursor.fetchall()]
            
            if not users:
                logger.info(f"🔕 No watchers for {symbol}, alert skipped.")
                return

            logger.info(f"📢 Broadcasting {event_type} for {symbol} to {len(users)} users...")
            
            # 2. Filter & Send
            for uid in users:
                # Pre-check: skip if user has no push subscription
                if not self._has_push_subscription(uid):
                    continue

                # Fetch user profile (tier + locale)
                profile = self._get_user_profile(uid)
                tier = profile.get("tier", "free")
                lang = profile.get("locale", "cn")

                # Fetch settings for preference check
                if not self._check_user_preference(uid, event_type):
                    continue
                
                # Render content per user language
                try:
                    title, body = NotificationTemplates.render(
                        event_type,
                        tier=tier,
                        lang=lang,
                        **context
                    )
                except Exception as e:
                    logger.warning(f"⚠️ Template render failed for user {uid} ({lang}): {e}")
                    continue

                # Send Push
                try:
                    log_id = f"price_{uuid.uuid4().hex[:12]}"
                    delivered = send_push_notification(
                        target_user_id=uid, 
                        title=title, 
                        body=body, 
                        url=context.get("url", f"/dashboard/stock/{symbol}"),
                        tag=tag,
                        skip_log=True
                    )
                    if not delivered:
                        self.stats["errors"] += 1
                        continue
                    
                    # Log for audit trail
                    self._log_to_db(log_id, uid, {
                        "type": event_type,
                        "related_symbols": [symbol],
                        "title": title,
                        "body": body,
                        "url": context.get("url", f"/dashboard/stock/{symbol}")
                    })
                except Exception as e:
                    logger.error(f"❌ Failed to broadcast to {uid}: {e}")
                    self.stats["errors"] += 1
            
        except Exception as e:
            logger.error(f"❌ Broadcast failed: {e}")
        finally:
            conn.close()
