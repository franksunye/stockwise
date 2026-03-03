"""
Prediction AI Benchmark Tool
用于对比不同 LLM 模型生成结构化投资建议的能力（Signal/Confidence/Reasoning/Tactics）。
测试数据来自真实的 LLM Trace。

使用方法:
  python scripts/benchmark_prediction_models.py                    # 运行测试
  python scripts/benchmark_prediction_models.py --model hunyuan-turbo
  python scripts/benchmark_prediction_models.py --fetch           # 强制重新从数据库拉取测试用例
"""

import os
import sys
import time
import json
import argparse
import asyncio
from pathlib import Path
from typing import Dict, Any, List, Tuple

# Add backend to path
root_dir = Path(__file__).parent.parent
sys.path.append(str(root_dir))
sys.path.append(str(root_dir / "backend"))

from dotenv import load_dotenv
load_dotenv(root_dir / "backend" / ".env")

# =====================================================
# 模型配置
# =====================================================
MODEL_CONFIGS = {
    # Gemini Local (基准)
    "gemini-local": {
        "provider": "openai",  # OpenAI Protocol
        "base_url": os.getenv("GEMINI_LOCAL_BASE_URL", "http://127.0.0.1:8045") + "/v1",
        "api_key": os.getenv("LLM_API_KEY", "sk-test"),
        "model": os.getenv("GEMINI_LOCAL_MODEL", "gemini-3-flash"),
        "description": "本地 Gemini 代理 (基准)",
    },
    # 混元模型
    "hunyuan-lite": {
        "provider": "openai",
        "base_url": "https://api.hunyuan.cloud.tencent.com/v1",
        "api_key": os.getenv("HUNYUAN_API_KEY"),
        "model": "hunyuan-lite",
        "description": "腾讯混元 Lite (免费)",
    },
    "hunyuan-turbo": {
        "provider": "openai",
        "base_url": "https://api.hunyuan.cloud.tencent.com/v1",
        "api_key": os.getenv("HUNYUAN_API_KEY"),
        "model": "hunyuan-turbo",
        "description": "腾讯混元 Turbo (推荐)",
    },
    "hunyuan-pro": {
        "provider": "openai",
        "base_url": "https://api.hunyuan.cloud.tencent.com/v1",
        "api_key": os.getenv("HUNYUAN_API_KEY"),
        "model": "hunyuan-pro",
        "description": "腾讯混元 Pro (逻辑强)",
    },
}

# =====================================================
# 系统提示词 (精简版，用于 Mock)
# =====================================================
# 注意：实际请求中，我们使用 Trace 中的 user_prompt，但我们也需要一个 System Prompt。
# 这里我们硬编码 backend/engine/prompts.py 中的 System Prompt，确保环境一致。
SYSTEM_PROMPT = """你是 StockWise 的 AI 决策助手，专门为个人投资者提供股票操作建议。

## 你的核心原则：
1. **理性锚点**：你不预测涨跌，你提供"执行纪律"的触发条件。
2. **个性化**：根据用户是"已持仓"还是"未建仓"，提供差异化的行动建议。
3. **可验证**：每条建议都有明确的触发条件。
4. **简洁直白**：使用普通人能秒懂的语言。

## 你的输出格式：
你必须严格按照以下 JSON 格式输出，不要添加任何其他文字：

{
  "signal": "Long" | "Side" | "Short",
  "confidence": 0.0 ~ 1.0,
  "summary": "一句话核心结论（15字以内）",
  "reasoning_trace": [
    { "step": "trend", "data": "趋势数据", "conclusion": "结论" },
    { "step": "momentum", "data": "动能数据", "conclusion": "结论" },
    { "step": "decision", "data": "综合因素", "conclusion": "决策" }
  ],
  "tactics": {
    "holding": [{"priority": "P1", "action": "...", "trigger": "...", "reason": "..."}],
    "empty": [],
    "general": []
  },
  "key_levels": { "support": 0, "resistance": 0, "stop_loss": 0 },
  "conflict_resolution": "...",
  "tomorrow_focus": "..."
}"""

# =====================================================
# 数据获取 (Mock or Turso)
# =====================================================
CACHE_FILE = Path(__file__).parent / "temp_prediction_case.json"

async def fetch_real_trace_case():
    """从数据库获取真实的 Prompt"""
    from database import get_connection
    print("📡 连接数据库获取真实 User Prompt...")
    
    conn = get_connection()
    try:
        cursor = conn.cursor()
        # 获取最近一条成功的 JSON 格式的 trace (通常 tokens 比较多)
        cursor.execute("""
            SELECT symbol, user_prompt 
            FROM llm_traces 
            WHERE status = 'success' 
            AND length(user_prompt) > 500
            ORDER BY created_at DESC 
            LIMIT 1
        """)
        row = cursor.fetchone()
        
        if not row:
            print("❌ 未找到合适的 Trace 记录。")
            return None
            
        case = {
            "symbol": row[0],
            "user_prompt": row[1]
        }
        
        # Save to cache
        with open(CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump(case, f, ensure_ascii=False, indent=2)
            
        print(f"✅ 获取成功: {case['symbol']} (Prompt Length: {len(case['user_prompt'])})")
        return case
        
    except Exception as e:
        print(f"❌ 数据库错误: {e}")
        return None
    finally:
        conn.close()

def get_test_case(force_fetch=False):
    if not force_fetch and CACHE_FILE.exists():
        print(f"📂 使用缓存的测试用例: {CACHE_FILE}")
        with open(CACHE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    
    # 尝试异步获取
    try:
        result = asyncio.run(fetch_real_trace_case())
        if result: return result
    except ImportError:
        print("⚠️ 无法导入 database 模块 (可能是路径问题)，使用 Mock 数据。")
    except Exception as e:
        print(f"⚠️ 获取数据失败: {e}")
    
    # Fallback Mock Data
    print("⚠️ 使用内置 Mock 数据")
    return {
        "symbol": "MOCK",
        "user_prompt": "Subject: 00700 (腾讯控股)\n\n[Daily Data]\nDate: 2026-01-08\nClose: 398.00\nRSI: 45\nMACD: 0.5\n\n[History]\nTrend: Bearish 5 days\n\nInstruction: Provide trading advice."
    }

# =====================================================
# LLM 调用
# =====================================================
def call_model(config: Dict, user_prompt: str) -> Tuple[Dict, float, Dict]:
    from openai import OpenAI
    
    if not config.get("api_key"):
        return {}, 0, {"error": "Missing API Key"}
    
    client = OpenAI(
        api_key=config["api_key"],
        base_url=config["base_url"],
    )
    
    start_time = time.time()
    try:
        response = client.chat.completions.create(
            model=config["model"],
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.1, # 预测任务需要低温度
            response_format={"type": "json_object"}, # 强制 JSON
            max_tokens=2000,
        )
        elapsed = time.time() - start_time
        
        raw_content = response.choices[0].message.content
        usage = response.usage
        
        meta = {
            "input_tokens": usage.prompt_tokens if usage else 0,
            "output_tokens": usage.completion_tokens if usage else 0,
            "total_tokens": usage.total_tokens if usage else 0,
        }
        
        # Parse JSON
        try:
            parsed = json.loads(raw_content)
            return parsed, elapsed, meta
        except json.JSONDecodeError:
            return {"error": "Invalid JSON", "raw": raw_content[:200]}, elapsed, meta
            
    except Exception as e:
        elapsed = time.time() - start_time
        return {}, elapsed, {"error": str(e)}

# =====================================================
# 主程序
# =====================================================
def run_benchmark(model_filter: str = None, force_fetch: bool = False):
    # Auto-disable proxy for Hunyuan
    os.environ["NO_PROXY"] = "api.hunyuan.cloud.tencent.com"
    
    case = get_test_case(force_fetch)
    if not case: return
    
    models_to_test = MODEL_CONFIGS.keys() if not model_filter else [model_filter]
    
    print("=" * 60)
    print("🧠 Prediction AI Benchmark (JSON Logic)")
    print(f"Target Symbol: {case['symbol']}")
    print("=" * 60)
    
    results = []
    
    for model_id in models_to_test:
        if model_id not in MODEL_CONFIGS: continue
        config = MODEL_CONFIGS[model_id]
        
        print(f"\n🤖 {model_id}...", end=" ", flush=True)
        
        parsed, elapsed, meta = call_model(config, case['user_prompt'])
        
        if "error" in meta:
            print(f"❌ Error: {meta['error']}")
        elif "error" in parsed:
            print(f"❌ JSON Parse Error: {parsed['raw']}...")
        else:
            print(f"✅ ({elapsed:.1f}s)")
            
            # 质量检查
            signal = parsed.get("signal", "N/A")
            conf = parsed.get("confidence", 0)
            reasoning_len = len(str(parsed.get("reasoning_trace", "")))
            tactics_count = len(parsed.get("tactics", {}).get("holding", []))
            
            print(f"   📊 Signal: {signal:<6} | Confidence: {conf:.2f}")
            print(f"   💡 Summary: {parsed.get('summary', 'N/A')}")
            print(f"   ⛓️ Trace Points: {len(parsed.get('reasoning_trace', []))} steps")
            print(f"   🛡️ Holding Tactics: {tactics_count}")
        
        results.append({
            "model": model_id,
            "elapsed": elapsed,
            "success": "error" not in meta and "error" not in parsed,
            "parsed": parsed
        })

    # Summary
    print("\n" + "=" * 60)
    print("📈 结果汇总")
    for r in results:
        status = "✅" if r['success'] else "❌"
        print(f"{status} {r['model']:15} | {r['elapsed']:.1f}s")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", type=str)
    parser.add_argument("--fetch", action="store_true", help="强制从 DB 拉取新 Case")
    args = parser.parse_args()
    
    run_benchmark(args.model, args.fetch)
