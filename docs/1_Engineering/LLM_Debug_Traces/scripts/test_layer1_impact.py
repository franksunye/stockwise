
import os
import sys
import asyncio
import json
import time

# Add backend to path
WORKSPACE_ROOT = "/Users/yesun/Code/stockwise"
sys.path.insert(0, WORKSPACE_ROOT)

from backend.engine.llm_client import LLMClient

# Gemini Config
provider = "gemini_local"
model_name = "gemini-3-flash"
base_url = "http://127.0.0.1:8045"
api_key = "dummy"

async def test_comparison():
    client = LLMClient(provider, base_url=base_url, model=model_name, api_key=api_key)
    
    # New Standardized Paths
    base_dir = "/Users/yesun/Code/stockwise/docs/7_Debug_Traces"
    prompt_dir = f"{base_dir}/prompts"
    
    scenarios = [
        {
            "id": "B2_WITH_L1",
            "sys": f"{prompt_dir}/Shared_Optimized_System.md",
            "usr": f"{prompt_dir}/B2_Rich_User.md"
        },
        {
            "id": "B2_WITHOUT_L1",
            "sys": f"{prompt_dir}/Shared_Optimized_System.md",
            "usr": f"{prompt_dir}/B2_No_L1_User.md"
        }
    ]

    final_results = {}

    for s in scenarios:
        print(f"\n--- RUNNING SCENARIO: {s['id']} ---")
        try:
            with open(s['sys'], "r") as f: sys_p = f.read()
            with open(s['usr'], "r") as f: usr_p = f.read()
            
            messages = [
                {"role": "system", "content": sys_p},
                {"role": "user", "content": usr_p}
            ]
            
            start = time.time()
            content, meta = await client.chat_async(messages)
            elapsed = time.time() - start
            
            print(f"   Done in {elapsed:.2f}s | Tokens: {meta.get('total_tokens')}")
            final_results[s['id']] = {
                "content": content,
                "meta": meta,
                "tokens": meta.get('total_tokens'),
                "latency": elapsed
            }
        except Exception as e:
            print(f"   ❌ Error in {s['id']}: {e}")

    # Save results to standardized results directory
    out_file = f"{base_dir}/results/Layer1_Constraint_Test.json"
    with open(out_file, "w") as f:
        json.dump(final_results, f, ensure_ascii=False, indent=2)
        
    print(f"\n✅ Layer-1 test results saved to {out_file}")

if __name__ == "__main__":
    asyncio.run(test_comparison())
