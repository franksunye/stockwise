import requests
import time
import json

def test_hunyuan_lite():
    api_key = "sk-t5eMk6ZZSLu3CJlYpMmsPVNQQMcBrjY4N2uxhkfkMP3PgKv0"
    base_url = "https://api.hunyuan.cloud.tencent.com/v1"
    model = "hunyuan-lite"
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}"
    }
    
    payload = {
        "model": model,
        "messages": [
            {"role": "user", "content": "你好，请确认你是否是腾讯混元-lite模型？如果是，请回复 'OK: Hunyuan-lite is active'"}
        ],
        "temperature": 0.7
    }
    
    print(f"🚀 正在测试腾讯混元模型...")
    print(f"   Model: {model}")
    print(f"   Endpoint: {base_url}/chat/completions")
    
    try:
        start_time = time.time()
        response = requests.post(
            f"{base_url}/chat/completions",
            headers=headers,
            json=payload,
            timeout=30
        )
        elapsed = time.time() - start_time
        
        if response.status_code == 200:
            data = response.json()
            content = data['choices'][0]['message']['content']
            usage = data.get('usage', {})
            
            print(f"✅ 连接成功! (耗时: {elapsed:.2f}s)")
            print(f"🤖 模型响应: {content}")
            print(f"📊 Token 使用: {usage}")
            
            # 测试 JSON 能力
            print("\n🧪 正在测试 JSON 输出能力...")
            json_payload = {
                "model": model,
                "messages": [
                    {"role": "system", "content": "你是一个助手，请只输出 JSON 格式。"},
                    {"role": "user", "content": "请输出一个包含 'status' 为 'ready' 和 'model' 为 'hunyuan-lite' 的 JSON 对象。"}
                ],
                "response_format": {"type": "json_object"},
                "temperature": 0.1
            }
            
            start_time = time.time()
            response = requests.post(
                f"{base_url}/chat/completions",
                headers=headers,
                json=json_payload,
                timeout=30
            )
            elapsed = time.time() - start_time
            
            if response.status_code == 200:
                data = response.json()
                content = data['choices'][0]['message']['content']
                print(f"✅ JSON 测试成功! (耗时: {elapsed:.2f}s)")
                print(f"🤖 JSON 响应: {content}")
            else:
                print(f"❌ JSON 测试失败: HTTP {response.status_code}")
                print(f"   响应内容: {response.text}")
                
        else:
            print(f"❌ 请求失败: HTTP {response.status_code}")
            print(f"   响应内容: {response.text}")
            
    except Exception as e:
        print(f"❌ 发生异常: {e}")

if __name__ == "__main__":
    test_hunyuan_lite()
