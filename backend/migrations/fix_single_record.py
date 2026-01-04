"""
快速清理单条 ai_reasoning 记录的 markdown 标记
"""
import os
import sys
import json
import re

project_root = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
backend_dir = os.path.join(project_root, 'backend')
sys.path.insert(0, project_root)
sys.path.insert(0, backend_dir)

from database import get_connection

def clean_markdown_json(content: str) -> str:
    if not content:
        return content
    
    cleaned = content.strip()
    cleaned = re.sub(r'^```json\s*', '', cleaned, flags=re.MULTILINE)
    cleaned = re.sub(r'^```\s*', '', cleaned, flags=re.MULTILINE)
    cleaned = re.sub(r'```$', '', cleaned, flags=re.MULTILINE)
    cleaned = cleaned.strip()
    
    # 尝试直接解析
    try:
        parsed = json.loads(cleaned)
        return json.dumps(parsed, ensure_ascii=False)
    except json.JSONDecodeError:
        pass
    
    # 使用 stack balance 提取第一个完整的 JSON 对象
    try:
        start = cleaned.find('{')
        if start != -1:
            balance = 0
            for i in range(start, len(cleaned)):
                if cleaned[i] == '{':
                    balance += 1
                elif cleaned[i] == '}':
                    balance -= 1
                    if balance == 0:
                        json_str = cleaned[start:i+1]
                        parsed = json.loads(json_str)
                        print(f"使用 stack balance 成功提取 JSON: {len(json_str)} 字符")
                        return json.dumps(parsed, ensure_ascii=False)
    except json.JSONDecodeError as e:
        print(f"Stack balance JSON 解析失败: {e}")
    
    return content

# 执行
conn = get_connection()
cursor = conn.cursor()

cursor.execute("""
    SELECT ai_reasoning FROM ai_predictions_v2 
    WHERE symbol = '00700' AND date = '2026-01-02' AND model_id = 'gemini-3-flash'
""")
row = cursor.fetchone()

if row:
    original = row[0] if isinstance(row, (tuple, list)) else row['ai_reasoning']
    print(f"原始长度: {len(original)}")
    print(f"开头 100 字符: {repr(original[:100])}")
    
    cleaned = clean_markdown_json(original)
    print(f"清理后长度: {len(cleaned)}")
    print(f"开头 100 字符: {repr(cleaned[:100])}")
    
    if cleaned != original:
        cursor.execute("""
            UPDATE ai_predictions_v2 
            SET ai_reasoning = ?, updated_at = CURRENT_TIMESTAMP
            WHERE symbol = '00700' AND date = '2026-01-02' AND model_id = 'gemini-3-flash'
        """, (cleaned,))
        conn.commit()
        print("✅ 已更新！")
    else:
        print("数据相同，无需更新")
else:
    print("未找到记录")

conn.close()
