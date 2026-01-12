"""
Brief Generation Benchmark Tool (Upgraded)
用于对比不同 LLM 模型生成简报的能力，使用生产环境的高要求 Prompt 和复杂上下文。

使用方法:
  python scripts/benchmark_brief_models.py                    # 测试所有模型
  python scripts/benchmark_brief_models.py --model hunyuan-turbo  # 测试单个模型
  python scripts/benchmark_brief_models.py --list             # 列出所有可用模型
"""

import os
import sys
import time
import json
import argparse
from pathlib import Path
from typing import Dict, Any, List, Tuple

# Add backend to path
root_dir = Path(__file__).parent.parent
sys.path.append(str(root_dir))
sys.path.append(str(root_dir / "backend"))

from dotenv import load_dotenv
load_dotenv(root_dir / "backend" / ".env")

# =====================================================
# 真实测试数据 (模拟生产环境的复杂上下文)
# =====================================================
TEST_CASES = [
    {
        "symbol": "00700",
        "stock_name": "腾讯控股",
        "tech_data": {
            "signal": "Side",
            "confidence": 0.65,
            "close": 398.20,
            "change_percent": -1.25,
            "support_price": 385.00,
            "pressure_price": 410.00,
            "rsi": 45.2,
            "kdj_k": 35,
            "kdj_d": 40,
            "macd": 0.523,
            "ai_reasoning": "股价在均线附近震荡，成交量萎缩，短期方向不明。RSI 处于中性区域，MACD 金叉但红柱缩短。建议观望，等待明确突破信号。"
        },
        "news_context": """- **腾讯视频号 2024 年 GMV 超 3000 亿，广告收入同比增长 45%**: 腾讯公布最新财报快报，视频号成为公司新的增长引擎，日活跃用户突破 5.2 亿。电商业务 GMV 亦现爆发式增长，分析师预计未来三年将维持 30% 以上增速。 (Source: https://finance.sina.com.cn/tech/2026-01-08/doc-imxz.shtml)
- **国行《VALORANT》无畏契约手游版获批版号**: 国家新闻出版署发布 2026 年 1 月进口网络游戏审批信息，腾讯重磅大作《无畏契约》手游在列。市场普遍看好其接棒《王者荣耀》成为下一个国民级手游。 (Source: https://gamelook.com.cn/2026/01/news-123.html)
- **大股东 Prosus 宣布完成本轮减持计划**: 腾讯主要股东 Prosus 发布公告称，已完成过去 6 个月的减持计划，并没有进一步减持意向。此举被视为消除了市场短期最大的抛压来源。 (Source: https://bloomberg.com/news/2026-01-07/prosus-tencent-stake.html)
- **微信支付推出「掌纹支付 2.0」，覆盖全国地铁**: 微信支付宣布升级掌纹支付技术，识别速度提升 50%，并将于本月起在北京、上海、深圳地铁全面试运行。 (Source: https://tech.qq.com/a/20260108/001.htm)"""
    },
    {
        "symbol": "TSLA",
        "stock_name": "特斯拉",
        "tech_data": {
            "signal": "Bearish",
            "confidence": 0.82,
            "close": 215.50,
            "change_percent": -4.30,
            "support_price": 200.00,
            "pressure_price": 230.00,
            "rsi": 28.5,
            "kdj_k": 15,
            "kdj_d": 22,
            "macd": -2.41,
            "ai_reasoning": "股价跌破关键支撑位 220 美元，形成头部形态。RSI 进入超卖区但未见背离，MACD 死叉向下发散。空头动能强劲，建议规避风险或逢高做空。"
        },
        "news_context": """- **特斯拉第四季度交付量 45 万辆，不及市场预期的 48 万辆**: 特斯拉公布 Q4 交付数据，受限于上海工厂产线升级和德国工厂罢工影响，交付量罕见出现环比下滑。分析师纷纷下调目标价。 (Source: https://cnbc.com/2026/01/08/tesla-q4-delivery-miss.html)
- **Cybertruck 产能爬坡遇阻，马斯克承认「地狱模式」**: 在最新的内部邮件中，马斯克承认 Cybertruck 的 4680 电池良率未达标，大规模量产时间表推迟至 2026 下半年。 (Source: https://theverge.com/cars/2026/01/08/cybertruck-delay.html)
- **美国取消部分电动车税收抵免资格**: 拜登政府最新的《通胀削减法案》细则生效，Model 3 后轮驱动版因电池组件来源问题，失去 7500 美元的全额税收抵免资格。 (Source: https://reuters.com/business/autos-transportation/ev-tax-credit-rules-2026.html)"""
    }
]

# =====================================================
# 模型配置
# =====================================================
MODEL_CONFIGS = {
    # Gemini Local (基准)
    "gemini-local": {
        "provider": "openai",
        "base_url": os.getenv("GEMINI_LOCAL_BASE_URL", "http://127.0.0.1:8045") + "/v1",
        "api_key": os.getenv("LLM_API_KEY", "sk-test"),
        "model": os.getenv("GEMINI_LOCAL_MODEL", "gemini-3-flash"),
        "description": "本地 Gemini 代理 (基准)",
    },
    # 混元模型系列
    "hunyuan-lite": {
        "provider": "openai",
        "base_url": "https://api.hunyuan.cloud.tencent.com/v1",
        "api_key": os.getenv("HUNYUAN_API_KEY"),
        "model": "hunyuan-lite",
        "description": "腾讯混元 Lite (免费)",
    },
    "hunyuan-standard": {
        "provider": "openai",
        "base_url": "https://api.hunyuan.cloud.tencent.com/v1",
        "api_key": os.getenv("HUNYUAN_API_KEY"),
        "model": "hunyuan-standard",
        "description": "腾讯混元 Standard",
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
        "description": "腾讯混元 Pro (最强)",
    },
    "hunyuan-turbo-latest": {
        "provider": "openai",
        "base_url": "https://api.hunyuan.cloud.tencent.com/v1",
        "api_key": os.getenv("HUNYUAN_API_KEY"),
        "model": "hunyuan-turbo-latest",
        "description": "腾讯混元 Turbo Latest",
    },
}

# =====================================================
# 生产环境 Prompt (完全复刻 brief_generator.py)
# =====================================================
SYSTEM_PROMPT = """你是一位 StockWise 的首席财经主笔。你的目标是编写一份**通俗易懂、聚焦市场叙事**的个股日报。

核心写作原则：
1. **新闻驱动逻辑**：优先简述"发生了什么"（新闻/行业动态），以此解释股价表现。
2. **数据隐形化**：**严禁**直接罗列 RSI、KDJ、MA 等技术指标数值。
   - ❌ 错误：RSI 为 75，MA5 上穿 MA20。
   - ✅ 正确：短期动能强劲，股价呈现加速上行态势。
3. **AI 观点自然融入**：将 AI 的信号（Bullish/Bearish）转化为对趋势的定性描述（如"上涨趋势稳固"、"短期面临调整压力"），不要提及"AI 信号"这个词。
4. **说人话**：让没有金融背景的用户也能一眼看懂是"好"还是"坏"。"""

def build_user_prompt(case: Dict) -> str:
    # 构造 Hard Data Section
    td = case['tech_data']
    signal = td.get('signal', 'Side')
    confidence = td.get('confidence', 0)
    conf_pct = int(confidence * 100) if confidence <= 1 else int(confidence)
    
    hard_data_lines = [
        f"- AI 信号: {signal} (置信度 {conf_pct}%)",
    ]
    
    if td.get('close'):
        change = td.get('change_percent', 0)
        change_str = f"+{change:.2f}%" if change >= 0 else f"{change:.2f}%"
        hard_data_lines.append(f"- 今日收盘: {td['close']:.2f} ({change_str})")
        
    levels = []
    if td.get('support_price'): levels.append(f"支撑位 {td['support_price']:.2f}")
    if td.get('pressure_price'): levels.append(f"压力位 {td['pressure_price']:.2f}")
    if levels: hard_data_lines.append(f"- 关键价位: {' | '.join(levels)}")
    
    indicators = []
    if td.get('rsi'): indicators.append(f"RSI={td['rsi']:.1f}")
    if td.get('kdj_k'): indicators.append(f"KDJ(K={td['kdj_k']}/D={td['kdj_d']})")
    if td.get('macd'): indicators.append(f"MACD={td['macd']:.3f}")
    if indicators: hard_data_lines.append(f"- 技术指标: {' | '.join(indicators)}")
    
    hard_data_section = "\n".join(hard_data_lines)
    
    return f"""Subject: {case['symbol']} ({case['stock_name']})

[硬数据支撑 - 仅供你参考，作为"隐性逻辑"，不要直接展示数据]
{hard_data_section}

[分析师推理 - 供参考逻辑]
{td.get('ai_reasoning', '')}

[今日新闻 - 作为叙事核心]
{case['news_context']}

任务: 撰写每日简报（不要包含任何标题）。格式如下：

1. **综合分析** (约60-80字)：
   - 以今日核心新闻或行业动态开头。
   - 结合股价表现，用自然的语言描述当前趋势（基于 AI 信号和技术面）。
   - **禁止**出现具体技术指标名称和数值。

2. **核心新闻 (附出处)** (最多3条，格式：**[标题]**：摘要。[出处链接](URL))
   - 如果没有重大新闻，此部分显示"今日无重大公开新闻"，通过技术面形态略作补充。

输出语言：专业、流畅、有温度的中文。"""

# =====================================================
# LLM 调用
# =====================================================
def call_model(config: Dict, prompt: str) -> Tuple[str, float, Dict]:
    from openai import OpenAI
    
    if not config.get("api_key"):
        return "❌ API Key 未配置", 0, {"error": "Missing API Key"}
    
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
                {"role": "user", "content": prompt},
            ],
            temperature=0.3,
            max_tokens=800,
        )
        elapsed = time.time() - start_time
        
        content = response.choices[0].message.content
        usage = response.usage
        
        meta = {
            "input_tokens": usage.prompt_tokens if usage else 0,
            "output_tokens": usage.completion_tokens if usage else 0,
            "total_tokens": usage.total_tokens if usage else 0,
        }
        
        return content, elapsed, meta
        
    except Exception as e:
        elapsed = time.time() - start_time
        return f"❌ 错误: {str(e)[:100]}", elapsed, {"error": str(e)}

# =====================================================
# 主程序
# =====================================================
def run_benchmark(model_filter: str = None):
    # Auto-disable proxy for Hunyuan
    os.environ["NO_PROXY"] = "api.hunyuan.cloud.tencent.com"
    
    models_to_test = MODEL_CONFIGS.keys() if not model_filter else [model_filter]
    
    print("=" * 60)
    print("📊 Brief Generation Benchmark (Advanced)")
    print("=" * 60)
    
    results = []
    
    for model_id in models_to_test:
        if model_id not in MODEL_CONFIGS:
            print(f"❌ 未知模型: {model_id}")
            continue
            
        config = MODEL_CONFIGS[model_id]
        print(f"\n🤖 测试模型: {model_id} ({config['description']})")
        print("-" * 40)
        
        for case in TEST_CASES:
            prompt = build_user_prompt(case)
            
            print(f"   📈 {case['symbol']} {case['stock_name']}...", end=" ", flush=True)
            
            content, elapsed, meta = call_model(config, prompt)
            
            if "error" in meta:
                print(f"❌ ({elapsed:.1f}s)")
                print(f"      Error: {meta['error'][:50]}")
            else:
                print(f"✅ ({elapsed:.1f}s, {meta['total_tokens']} tokens)")
                
            results.append({
                "model": model_id,
                "symbol": case['symbol'],
                "elapsed": elapsed,
                "tokens": meta.get("total_tokens", 0),
                "content": content,
                "success": "error" not in meta,
            })
            
            # 显示生成的简报预览 (前200字)
            if "error" not in meta:
                preview = content.replace('\n', ' ')[:150]
                print(f"      📝 {preview}...")
    
    # 汇总报告
    print("\n" + "=" * 60)
    print("📈 汇总报告")
    print("=" * 60)
    
    for model_id in models_to_test:
        if model_id not in MODEL_CONFIGS:
            continue
        model_results = [r for r in results if r['model'] == model_id]
        success_count = sum(1 for r in model_results if r['success'])
        avg_time = sum(r['elapsed'] for r in model_results) / len(model_results) if model_results else 0
        
        status = "✅" if success_count == len(model_results) else "⚠️"
        print(f"{status} {model_id:25}: {success_count}/{len(model_results)} 成功 | Avg: {avg_time:.1f}s")

def list_models():
    print("📋 可用模型列表:")
    print("-" * 60)
    for model_id, config in MODEL_CONFIGS.items():
        key_status = "✅" if config.get("api_key") else "❌"
        print(f"  {key_status} {model_id:25} - {config['description']}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Brief Generation Benchmark Tool")
    parser.add_argument("--model", type=str, help="指定测试的模型ID")
    parser.add_argument("--list", action="store_true", help="列出所有可用模型")
    
    args = parser.parse_args()
    
    if args.list:
        list_models()
    else:
        run_benchmark(args.model)
