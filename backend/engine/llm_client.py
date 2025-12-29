"""
LLM 客户端模块
封装本地 LLM 代理服务的调用逻辑
"""

import json
import requests
from typing import Optional, Dict, Any
import time
from config import LLM_CONFIG


class LLMClient:
    """本地 LLM 代理客户端"""
    
    def __init__(
        self,
        base_url: str = None,
        api_key: str = None,
        model: str = None,
        timeout: int = 120
    ):
        """
        初始化 LLM 客户端
        
        Args:
            base_url: API 基础地址，默认使用配置
            api_key: API 密钥，默认使用配置
            model: 模型名称，默认使用配置
            timeout: 请求超时时间（秒）
        """
        self.base_url = base_url or LLM_CONFIG.get("base_url", "http://127.0.0.1:8045/v1")
        self.api_key = api_key or LLM_CONFIG.get("api_key", "")
        self.model = model or LLM_CONFIG.get("model", "gpt-3.5-turbo")
        self.timeout = timeout
        
    def is_available(self) -> bool:
        """检查 LLM 服务是否可用"""
        try:
            response = requests.get(
                f"{self.base_url}/models",
                timeout=5,
                headers={"Authorization": f"Bearer {self.api_key}"}
            )
            return response.status_code == 200
        except:
            return False
    
    def chat(
        self,
        messages: list,
        model: str = None,
        temperature: float = 0.7,
        max_tokens: int = 2000
    ) -> Optional[str]:
        """
        发送聊天请求
        
        Args:
            messages: 消息列表，格式 [{"role": "user/system/assistant", "content": "..."}]
            model: 使用的模型（可覆盖默认）
            temperature: 生成温度
            max_tokens: 最大输出 token 数
            
        Returns:
            LLM 返回的文本内容，失败返回 None
        """
        payload = {
            "model": model or self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": 4000, # 确保有足够的长度生成完整的 JSON
        }
        
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}"
        }
        
        try:
            start_time = time.time()
            response = requests.post(
                f"{self.base_url}/chat/completions",
                headers=headers,
                json=payload,
                timeout=self.timeout
            )
            elapsed = time.time() - start_time
            
            if response.status_code == 200:
                data = response.json()
                if data.get('choices'):
                    content = data['choices'][0].get('message', {}).get('content')
                    print(f"   🤖 LLM 响应成功 ({elapsed:.1f}s)")
                    return content
                else:
                    print(f"   ⚠️ LLM 响应格式异常: {data}")
                    return None
            else:
                print(f"   ❌ LLM 请求失败: HTTP {response.status_code}")
                return None
                
        except requests.exceptions.Timeout:
            print(f"   ❌ LLM 请求超时 ({self.timeout}s)")
            return None
        except requests.exceptions.ConnectionError:
            print(f"   ❌ 无法连接 LLM 服务: {self.base_url}")
            return None
        except Exception as e:
            print(f"   ❌ LLM 请求异常: {e}")
            return None
    
    def generate_stock_prediction(
        self,
        system_prompt: str,
        user_prompt: str,
        retries: int = 2
    ) -> Optional[Dict[str, Any]]:
        """
        生成股票预测（带 JSON 解析和重试）
        
        Args:
            system_prompt: 系统提示词（定义输出格式）
            user_prompt: 用户输入（股票数据）
            retries: 重试次数
            
        Returns:
            解析后的预测结果 dict，失败返回 None
        """
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]
        
        for attempt in range(retries + 1):
            if attempt > 0:
                print(f"   🔄 重试 {attempt}/{retries}...")
                
            content = self.chat(messages, temperature=0.5)
            
            if content:
                # 尝试解析 JSON
                result = self._parse_json_response(content)
                if result:
                    return result
                else:
                    print(f"   ⚠️ JSON 解析失败，原始内容:\n{content}")
            
        return None
    
    def _parse_json_response(self, content: str) -> Optional[Dict[str, Any]]:
        """
        解析 LLM 返回的 JSON 内容（处理 markdown 代码块、嵌套及不完整内容）
        """
        if not content:
            return None
            
        # 清理常见的干扰字符
        content = content.strip()
        
        # 1. 尝试直接解析
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            pass
            
        # 2. 尝试提取所有 ```json ... ``` 块并解析（优先从后往前找）
        import re
        json_blocks = re.findall(r'```json\s*(.*?)\s*```', content, re.DOTALL)
        if not json_blocks:
            # 尝试处理只有开始没有结束的代码块（截断情况），同样优先后方的
            json_blocks = re.findall(r'```json\s*(.*)', content, re.DOTALL)
            
        if json_blocks:
            # 从后往前尝试解析，因为模型幻觉往往是在后面重新输出了正确的完整块
            for block in reversed(json_blocks):
                try:
                    # 再次清理块内可能存在的嵌套幻觉（截断到下一个 ``` 之前）
                    clean_block = block.split('```')[0].strip()
                    return json.loads(clean_block)
                except json.JSONDecodeError as e:
                    # 尝试修复由于截断导致的 JSON 不完整
                    if "Expecting ',' delimiter" in str(e) or "Expecting value" in str(e) or "Unterminated string" in str(e):
                        try:
                            # 尝试在末尾补全封闭字符（仅当确实有内容时）
                            if len(clean_block) > 50:
                                for suffix in [" }", '" }', '" } ] }', ' } ] }']:
                                    try:
                                        return json.loads(clean_block + suffix)
                                    except:
                                        continue
                        except:
                            pass
                    continue
                
        # 3. 尝试提取简单的 ``` ... ``` 块
        code_blocks = re.findall(r'```\s*(.*?)\s*```', content, re.DOTALL)
        for block in code_blocks:
            try:
                # 再次检查是否含有嵌套的 json 标识
                clean_block = re.sub(r'^json\s*', '', block.strip())
                return json.loads(clean_block)
            except json.JSONDecodeError:
                continue
                
        # 4. 尝试寻找第一个 { 和最后一个 }
        try:
            start = content.find('{')
            end = content.rfind('}') + 1
            if start >= 0 and end > start:
                json_str = content[start:end]
                # 移除可能存在的中间 markdown 标记
                json_str = re.sub(r'```json|```', '', json_str)
                return json.loads(json_str)
        except:
            pass
            
        return None


# 全局客户端实例（懒加载）
_client: Optional[LLMClient] = None


def get_llm_client() -> LLMClient:
    """获取全局 LLM 客户端实例"""
    global _client
    if _client is None:
        _client = LLMClient()
    return _client


def test_llm_connection() -> bool:
    """测试 LLM 连接"""
    client = get_llm_client()
    if not client.is_available():
        print("❌ LLM 服务不可用")
        return False
    
    print("✅ LLM 服务连接成功")
    response = client.chat([{"role": "user", "content": "回复'OK'"}])
    if response:
        print(f"   测试响应: {response[:50]}...")
        return True
    return False


if __name__ == "__main__":
    test_llm_connection()
