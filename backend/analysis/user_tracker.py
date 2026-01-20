"""
User Completion Tracker for AI Prediction Notifications

This module provides a memory-efficient tracker to monitor when all stocks
in a user's watchlist have been analyzed, triggering immediate notifications.
"""
import time
from typing import Set, Dict, List
from backend.database import get_connection
from backend.logger import logger


class UserCompletionTracker:
    """
    Tracks user watchlist completion progress during AI prediction runs.
    Uses reverse indexing (stock -> users) for O(1) lookup performance.
    """
    
    def __init__(self):
        self.pending_counts: Dict[str, int] = {}  # user_id -> remaining stock count
        self.stock_subscribers: Dict[str, Set[str]] = {}  # symbol -> set of user_ids
        self.notified_users: Set[str] = set()  # users already notified
        
    def load_watchlists(self, target_stocks: List[str]):
        """
        Load user watchlists and build reverse index.
        Only tracks stocks that are in the target_stocks list.
        
        Args:
            target_stocks: List of stock symbols that will be analyzed in this run
        """
        if not target_stocks:
            logger.warning("⚠️ [Tracker] No target stocks provided, tracker will be empty")
            return
        
        conn = get_connection()
        try:
            cursor = conn.cursor()
            
            # Fetch all watchlist entries (user_id, symbol pairs)
            # We fetch all and filter in Python to avoid large IN clauses
            cursor.execute("SELECT user_id, symbol FROM user_watchlist")
            all_watchlist = cursor.fetchall()
            
            target_set = set(target_stocks)
            
            # Build reverse index and count pending stocks per user
            for user_id, symbol in all_watchlist:
                if symbol not in target_set:
                    continue  # Skip stocks not in this run's scope
                
                # Add to reverse index
                if symbol not in self.stock_subscribers:
                    self.stock_subscribers[symbol] = set()
                self.stock_subscribers[symbol].add(user_id)
                
                # Increment user's pending count
                if user_id not in self.pending_counts:
                    self.pending_counts[user_id] = 0
                self.pending_counts[user_id] += 1
            
            logger.info(
                f"📊 [Tracker] Loaded {len(self.pending_counts)} users watching "
                f"{len(self.stock_subscribers)} stocks (from {len(target_stocks)} targets)"
            )
            
        except Exception as e:
            logger.error(f"❌ [Tracker] Failed to load watchlists: {e}")
        finally:
            conn.close()
    
    def mark_stock_complete(self, symbol: str) -> List[str]:
        """
        Mark a stock as analyzed and check if any users are now complete.
        
        Args:
            symbol: Stock symbol that was just analyzed
            
        Returns:
            List of user_ids whose watchlists are now fully analyzed
        """
        # Get users watching this stock
        users = self.stock_subscribers.get(symbol, set())
        
        ready_users = []
        for uid in users:
            if uid in self.notified_users:
                continue  # Already notified, skip
            
            # Decrement pending count
            self.pending_counts[uid] -= 1
            
            # Check if user is complete
            if self.pending_counts[uid] <= 0:
                ready_users.append(uid)
                self.notified_users.add(uid)
                logger.debug(f"✅ [Tracker] User {uid} watchlist complete")
        
        return ready_users
    
    def clear(self):
        """Explicitly clear all tracking data to free memory"""
        self.pending_counts.clear()
        self.stock_subscribers.clear()
        self.notified_users.clear()
        logger.debug("🧹 [Tracker] Cleared all tracking data")


def notify_user_prediction_updated(user_id: str):
    """
    Send push notification to user when their watchlist predictions are complete.
    
    Args:
        user_id: User to notify
    """
    try:
        from backend.notifications import send_push_notification
    except ImportError:
        from notifications import send_push_notification
    
    try:
        send_push_notification(
            title="🤖 AI 预测已更新",
            body="您关注的股票信号已全部更新，点击查看最新趋势。",
            url="/dashboard",
            target_user_id=user_id,
            tag="ai_prediction"
        )
        logger.info(f"✅ [Notify] User {user_id} notified for prediction update")
        
    except Exception as e:
        logger.error(f"❌ [Notify] Failed to notify user {user_id} for prediction: {e}")
        # Don't raise - allow analysis to continue
