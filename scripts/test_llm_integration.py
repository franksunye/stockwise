import sys
import os
from pathlib import Path

# 添加项目根目录到 sys.path
root_dir = Path(__file__).parent.parent
sys.path.append(str(root_dir))
sys.path.append(str(root_dir / "backend"))

from backend.engine.llm_client import get_llm_client, LLMClient
from backend.config import LLM_CONFIG

def verify_integration():
    print(f"🔍 检查集成配置...")
    print(f"   Provider: {LLM_CONFIG['provider']}")
    print(f"   Hunyuan Key exists: {'Yes' if 'hunyuan' in LLM_CONFIG and LLM_CONFIG['hunyuan'].get('api_key') else 'No'}")
    
    # 强制创建一个 Hunyuan 客户端进行测试
    print(f"\n🧪 正在通过 LLMClient (Hunyuan provider) 发起测试请求...")
    client = LLMClient(provider="hunyuan")
    
    messages = [
        {"role": "user", "content": "你好，请确认你已经通过 StockWise 系统集成成功。回复 'Integrated: Yes'"}
    ]
    
    response, meta = client.chat(messages)
    
    if response:
        print(f"✅ 集成验证成功!")
        print(f"🤖 响应: {response}")
        print(f"📊 使用: {meta}")
    else:
        print(f"❌ 集成验证失败: {meta.get('error')}")

if __name__ == "__main__":
    verify_integration()
