
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

async def test_four_states():
    client = LLMClient(provider, base_url=base_url, model=model_name, api_key=api_key)
    
    base_dir = "/Users/yesun/Code/stockwise/docs/7_Debug_Traces"
    prompt_dir = f"{base_dir}/prompts"
    
    # We use the Rich User Data for both
    user_p_path = f"{prompt_dir}/B2_Rich_User.md"
    with open(user_p_path, "r") as f: usr_p = f.read()

    scenarios = [
        {
            "id": "B2_LEGACY_3_STATES",
            "sys": f"{prompt_dir}/Shared_Optimized_System.md",
        },
        {
            "id": "B4_NEW_4_STATES",
            "sys": f"{prompt_dir}/B4_FourState_System.md",
        }
    ]

    final_results = {}

    for s in scenarios:
        print(f"\n--- RUNNING: {s['id']} ---")
        try:
            with open(s['sys'], "r") as f: sys_p = f.read()
            
            messages = [
                {"role": "system", "content": sys_p},
                {"role": "user", "content": usr_p}
            ]
            
            start = time.time()
            content, meta = await client.chat_async(messages)
            elapsed = time.time() - start
            
            print(f"   Done in {elapsed:.2f}s | Signal: {content[:100]}...") # Print partial to see signal
            
            # Extract signal if possible (heuristically)
            signal = "ERROR"
            try:
                data = json.loads(content)
                signal = data.get("signal", "N/A")
            except:
                # Manual extract if JSON is mangled or model adds text
                import re
                match = re.search(r'"signal":\s*"([^"]+)"', content)
                if match: signal = match.group(1)

            final_results[s['id']] = {
                "signal_extracted": signal,
                "content": content,
                "meta": meta,
                "latency": elapsed
            }
        except Exception as e:
            print(f"   ❌ Error in {s['id']}: {e}")

    out_file = f"{base_dir}/results/Four_State_Semantics_Comparison.json"
    with open(out_file, "w") as f:
        json.dump(final_results, f, ensure_ascii=False, indent=2)
        
    print(f"\n✅ Four-state comparison saved to {out_file}")

if __name__ == "__main__":
    asyncio.run(test_four_states())
