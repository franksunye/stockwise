import requests
import json
import time
import os

# User provided API Key (Safe usage via Env Var or Input)
# API_KEY = "sk-..." 
API_KEY = os.getenv("QWEN_API_KEY")

# DashScope (Aliyun) OpenAI-compatible endpoint
BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions"
# Using the tested model
MODEL_NAME = "qwen2.5-coder-32b-instruct" 

def test_qwen():
    if not API_KEY:
        print("❌ Error: Please set QWEN_API_KEY environment variable.")
        print("Example: $env:QWEN_API_KEY='sk-...'")
        return

    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }

    # A simple coding task
    messages = [
        {"role": "system", "content": "You are a helpful coding assistant."},
        {"role": "user", "content": "Write a Python function to calculate the Fibonacci sequence up to n terms efficiently."}
    ]

    payload = {
        "model": MODEL_NAME,
        "messages": messages,
        "stream": False
    }

    print(f"🚀 Sending request to {BASE_URL}...")
    print(f"Model: {MODEL_NAME}")
    
    start_time = time.time()
    try:
        response = requests.post(BASE_URL, headers=headers, json=payload)
        response.raise_for_status() # Raise error for bad status codes
        
        data = response.json()
        duration = time.time() - start_time
        
        print(f"✅ Success! (Took {duration:.2f}s)")
        
        content = data['choices'][0]['message']['content']
        print("\n--- Response Content ---\n")
        print(content)
        print("\n------------------------\n")
        
        # Check usage if available
        if 'usage' in data:
            print("Usage:", data['usage'])
            
    except requests.exceptions.RequestException as e:
        print(f"❌ API Request Failed: {e}")
        if response is not None:
             print(f"Response Text: {response.text}")
    except Exception as e:
        print(f"❌ An error occurred: {e}")

if __name__ == "__main__":
    test_qwen()
