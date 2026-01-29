import requests
import json
import time
import os

# User provided API Key from the previous step
# Using DashScope endpoint for DeepSeek model
API_KEY = os.getenv("QWEN_API_KEY", "sk-cc191c6af76e4ab1a7367befb7b2b6af")

# Aliyun DashScope OpenAI-compatible endpoint
BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions"

# Model Name from User's Screenshot / Search Results
# Screenshot showed "deepseek-v3.2", search confirms availability.
MODEL_NAME = "deepseek-v3" # Let's try v3.2 first as requested, else fall back to v3

def test_aliyun_deepseek():
    print(f"🔧 Testing Aliyun DashScope with model: {MODEL_NAME}")
    print(f"🔑 API Key: {API_KEY[:6]}...")
    
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }

    # A financial analysis task to test the model's reasoning
    messages = [
        {"role": "system", "content": "You are a professional financial analyst."},
        {"role": "user", "content": "Briefly analyze why high interest rates might negatively affect tech growth stocks. Keep it under 100 words."}
    ]

    payload = {
        "model": MODEL_NAME, # Try specific model
        "messages": messages,
        "temperature": 0.7
    }

    print(f"🚀 Sending request to {BASE_URL}...")
    
    start_time = time.time()
    try:
        response = requests.post(BASE_URL, headers=headers, json=payload)
        
        if response.status_code != 200:
             print(f"⚠️ Initial attempt with {MODEL_NAME} failed: {response.status_code}")
             print(response.text)
             
             # Fallback to standard v3 if v3.2 isn't the API name
             if MODEL_NAME == "deepseek-v3.2":
                 print("🔄 Retrying with 'deepseek-v3'...")
                 payload["model"] = "deepseek-v3"
                 response = requests.post(BASE_URL, headers=headers, json=payload)

        response.raise_for_status()
        
        data = response.json()
        duration = time.time() - start_time
        
        print(f"✅ Success! (Took {duration:.2f}s)")
        
        if 'choices' in data:
            content = data['choices'][0]['message']['content']
            print("\n--- DeepSeek Response ---\n")
            print(content)
            print("\n-------------------------\n")
            
            # Check usage
            if 'usage' in data:
                print("Usage:", data['usage'])
        else:
            print("❌ No choices in response:", data)
            
    except Exception as e:
        print(f"❌ An error occurred: {e}")

if __name__ == "__main__":
    test_aliyun_deepseek()
