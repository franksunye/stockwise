"""
LLM 客户端模块
封装本地 LLM 代理服务的调用逻辑
"""

import json
import requests
from typing import Optional, Dict, Any, Tuple
import time
from config import LLM_CONFIG
from .llm_tracker import get_tracker, estimate_tokens


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
        max_tokens: int = 4096
    ) -> Tuple[Optional[str], Dict[str, Any]]:
        """
        发送聊天请求
        
        Args:
            messages: 消息列表，格式 [{"role": "user/system/assistant", "content": "..."}]
            model: 使用的模型（可覆盖默认）
            temperature: 生成温度
            max_tokens: 最大输出 token 数
            
        Returns:
            Tuple: (LLM 返回的文本内容, 元数据 dict)
            元数据包含: input_tokens, output_tokens, total_tokens, latency_ms, error
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
        
        meta = {
            "input_tokens": 0,
            "output_tokens": 0,
            "total_tokens": 0,
            "latency_ms": 0,
            "error": None
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
            meta["latency_ms"] = int(elapsed * 1000)
            
            if response.status_code == 200:
                data = response.json()
                
                # 提取 Token 使用量 (如果 API 返回)
                usage = data.get('usage', {})
                if usage:
                    meta["input_tokens"] = usage.get('prompt_tokens', 0)
                    meta["output_tokens"] = usage.get('completion_tokens', 0)
                    meta["total_tokens"] = usage.get('total_tokens', 0)
                
                if data.get('choices'):
                    content = data['choices'][0].get('message', {}).get('content')
                    
                    # 如果 API 没有返回 token 数，使用估算
                    if not meta["input_tokens"]:
                        input_text = " ".join([m.get('content', '') for m in messages])
                        meta["input_tokens"] = estimate_tokens(input_text)
                    if not meta["output_tokens"] and content:
                        meta["output_tokens"] = estimate_tokens(content)
                    if not meta["total_tokens"]:
                        meta["total_tokens"] = meta["input_tokens"] + meta["output_tokens"]
                    
                    print(f"   🤖 LLM 响应成功 ({elapsed:.1f}s, {meta['total_tokens']} tokens)")
                    return content, meta
                else:
                    meta["error"] = f"响应格式异常: {data}"
                    print(f"   ⚠️ LLM 响应格式异常: {data}")
                    return None, meta
            else:
                meta["error"] = f"HTTP {response.status_code}"
                print(f"   ❌ LLM 请求失败: HTTP {response.status_code}")
                return None, meta
                
        except requests.exceptions.Timeout:
            meta["error"] = f"请求超时 ({self.timeout}s)"
            print(f"   ❌ LLM 请求超时 ({self.timeout}s)")
            return None, meta
        except requests.exceptions.ConnectionError:
            meta["error"] = f"无法连接 LLM 服务: {self.base_url}"
            print(f"   ❌ 无法连接 LLM 服务: {self.base_url}")
            return None, meta
        except Exception as e:
            meta["error"] = str(e)
            print(f"   ❌ LLM 请求异常: {e}")
            return None, meta
    
    def generate_stock_prediction(
        self,
        system_prompt: str,
        user_prompt: str,
        symbol: str = None,
        retries: int = 2
    ) -> Optional[Dict[str, Any]]:
        """
        生成股票预测（带 JSON 解析、重试和追踪）
        
        Args:
            system_prompt: 系统提示词（定义输出格式）
            user_prompt: 用户输入（股票数据）
            symbol: 股票代码（用于追踪）
            retries: 重试次数
            
        Returns:
            解析后的预测结果 dict，失败返回 None
        """
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]
        
        # 开始追踪
        tracker = get_tracker()
        tracker.start_trace(symbol=symbol, model=self.model)
        tracker.set_prompts(system_prompt, user_prompt)
        
        final_content = None
        final_result = None
        last_meta = {}
        
        for attempt in range(retries + 1):
            if attempt > 0:
                print(f"   🔄 重试 {attempt}/{retries}...")
                tracker.increment_retry()
                
            content, meta = self.chat(messages, temperature=0.5)
            last_meta = meta
            
            if content:
                final_content = content
                # 尝试解析 JSON
                result = self._parse_json_response(content)
                if result:
                    final_result = result
                    break
                else:
                    print(f"   ⚠️ JSON 解析失败，原始内容:\n{content[:500]}...")
        
        # 记录追踪结果
        tracker.set_tokens(
            input_tokens=last_meta.get("input_tokens", 0),
            output_tokens=last_meta.get("output_tokens", 0),
            total_tokens=last_meta.get("total_tokens", 0)
        )
        tracker.set_response(final_content, final_result)
        
        if final_result:
            tracker.set_status("success")
        elif final_content:
            tracker.set_status("parse_failed", "JSON 解析失败")
        else:
            tracker.set_status("error", last_meta.get("error", "未知错误"))
        
        # 结束追踪并保存
        trace = tracker.end_trace()
        if trace:
            status_emoji = "✅" if trace.status == "success" else "❌"
            print(f"   📊 追踪完成: {status_emoji} {trace.latency_ms}ms | {trace.total_tokens} tokens | 重试 {trace.retry_count} 次")
        
        return final_result
    
    def _parse_json_response(self, content: str) -> Optional[Dict[str, Any]]:
        """
        解析 LLM 返回的 JSON 内容（深度清洗版）
        针对: Markdown 块、非标准引号、开头结尾乱码、自动截断修复
        """
        if not content:
            return None
        
        # 1. 尝试标准解析
        try:
            return json.loads(content)
        except:
            pass
            
        import re
        
        # 2. 移除常见的 Markdown 标记
        content_clean = re.sub(r'^```json\s*', '', content, flags=re.MULTILINE)
        content_clean = re.sub(r'^```\s*', '', content_clean, flags=re.MULTILINE)
        content_clean = re.sub(r'```$', '', content_clean, flags=re.MULTILINE)
        try:
            return json.loads(content_clean)
        except:
            pass
            
        # 3. 暴力提取最外层的 {}
        try:
            # 找到第一个 {
            start_idx = content.find('{')
            if start_idx != -1:
                # 倒序找到最后一个 }
                end_idx = content.rfind('}')
                if end_idx != -1 and end_idx > start_idx:
                    possible_json = content[start_idx : end_idx + 1]
                    # 尝试清理可能混入的换行符问题
                    possible_json = re.sub(r',\s*}', '}', possible_json) # 移除尾随逗号
                    return json.loads(possible_json)
        except:
            pass

        # 4. 如果还是不行，尝试使用栈平衡法找到完整的对象 (针对粘包/截断)
        try:
            balance = 0
            start = content.find('{')
            if start != -1:
                for i in range(start, len(content)):
                    char = content[i]
                    if char == '{':
                        balance += 1
                    elif char == '}':
                        balance -= 1
                        if balance == 0:
                            # 找到了一个完整的顶层对象
                            return json.loads(content[start:i+1])
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
    response, meta = client.chat([{"role": "user", "content": "回复'OK'"}])
    if response:
        print(f"   测试响应: {response[:50]}...")
        print(f"   Token 使用: {meta.get('total_tokens', 'N/A')}")
        return True
    return False


if __name__ == "__main__":
    test_llm_connection()
