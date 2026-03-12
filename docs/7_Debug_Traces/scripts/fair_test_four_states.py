
import os
import sys
import asyncio
import json
import time

WORKSPACE_ROOT = "/Users/yesun/Code/stockwise"
sys.path.insert(0, WORKSPACE_ROOT)

from backend.engine.llm_client import LLMClient

provider = "gemini_local"
model_name = "gemini-3-flash"
base_url = "http://127.0.0.1:8045"
api_key = "dummy"

async def test_fair_comparison():
    client = LLMClient(provider, base_url=base_url, model=model_name, api_key=api_key)
    base_dir = "/Users/yesun/Code/stockwise/docs/7_Debug_Traces"
    prompt_dir = f"{base_dir}/prompts"
    
    user_p_path = f"{prompt_dir}/B2_Rich_User.md"
    with open(user_p_path, "r") as f: usr_p = f.read()

    scenarios = [
        {
            "id": "B2_OPTIMIZED_3_STATES",
            "sys": f"{prompt_dir}/Shared_Optimized_System.md", # This one is full of constraints
        },
        {
            "id": "B4_STRICT_4_STATES",
            "sys": f"{prompt_dir}/B4_STRICT_SYSTEM.md", # Modified to have same density as B2
        }
    ]

    final_results = {}

    for s in scenarios:
        print(f"\n--- RUNNING FAIR TEST: {s['id']} ---")
        try:
            with open(s['sys'], "r") as f: sys_p = f.read()
            messages = [{"role": "system", "content": sys_p}, {"role": "user", "content": usr_p}]
            
            start = time.time()
            content, meta = await client.chat_async(messages)
            elapsed = time.time() - start
            
            # Basic validation
            valid_json = False
            tactics_is_list = False
            try:
                data = json.loads(content)
                valid_json = True
                if isinstance(data.get("tactics", {}).get("empty"), list):
                    tactics_is_list = True
                signal = data.get("signal")
            except:
                signal = "PARSE_ERROR"

            print(f"   Done | Signal: {signal} | Tokens: {meta.get('total_tokens')} | Valid Structure: {tactics_is_list}")
            
            final_results[s['id']] = {
                "signal": signal,
                "valid_structure": tactics_is_list,
                "input_tokens": meta.get("input_tokens"),
                "output_tokens": meta.get("output_tokens"),
                "total_tokens": meta.get("total_tokens"),
                "latency": elapsed,
                "content": content
            }
        except Exception as e:
            print(f"   ❌ Error: {e}")

    out_file = f"{base_dir}/results/FAIR_3_VS_4_STATES_COMPARISON.json"
    with open(out_file, "w") as f:
        json.dump(final_results, f, ensure_ascii=False, indent=2)
    print(f"\n✅ Fair comparison saved to {out_file}")

if __name__ == "__main__":
    asyncio.run(test_fair_comparison())
