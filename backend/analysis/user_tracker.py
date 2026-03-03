"""
User Completion Tracker for AI Analysis.
Helps track when a user's entire watchlist has been analyzed to send a single notification.
"""
from typing import List, Dict, Set
try:
    from backend.database import get_connection
    from backend.logger import logger
    from backend.notifications import send_push_notification
except ImportError:
    from database import get_connection
    from logger import logger
    from notifications import send_push_notification

class UserCompletionTracker:
    def __init__(self):
        self.user_watchlists: Dict[str, Set[str]] = {}  # user_id -> set of symbols
        self.user_pending: Dict[str, Set[str]] = {}     # user_id -> set of pending symbols
        self.stock_to_users: Dict[str, Set[str]] = {}   # symbol -> set of user_ids

    def load_watchlists(self, active_symbols: List[str]):
        """Load watchlists for users who are watching at least one of the active symbols."""
        if not active_symbols:
            return

        conn = get_connection()
        try:
            cursor = conn.cursor()
            placeholders = ','.join(['?'] * len(active_symbols))
            
            # Find all users who watch these stocks
            query = f"""
                SELECT uw.user_id, uw.symbol
                FROM user_watchlist uw
                WHERE EXISTS (
                    SELECT 1 FROM user_watchlist uw2 
                    WHERE uw2.user_id = uw.user_id 
                    AND uw2.symbol IN ({placeholders})
                )
            """
            cursor.execute(query, active_symbols)
            rows = cursor.fetchall()
            
            for uid, sym in rows:
                if uid not in self.user_watchlists:
                    self.user_watchlists[uid] = set()
                    self.user_pending[uid] = set()
                
                self.user_watchlists[uid].add(sym)
                
                # We only care about pending symbols that are in the CURRENT active run
                if sym in active_symbols:
                    self.user_pending[uid].add(sym)
                    
                    if sym not in self.stock_to_users:
                        self.stock_to_users[sym] = set()
                    self.stock_to_users[sym].add(uid)
            
            logger.info(f"📊 [Tracker] Tracking {len(self.user_watchlists)} users across {len(active_symbols)} symbols.")
        except Exception as e:
            logger.error(f"❌ [Tracker] Failed to load watchlists: {e}")
        finally:
            conn.close()

    def mark_stock_complete(self, symbol: str) -> List[str]:
        """Mark a stock as analyzed and return a list of user_ids who just finished their whole list."""
        ready_users = []
        if symbol not in self.stock_to_users:
            return ready_users

        for uid in self.stock_to_users[symbol]:
            if uid in self.user_pending and symbol in self.user_pending[uid]:
                self.user_pending[uid].remove(symbol)
                
                if not self.user_pending[uid]:
                    ready_users.append(uid)
                    # Clean up to avoid double notification
                    del self.user_pending[uid]
        
        return ready_users

def notify_user_prediction_updated(user_id: str, market: str = "CN"):
    """Send a push notification to the user that their analysis is ready."""
    market_name = "港股" if market == "HK" else "A股"
    send_push_notification(
        title=f"📈 {market_name} AI 分析已更新",
        body="你关注的股票今日 AI 预测信号已全部生成，点击查看详情。",
        url="/dashboard?utm_source=push&utm_medium=prediction_ready",
        target_user_id=user_id,
        tag="prediction_ready"
    )
