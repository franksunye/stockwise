"""
数据清理迁移脚本：修复 ai_predictions_v2 表中的脏数据

问题:
1. ai_reasoning 包含 markdown 代码块标记 (```json ... ```)
2. legacy-ai 记录的 is_primary 应该为 0 (已不活跃)
3. 同一天同一股票有多条 is_primary=1 的记录

运行方式:
    python backend/migrations/clean_ai_reasoning.py [--dry-run]
"""

import os
import sys
import json
import re
import argparse

# Add project root and backend to path
project_root = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
backend_dir = os.path.join(project_root, 'backend')
sys.path.insert(0, project_root)
sys.path.insert(0, backend_dir)

from database import get_connection
from logger import logger


def clean_markdown_json(content: str) -> str:
    """清理 markdown 代码块标记，返回干净的 JSON 字符串"""
    if not content:
        return content
    
    # 移除 ```json 开头和 ``` 结尾
    cleaned = content.strip()
    cleaned = re.sub(r'^```json\s*', '', cleaned, flags=re.MULTILINE)
    cleaned = re.sub(r'^```\s*', '', cleaned, flags=re.MULTILINE)
    cleaned = re.sub(r'```$', '', cleaned, flags=re.MULTILINE)
    cleaned = cleaned.strip()
    
    # 尝试解析并重新序列化，确保格式正确
    try:
        parsed = json.loads(cleaned)
        return json.dumps(parsed, ensure_ascii=False)
    except json.JSONDecodeError:
        # 如果无法解析，返回原内容（可能是纯文本）
        return content


def run_migration(dry_run: bool = False):
    """执行数据清理迁移"""
    conn = get_connection()
    cursor = conn.cursor()
    
    print("=" * 60)
    print("🧹 AI Predictions 数据清理迁移")
    print("=" * 60)
    
    if dry_run:
        print("⚠️  DRY RUN 模式 - 不会实际修改数据\n")
    
    # 1. 查找包含 markdown 标记的 ai_reasoning
    print("\n📌 Step 1: 清理 ai_reasoning 中的 markdown 代码块标记")
    cursor.execute("""
        SELECT symbol, date, model_id, ai_reasoning 
        FROM ai_predictions_v2 
        WHERE ai_reasoning LIKE '%```%'
    """)
    
    markdown_rows = cursor.fetchall()
    print(f"   找到 {len(markdown_rows)} 条包含 markdown 标记的记录")
    
    cleaned_count = 0
    for row in markdown_rows:
        if isinstance(row, (tuple, list)):
            symbol, date, model_id, ai_reasoning = row[0], row[1], row[2], row[3]
        else:
            symbol = row['symbol']
            date = row['date']
            model_id = row['model_id']
            ai_reasoning = row['ai_reasoning']
        
        cleaned = clean_markdown_json(ai_reasoning)
        
        if cleaned != ai_reasoning:
            cleaned_count += 1
            print(f"   ✓ [{symbol}] {date} ({model_id}) - 已清理")
            
            if not dry_run:
                cursor.execute("""
                    UPDATE ai_predictions_v2 
                    SET ai_reasoning = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE symbol = ? AND date = ? AND model_id = ?
                """, (cleaned, symbol, date, model_id))
    
    print(f"   共清理 {cleaned_count} 条记录")
    
    # 2. 修复 is_primary 冲突：同一天同一股票只保留优先级最高的为 primary
    print("\n📌 Step 2: 修复 is_primary 冲突")
    
    # 找出有多条 is_primary=1 的组合
    cursor.execute("""
        SELECT symbol, date, COUNT(*) as cnt
        FROM ai_predictions_v2 
        WHERE is_primary = 1
        GROUP BY symbol, date
        HAVING COUNT(*) > 1
    """)
    conflicts = cursor.fetchall()
    print(f"   找到 {len(conflicts)} 组 is_primary 冲突")
    
    for conflict in conflicts:
        symbol = conflict[0] if isinstance(conflict, (tuple, list)) else conflict['symbol']
        date = conflict[1] if isinstance(conflict, (tuple, list)) else conflict['date']
        
        # 获取该组的所有预测，按模型优先级排序
        cursor.execute("""
            SELECT p.model_id, COALESCE(m.priority, 0) as priority
            FROM ai_predictions_v2 p
            LEFT JOIN prediction_models m ON p.model_id = m.model_id
            WHERE p.symbol = ? AND p.date = ? AND p.is_primary = 1
            ORDER BY priority DESC
        """, (symbol, date))
        
        preds = cursor.fetchall()
        
        # 只保留第一条（最高优先级）为 primary，其余设为 0
        for i, pred in enumerate(preds):
            model_id = pred[0] if isinstance(pred, (tuple, list)) else pred['model_id']
            
            if i == 0:
                print(f"   ✓ [{symbol}] {date} - 保留 {model_id} 为 primary")
            else:
                print(f"   ✗ [{symbol}] {date} - 取消 {model_id} 的 primary")
                if not dry_run:
                    cursor.execute("""
                        UPDATE ai_predictions_v2 
                        SET is_primary = 0, updated_at = CURRENT_TIMESTAMP
                        WHERE symbol = ? AND date = ? AND model_id = ?
                    """, (symbol, date, model_id))
    
    # 3. 将 legacy-ai 的所有记录设为非 primary（如果有其他模型的话）
    print("\n📌 Step 3: 检查 legacy-ai 的 primary 状态")
    cursor.execute("""
        SELECT DISTINCT symbol, date 
        FROM ai_predictions_v2 
        WHERE model_id = 'legacy-ai' AND is_primary = 1
    """)
    legacy_primaries = cursor.fetchall()
    
    demoted_count = 0
    for lp in legacy_primaries:
        symbol = lp[0] if isinstance(lp, (tuple, list)) else lp['symbol']
        date = lp[1] if isinstance(lp, (tuple, list)) else lp['date']
        
        # 检查是否有其他模型的预测
        cursor.execute("""
            SELECT COUNT(*) FROM ai_predictions_v2 
            WHERE symbol = ? AND date = ? AND model_id != 'legacy-ai'
        """, (symbol, date))
        result = cursor.fetchone()
        other_count = result[0] if isinstance(result, (tuple, list)) else result['COUNT(*)']
        
        if other_count > 0:
            demoted_count += 1
            print(f"   ✗ [{symbol}] {date} - legacy-ai 降级为非 primary")
            
            if not dry_run:
                # 将 legacy-ai 设为非 primary
                cursor.execute("""
                    UPDATE ai_predictions_v2 
                    SET is_primary = 0, updated_at = CURRENT_TIMESTAMP
                    WHERE symbol = ? AND date = ? AND model_id = 'legacy-ai'
                """, (symbol, date))
                
                # 找到最高优先级的其他模型
                cursor.execute("""
                    SELECT p.model_id FROM ai_predictions_v2 p
                    LEFT JOIN prediction_models m ON p.model_id = m.model_id
                    WHERE p.symbol = ? AND p.date = ? AND p.model_id != 'legacy-ai'
                    ORDER BY COALESCE(m.priority, 0) DESC
                    LIMIT 1
                """, (symbol, date))
                best_model = cursor.fetchone()
                
                if best_model:
                    best_model_id = best_model[0] if isinstance(best_model, (tuple, list)) else best_model['model_id']
                    cursor.execute("""
                        UPDATE ai_predictions_v2 
                        SET is_primary = 1, updated_at = CURRENT_TIMESTAMP
                        WHERE symbol = ? AND date = ? AND model_id = ?
                    """, (symbol, date, best_model_id))
    
    print(f"   共处理 {demoted_count} 条 legacy-ai 降级")
    
    # 提交更改
    if not dry_run:
        conn.commit()
        print("\n✅ 所有更改已提交到数据库")
    else:
        print("\n⚠️  DRY RUN 完成 - 未实际修改数据")
    
    conn.close()
    print("\n" + "=" * 60)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='清理 ai_predictions_v2 表中的脏数据')
    parser.add_argument('--dry-run', action='store_true', help='仅预览更改，不实际执行')
    args = parser.parse_args()
    
    run_migration(dry_run=args.dry_run)
