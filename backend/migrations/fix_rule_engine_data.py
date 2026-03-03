"""
数据清理迁移：将 Rule Engine 的历史英文数据转换为标准中文 JSON 格式
"""
import os
import sys
import json
import argparse

# 路径修复
project_root = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
backend_dir = os.path.join(project_root, 'backend')
sys.path.insert(0, project_root)
sys.path.insert(0, backend_dir)

from database import get_connection

def build_rule_json(signal, summary, analysis):
    """构建标准 JSON 格式"""
    data = {
        "signal": signal,
        "summary": summary,
        "reasoning_trace": [
            {"step": "trend", "data": analysis, "conclusion": summary}
        ],
        "tactics": {
            "holding": [{"priority": "P1", "action": "持仓观察", "trigger": "趋势变化", "reason": summary}],
            "empty": [{"priority": "P1", "action": "观望为主", "trigger": "等待入场信号", "reason": summary}]
        },
        "conflict_resolution": "遵循均线系统准则",
        "is_llm": False
    }
    return json.dumps(data, ensure_ascii=False)

def run_migration(dry_run=False):
    conn = get_connection()
    cursor = conn.cursor()
    
    # 定义映射关系
    mapping = {
        "Moving Averages Entangled": {
            "signal": "Side",
            "summary": "均线缠绕，方向不明",
            "analysis": "短期与长期均线交织，目前处于震荡行情，无明确趋势。"
        },
        "Price > MA5 > MA20 (Bullish Alignment)": {
            "signal": "Long",
            "summary": "均线多头排列，强势上涨",
            "analysis": "价格运行在MA5与MA20之上，且均线呈多头排列，上涨动力强劲。"
        },
        "Price < MA5 < MA20 (Bearish Alignment)": {
            "signal": "Short",
            "summary": "均线空头排列，弱势探底",
            "analysis": "价格受压于MA5与MA20之下，且均线呈空头排列，下行压力较大。"
        },
        "No data": {
            "signal": "Side",
            "summary": "数据缺失",
            "analysis": "无法获取足够的历史价格数据进行均线分析。"
        },
        "Insufficient indicators": {
            "signal": "Side",
            "summary": "技术指标缺失",
            "analysis": "当前股票的技术指标（如MA5, MA20）数据不完整，无法做出判断。"
        }
    }
    
    print("\n🚀 开始转换 Rule Engine 英文历史数据...")
    
    total_updated = 0
    for eng_text, info in mapping.items():
        # 查找匹配的记录
        cursor.execute("""
            SELECT COUNT(*) FROM ai_predictions_v2 
            WHERE model_id = 'rule-engine' AND ai_reasoning = ?
        """, (eng_text,))
        
        count = cursor.fetchone()[0]
        if count > 0:
            print(f"   发现 {count} 条记录: '{eng_text}'")
            if not dry_run:
                new_reasoning = build_rule_json(info['signal'], info['summary'], info['analysis'])
                cursor.execute("""
                    UPDATE ai_predictions_v2 
                    SET ai_reasoning = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE model_id = 'rule-engine' AND ai_reasoning = ?
                """, (new_reasoning, eng_text))
                total_updated += count
                print(f"      ✅ 已更新为中文 JSON")
            else:
                print(f"      (Dry Run) 准备更新为中文 JSON")
    
    if not dry_run:
        conn.commit()
        print(f"\n✅ 迁移完成！共更新 {total_updated} 条 Rule Engine 记录。")
    else:
        print(f"\n⚠️ Dry Run 完成。")
        
    conn.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()
    run_migration(dry_run=args.dry_run)
