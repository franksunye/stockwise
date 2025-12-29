import database
# Force local DB for testing if Turso is unreachable
database.TURSO_DB_URL = None

from database import init_db
from main import check_stock_analysis_mode

init_db()

# Test Case 1: A stock that the Pro user watches
# Find a stock from database first? Or rely on user input.
# I will query user_watchlist first to see what is there.

conn = database.get_connection()
cursor = conn.cursor()

# Debug: Print Users
print("\n--- DEBUG: Users Table ---")
cursor.execute("SELECT user_id, subscription_tier, subscription_expires_at FROM users")
for row in cursor.fetchall():
    print(row)
print("--------------------------\n")

# Find a Pro user
cursor.execute("SELECT user_id FROM users WHERE subscription_tier IN ('pro', 'premium') LIMIT 1")
row = cursor.fetchone()
if not row:
    print("❌ No Pro user found in DB.")
    conn.close()
    exit(1)

pro_user_id = row[0]
print(f"User: {pro_user_id} is Pro.")

# Get their watchlist
cursor.execute("SELECT symbol FROM user_watchlist WHERE user_id = ?", (pro_user_id,))
rows = cursor.fetchall()
pro_user_watch = [r[0] for r in rows]
print(f"Pro User Watchlist: {pro_user_watch}")

conn.close()

if pro_user_watch:
    stock = pro_user_watch[0]
    # Check mode
    mode = check_stock_analysis_mode(stock)
    print(f"🔍 检查 {stock}: Mode = {mode} (Expect: ai)")
else:
    print("⚠️ Pro User has empty watchlist.")

# Test Random (not in pro list)
random_stock = "99999"
if random_stock in pro_user_watch: random_stock = "88888" 

mode_random = check_stock_analysis_mode(random_stock)
print(f"🔍 检查 {random_stock}: Mode = {mode_random} (Expect: rule)")
