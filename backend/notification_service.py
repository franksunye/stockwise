"""
Notification Service Core Module.
Part of Phase 2: NotificationManager Core.
Handles notification logic, state tracking, and aggregation.
"""
import json
import uuid
from datetime import datetime
from typing import List, Dict, Set, Optional

from database import get_connection, execute_with_retry
from logger import logger
from notifications import send_push_notification
from notification_templates import NotificationTemplates


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
        self.user_tier_cache: Dict[str, str] = {}  # user_id -> tier
        
        # Internal stats
        self.stats = {
            "processed": 0,
            "flips_detected": 0,
            "notifications_queued": 0,
            "notifications_sent": 0
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

    def check_signal_flip(self, user_id: str, symbol: str, new_signal: str, new_confidence: float) -> Optional[dict]:
        """
        Compare new prediction with cached state to detect a 'Signal Flip'.
        """
        self.stats["processed"] += 1
        
        cached_state = self.signal_cache.get(user_id, {}).get(symbol)
        
        # Flip logic:
        # 1. No previous state -> Initial flip (Silent or Notify? Usually Notify if significant)
        # 2. Signal changed (e.g. Side -> Long, Long -> Short) -> Notify
        # 3. Confidence improved significantly (Optional, maybe for Phase 4)
        
        is_flip = False
        old_signal = None
        
        if not cached_state:
            # Initial prediction: Update state but DO NOT notify (avoid spam on new watchlist)
            is_flip = False
            old_signal = None
        elif cached_state["signal"] != new_signal:
            is_flip = True
            old_signal = cached_state["signal"]
            
        # Always update the registry with the latest state
        self.pending_state_updates.append({
            "user_id": user_id,
            "symbol": symbol,
            "signal": new_signal,
            "confidence": new_confidence
        })

        if is_flip:
            self.stats["flips_detected"] += 1
            flip_event = {
                "symbol": symbol,
                "old_signal": old_signal,
                "new_signal": new_signal,
                "confidence": new_confidence,
                "timestamp": datetime.now().isoformat()
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
                
            # Pre-fetch user tier for rendering
            user_tier = self._get_user_tier(user_id)
            payload = self._aggregate_notifications(user_id, events, user_tier)
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

    def _get_user_tier(self, user_id: str) -> str:
        """Fetch or return cached user tier."""
        if user_id in self.user_tier_cache:
            return self.user_tier_cache[user_id]
        
        conn = self._get_conn()
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT subscription_tier FROM users WHERE user_id = ?", (user_id,))
            row = cursor.fetchone()
            tier = row[0] if row and row[0] else "free"
            self.user_tier_cache[user_id] = tier
            return tier
        except Exception:
            return "free"
        finally:
            if not self.conn:
                conn.close()

    def _aggregate_notifications(self, user_id: str, events: List[dict], user_tier: str = "free") -> Optional[dict]:
        """
        Logic to merge multiple notifications into a single, clean push message.
        """
        if not events:
            return None
            
        # 1. Handle Morning Call (Take the first one if multiple, usually just one)
        mc_events = [e for e in events if e["type"] in ("morning_call", "morning_call_neutral")]
        if mc_events:
            e = mc_events[0]
            # Use all fields from event as context for template rendering
            title, body = NotificationTemplates.render(
                e["type"], 
                tier=user_tier, 
                **e
            )
            return {
                "title": title,
                "body": body,
                "url": e["url"],
                "type": e["type"],
                "related_symbols": e.get("related_symbols", [])
            }

        # 2. Handle Signal Flips
        flips = [e for e in events if e["type"] == "signal_flip"]
        
        if flips:
            if len(flips) == 1:
                e = flips[0]
                title, body = NotificationTemplates.render(
                    "signal_flip", 
                    tier=user_tier, 
                    symbol=e["symbol"], 
                    old_signal=e["old_signal"], 
                    new_signal=e["new_signal"],
                    confidence_pct=int(e["confidence"]*100)
                )
                url = f"/dashboard?symbol={e['symbol']}&utm_source=push&utm_medium=smart_notify"
            else:
                symbols = [e["symbol"] for e in flips]
                title, body = NotificationTemplates.render(
                    "signal_flip_batch", 
                    tier=user_tier, 
                    count=len(flips),
                    symbols=", ".join(symbols)
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
                tier=user_tier, 
                title=e["title"], 
                body=e["body"]
            )
            return {
                "title": title,
                "body": body,
                "url": e["url"],
                "type": "validation_glory",
                "related_symbols": e.get("related_symbols", [])
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
            cursor.execute("SELECT notification_settings FROM users WHERE user_id = ?", (user_id,))
            row = cursor.fetchone()
            
            if not row or not row[0]:
                return True  # Default: all enabled if no settings
            
            settings = json.loads(row[0])
            
            # Global switch check
            if not settings.get("enabled", True):
                return False
            
            # Type-specific check
            type_settings = settings.get("types", {}).get(notif_type, {})
            return type_settings.get("enabled", True)
            
        except Exception as e:
            logger.debug(f"⚠️ Failed to check user preference: {e}")
            return True  # Fail-open: send if we can't check
        finally:
            if not self.conn:
                conn.close()

    def _send_notification(self, user_id: str, payload: dict) -> bool:
        """Helper to send push and log it."""
        log_id = f"notif_{uuid.uuid4().hex[:12]}"
        
        # [NEW] Check user preferences before sending
        notif_type = payload.get("type", "unknown")
        if not self._check_user_preference(user_id, notif_type):
            logger.debug(f"⏭️ User {user_id} has disabled '{notif_type}' notifications, skipping")
            return False
        
        # Add tracking ID to URL
        tracked_url = payload["url"]
        if "?" in tracked_url:
            tracked_url += f"&nid={log_id}"
        else:
            tracked_url += f"?nid={log_id}"
            
        if self.dry_run:
            logger.info(f"🧪 [DryRun] User {user_id} <- {payload['title']} | ID: {log_id}")
            self._log_to_db(log_id, user_id, payload)
            return True
            
        try:
            # Call existing notifications.py utility
            send_push_notification(
                title=payload["title"],
                body=payload["body"],
                url=tracked_url,
                target_user_id=user_id,
                tag=payload["type"]
            )
            
            # Log successful dispatch
            self._log_to_db(log_id, user_id, payload)
            return True
        except Exception as e:
            logger.error(f"❌ Failed to send notification {log_id}: {e}")
            return False

    def _log_to_db(self, log_id: str, user_id: str, payload: dict):
        """Persist notification record for analytics."""
        conn = self._get_conn()
        try:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO notification_logs (id, user_id, type, related_symbols, title, body, url)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
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
            now = datetime.now().isoformat()
            
            for update in self.pending_state_updates:
                cursor.execute("""
                    INSERT OR REPLACE INTO signal_states (user_id, symbol, last_signal, last_confidence, last_notified_at)
                    VALUES (?, ?, ?, ?, ?)
                """, (
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
