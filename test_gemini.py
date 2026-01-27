import asyncio
import os
import sys

# Add paths
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.join(current_dir, "backend")
sys.path.insert(0, backend_dir)

from backend.engine.llm_client import LLMClient

async def test():
    print("Testing gemini_local...")
    client = LLMClient(provider="gemini_local")
    print(f"Provider: {client.provider}")
    print(f"Base URL: {client.base_url}")
    print(f"Model: {client.model}")
    
    messages = [{"role": "user", "content": "Hello, respond with 'Gemini OK'"}]
    try:
        content, meta = await client.chat_async(messages)
        print(f"Response: {content}")
        print(f"Meta: {meta}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(test())
