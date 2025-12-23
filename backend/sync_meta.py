"""
一次性同步股票元数据
仅在需要时手动执行
"""
import sys
sys.path.append('.')
from main import sync_stock_meta, get_connection

print("⚠️  警告：此操作将同步所有港股和A股元数据，可能需要 5-10 分钟")
print("是否继续？(y/n): ", end='')

# 检查是否已有数据
conn = get_connection()
cursor = conn.cursor()
cursor.execute("SELECT COUNT(*) FROM stock_meta")
count = cursor.fetchone()[0]
conn.close()

if count > 0:
    print(f"\n✅ stock_meta 表已有 {count} 条记录")
    print("是否重新同步？(y/n): ", end='')

response = input().strip().lower()
if response == 'y':
    sync_stock_meta()
else:
    print("❌ 已取消")
