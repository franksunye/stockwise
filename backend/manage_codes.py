import argparse
import random
import string
import sqlite3
import sys
from datetime import datetime
from database import get_connection, init_db

# 确保数据库已初始化
# init_db() will be called after arg parsing

def generate_code(length=8):
    """生成易读的邀请码 (大写字母 + 数字)"""
    chars = string.ascii_uppercase + string.digits
    # 避免易混淆字符 (I, 1, O, 0)
    chars = chars.replace('I', '').replace('1', '').replace('O', '').replace('0', '')
    return ''.join(random.choice(chars) for _ in range(length))

def create_codes(count, type='pro_monthly', days=30):
    conn = get_connection()
    cursor = conn.cursor()
    
    created_codes = []
    
    print(f"📦 正在生成 {count} 个 {type} 邀请码 (有效期 {days} 天)...")
    
    for _ in range(count):
        code = "PRO-" + generate_code(6) # 格式: PRO-ABCD23
        try:
            cursor.execute("""
                INSERT INTO invitation_codes (code, type, duration_days)
                VALUES (?, ?, ?)
            """, (code, type, days))
            created_codes.append(code)
        except sqlite3.IntegrityError:
            # 极低概率碰撞，忽略
            continue
            
    conn.commit()
    conn.close()
    
    print("✅ 生成成功:")
    for c in created_codes:
        print(f"  {c}")
        
def list_codes(show_used=False):
    conn = get_connection()
    cursor = conn.cursor()
    
    sql = "SELECT code, type, duration_days, is_used, used_by_user_id, created_at FROM invitation_codes"
    if not show_used:
        sql += " WHERE is_used = 0"
        
    cursor.execute(sql)
    rows = cursor.fetchall()
    conn.close()
    
    print(f"{'Code':<15} {'Type':<15} {'Days':<5} {'Used':<5} {'User':<15} {'Created'}")
    print("-" * 75)
    for row in rows:
        # row: (code, type, duration, is_used, user_id, created)
        # Handle LibSQL Row objects or Tuples
        try:
             # Try dict-like access first (LibSQL)
             code = row['code']
             type_ = row['type']
             days = row['duration_days']
             is_used = row['is_used']
             user = row['used_by_user_id'] or '-'
             created = row['created_at']
        except (TypeError, IndexError):
             # Fallback to tuple index (SQLite)
             code = row[0]
             type_ = row[1]
             days = row[2]
             is_used = row[3]
             user = row[4] or '-'
             created = row[5]

        status = "✅" if is_used else "⬜"
        print(f"{code:<15} {type_:<15} {days:<5} {status:<5} {user:<15} {created}")

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='StockWise Invitation Code Manager')
    subparsers = parser.add_subparsers(dest='command', required=True)
    
    # Generate
    gen_parser = subparsers.add_parser('gen', help='Generate new codes')
    gen_parser.add_argument('-c', '--count', type=int, default=1, help='Number of codes')
    gen_parser.add_argument('-d', '--days', type=int, default=30, help='Duration in days')
    
    # List
    list_parser = subparsers.add_parser('list', help='List codes')
    list_parser.add_argument('--all', action='store_true', help='Show used codes too')
    
    # Common arguments
    parser.add_argument('--local', action='store_true', help='Force use local SQLite database')

    args = parser.parse_args()
    
    if args.local:
        import database
        print("⚠️ Forcing local SQLite database (ignoring Turso config)")
        database.TURSO_DB_URL = None

    # Re-run init_db in case connection changed
    init_db()
    
    if args.command == 'gen':
        create_codes(args.count, days=args.days)
    elif args.command == 'list':
        list_codes(args.all)
