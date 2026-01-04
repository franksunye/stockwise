import os
import sys
import json
import requests
import re

# Setup path
root_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.append(root_dir)
sys.path.append(os.path.join(root_dir, 'backend'))

from backend.engine.prompts import prepare_stock_analysis_prompt
from config import LLM_CONFIG

# Get prompt
system_prompt, user_prompt = prepare_stock_analysis_prompt("00700")

# Make request
api_key = os.getenv("LLM_API_KEY")
base_url = os.getenv("LLM_BASE_URL", "http://127.0.0.1:8045/v1")
model = "gpt-3.5-turbo"

headers = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {api_key}"
}

payload = {
    "model": model,
    "messages": [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt}
    ],
    "max_tokens": 4096,
    "temperature": 0.5
}

print(f"📡 Calling {base_url} with model {model}...")
response = requests.post(f"{base_url}/chat/completions", headers=headers, json=payload, timeout=120)
result = response.json()

content = result['choices'][0]['message']['content']

print(f"\n📥 Raw content length: {len(content)} chars")
print(f"First 100 chars: {repr(content[:100])}")
print(f"Last 100 chars: {repr(content[-100:])}")

# Try parsing
parsed = None
# 1. Standard
try:
    parsed = json.loads(content)
    print("✅ Method 1 (standard) succeeded")
except Exception as e:
    print(f"❌ Method 1 failed: {e}")

# 2. Clean markdown
if not parsed:
    content_clean = re.sub(r'^```json\s*', '', content, flags=re.MULTILINE)
    content_clean = re.sub(r'^```\s*', '', content_clean, flags=re.MULTILINE)
    content_clean = re.sub(r'```$', '', content_clean, flags=re.MULTILINE)
    try:
        parsed = json.loads(content_clean)
        print("✅ Method 2 (clean markdown) succeeded")
    except Exception as e:
        print(f"❌ Method 2 failed: {e}")

# 3. Stack balance
if not parsed:
    try:
        balance = 0
        start = content.find('{')
        if start != -1:
            for i in range(start, len(content)):
                if content[i] == '{':
                    balance += 1
                elif content[i] == '}':
                    balance -= 1
                    if balance == 0:
                        json_str = content[start:i+1]
                        parsed = json.loads(json_str)
                        print(f"✅ Method 3 (stack balance) succeeded, extracted {len(json_str)} chars")
                        break
    except Exception as e:
        print(f"❌ Method 3 failed: {e}")

if parsed:
    print(f"\n🎉 Parsed successfully! Signal: {parsed.get('signal')}, Confidence: {parsed.get('confidence')}")
else:
    print("\n💀 All parsing methods failed!")
    print(f"\nFull content:\n{content}")
