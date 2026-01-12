"""
LLM 客户端模块
封装本地 LLM 代理服务的调用逻辑
"""

import json
import requests
from typing import Optional, Dict, Any, Tuple
import time
try:
    from backend.config import LLM_CONFIG
except ImportError:
    from config import LLM_CONFIG
from .llm_tracker import get_tracker, estimate_tokens
from .schema_normalizer import normalize_ai_response

import asyncio

class AsyncRateLimiter:
    """简单的异步速率限制器 (Token Bucket 思想)"""
    def __init__(self, rate: float):
        self._interval = 1.0 / rate if rate > 0 else 0
        self._last_check = 0.0
        self._lock = asyncio.Lock()

    async def acquire(self):
        if self._interval <= 0: return
        async with self._lock:
            now = time.time()
            elapsed = now - self._last_check
            wait_time = self._interval - elapsed
            if wait_time > 0:
                await asyncio.sleep(wait_time)
            self._last_check = time.time() + (wait_time if wait_time > 0 else 0)

class LLMClient:
    """本地 LLM 代理客户端"""
    
    # 全局共享的限流器 (Provider -> AsyncRateLimiter)
    _rate_limiters = {}
    
    def __init__(
        self,
        provider: str = None,
        base_url: str = None,
        api_key: str = None,
        model: str = None,
        timeout: int = 120
    ):
        """
        初始化 LLM 客户端
        """
        self.provider = provider or LLM_CONFIG.get("provider", "openai")
        self.timeout = timeout
        
        # 自动注册 Hunyuan 限流器
        if self.provider == "hunyuan" and "hunyuan" not in self._rate_limiters:
            qps = LLM_CONFIG.get("hunyuan", {}).get("qps_limit", 2.0)
            self._rate_limiters["hunyuan"] = AsyncRateLimiter(qps)
        
        # 根据提供商加载默认配置
        if self.provider == "deepseek":
            ds_config = LLM_CONFIG.get("deepseek", {})
            self.base_url = base_url or ds_config.get("base_url") or "https://api.deepseek.com/v1"
            self.api_key = api_key or ds_config.get("api_key") or LLM_CONFIG.get("api_key")
            self.model = model or ds_config.get("model") or "deepseek-chat"
        elif self.provider == "gemini":
            gm_config = LLM_CONFIG.get("gemini", {})
            self.api_key = api_key or gm_config.get("api_key") or LLM_CONFIG.get("api_key")
            self.model = model or gm_config.get("model") or "gemini-pro"
            self.base_url = base_url # Gemini native usually doesn't use base_url in standard requests
        elif self.provider == "gemini_local":
            # 新增: 通过 Gemini SDK 连接本地代理 (Antigravity Tools)
            gm_local_config = LLM_CONFIG.get("gemini_local", {})
            self.base_url = base_url or gm_local_config.get("base_url") or "http://127.0.0.1:8045"
            self.api_key = api_key or gm_local_config.get("api_key") or LLM_CONFIG.get("api_key")
            self.model = model or gm_local_config.get("model") or "gemini-3-flash"
        elif self.provider == "hunyuan":
            hy_config = LLM_CONFIG.get("hunyuan", {})
            self.base_url = base_url or hy_config.get("base_url") or "https://api.hunyuan.cloud.tencent.com/v1"
            self.api_key = api_key or hy_config.get("api_key")
            self.model = model or hy_config.get("model") or "hunyuan-lite"
        else: # openai, custom, or generic
            self.base_url = base_url or LLM_CONFIG.get("base_url", "http://127.0.0.1:8045/v1")
            self.api_key = api_key or LLM_CONFIG.get("api_key", "")
            self.model = model or LLM_CONFIG.get("model", "gpt-3.5-turbo")

        self.timeout = timeout
        
        # Gemini Native Client 缓存 (用于云端 Gemini)
        self._gemini_client = None
        if self.provider == "gemini" and self.api_key:
            try:
                from google import genai
                self._gemini_client = genai.Client(api_key=self.api_key)
            except Exception as e:
                print(f"⚠️ 初始化 Gemini V2 SDK 失败: {e}")
        
        # Gemini Local Client 缓存 (用于本地代理)
        self._gemini_local_client = None
        if self.provider == "gemini_local" and self.api_key:
            try:
                from google import genai
                # V2 SDK support custom endpoint via http_options
                self._gemini_local_client = genai.Client(
                    api_key=self.api_key,
                    http_options={'base_url': self.base_url}
                )
                print(f"✅ Gemini Local V2 SDK 初始化成功 -> {self.base_url}")
            except Exception as e:
                print(f"⚠️ 初始化 Gemini Local V2 SDK 失败: {e}")
        
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
        """发送聊天请求"""
        if self.provider == "gemini" and self._gemini_client:
            return self._chat_gemini(messages, temperature, max_tokens)
        elif self.provider == "gemini_local" and self._gemini_local_client:
            return self._chat_gemini_local(messages, temperature, max_tokens)
        
        return self._chat_openai_compatible(messages, model, temperature, max_tokens)

    async def chat_async(
        self,
        messages: list,
        model: str = None,
        temperature: float = 0.7,
        max_tokens: int = 4096
    ) -> Tuple[Optional[str], Dict[str, Any]]:
        """Async wrapper for chat (using executor)"""
        # Rate Limiting Check
        if self.provider in self._rate_limiters:
            await self._rate_limiters[self.provider].acquire()

        import asyncio
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(
            None, 
            lambda: self.chat(messages, model, temperature, max_tokens)
        )

    def _chat_openai_compatible(
        self,
        messages: list,
        model: str = None,
        temperature: float = 0.7,
        max_tokens: int = 4096
    ) -> Tuple[Optional[str], Dict[str, Any]]:
        payload = {
            "model": model or self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}"
        }
        
        meta = {"input_tokens": 0, "output_tokens": 0, "total_tokens": 0, "latency_ms": 0, "error": None}
        
        try:
            start_time = time.time()
            response = requests.post(f"{self.base_url}/chat/completions", headers=headers, json=payload, timeout=self.timeout)
            elapsed = time.time() - start_time
            meta["latency_ms"] = int(elapsed * 1000)
            
            if response.status_code == 200:
                data = response.json()
                usage = data.get('usage', {})
                if usage:
                    meta["input_tokens"] = usage.get('prompt_tokens', 0)
                    meta["output_tokens"] = usage.get('completion_tokens', 0)
                    meta["total_tokens"] = usage.get('total_tokens', 0)
                
                if data.get('choices'):
                    content = data['choices'][0].get('message', {}).get('content')
                    if not meta["input_tokens"]:
                        input_text = " ".join([m.get('content', '') for m in messages])
                        meta["input_tokens"] = estimate_tokens(input_text)
                    if not meta["output_tokens"] and content:
                        meta["output_tokens"] = estimate_tokens(content)
                    if not meta["total_tokens"]:
                        meta["total_tokens"] = meta["input_tokens"] + meta["output_tokens"]
                    
                    print(f"   🤖 {self.provider.upper()} 响应成功 ({elapsed:.1f}s, {meta['total_tokens']} tokens)")
                    return content, meta
                else:
                    meta["error"] = f"响应格式异常: {data}"
                    return None, meta
            else:
                meta["error"] = f"HTTP {response.status_code}: {response.text[:200]}"
                print(f"   ❌ {self.provider.upper()} 请求失败: HTTP {response.status_code}")
                return None, meta
        except Exception as e:
            meta["error"] = str(e)
            print(f"   ❌ {self.provider.upper()} 请求异常: {e}")
            return None, meta

    def _chat_gemini(
        self, 
        messages: list, 
        temperature: float = 0.7, 
        max_tokens: int = 4096
    ) -> Tuple[Optional[str], Dict[str, Any]]:
        meta = {"input_tokens": 0, "output_tokens": 0, "total_tokens": 0, "latency_ms": 0, "error": None}
        try:
            # 提取 system 及 history
            system_msg = ""
            history = []
            
            # 格式转换：Role 必须是 'user' 或 'model'
            # System message 通过 config 传递
            for m in messages:
                if m["role"] == "system":
                    system_msg = m["content"]
                elif m["role"] == "user":
                    history.append({"role": "user", "parts": [{"text": m["content"]}]})
                elif m["role"] == "assistant":
                    history.append({"role": "model", "parts": [{"text": m["content"]}]})
            
            client = self._gemini_client
            start_time = time.time()
            
            # 使用 V2 SDK 调用
            # 注意: V2 SDK 的 Chat 接口略有不同，这里使用 models.generate_content 配合 history 实现单次调用
            # 或者使用 chats.create
            
            # 简单起见，我们使用 generate_content (Stateless)
            # 需要把 history 构造为 contents
            # 最后一个作为 prompt? No, generate_content 接受完整列表
            
            contents = history # V2 contents format: list of Content or dict
            
            from google import genai
            from google.genai import types
            
            config = types.GenerateContentConfig(
                temperature=temperature,
                max_output_tokens=max_tokens,
                system_instruction=system_msg if system_msg else None
            )
            
            response = client.models.generate_content(
                model=self.model,
                contents=contents,
                config=config
            )
            
            elapsed = time.time() - start_time
            meta["latency_ms"] = int(elapsed * 1000)
            
            content = response.text
            
            # 提取 Token 使用情况
            if response.usage_metadata:
                meta["input_tokens"] = response.usage_metadata.prompt_token_count
                meta["output_tokens"] = response.usage_metadata.candidates_token_count
                meta["total_tokens"] = response.usage_metadata.total_token_count
            
            print(f"   🤖 GEMINI 响应成功 ({elapsed:.1f}s, {meta['total_tokens']} tokens)")
            return content, meta
        except Exception as e:
            meta["error"] = str(e)
            print(f"   ❌ GEMINI 请求异常: {e}")
            return None, meta
    
    def _chat_gemini_local(
        self, 
        messages: list, 
        temperature: float = 0.7, 
        max_tokens: int = 4096
    ) -> Tuple[Optional[str], Dict[str, Any]]:
        """
        通过本地代理调用 Gemini V2 SDK
        """
        meta = {"input_tokens": 0, "output_tokens": 0, "total_tokens": 0, "latency_ms": 0, "error": None}
        try:
            # 构造内容
            # 注意：如果本地代理还不支持 system_instruction, 需要手动合并
            system_msg = ""
            contents = []
            
            for m in messages:
                role = "user"
                if m["role"] == "assistant": role = "model"
                elif m["role"] == "system": 
                    system_msg = m["content"]
                    continue # merge later
                
                contents.append({"role": role, "parts": [{"text": m["content"]}]})
            
            # 手动合并 System Prompt 到第一个 User Message
            if system_msg and contents:
                 first_part = contents[0]["parts"][0]["text"]
                 contents[0]["parts"][0]["text"] = f"[系统指令] {system_msg}\n\n[用户消息] {first_part}"
            
            client = self._gemini_local_client
            start_time = time.time()
            
            from google import genai
            from google.genai import types
            
            config = types.GenerateContentConfig(
                temperature=temperature,
                max_output_tokens=max_tokens
            )
            
            response = client.models.generate_content(
                model=self.model,
                contents=contents,
                config=config
            )
            
            elapsed = time.time() - start_time
            meta["latency_ms"] = int(elapsed * 1000)
            
            content = response.text
             
            # Token Usage
            if response.usage_metadata:
                meta["input_tokens"] = response.usage_metadata.prompt_token_count
                meta["output_tokens"] = response.usage_metadata.candidates_token_count
                meta["total_tokens"] = response.usage_metadata.total_token_count
            else:
                meta["input_tokens"] = estimate_tokens(str(messages))
                meta["output_tokens"] = estimate_tokens(content)
                meta["total_tokens"] = meta["input_tokens"] + meta["output_tokens"]
                
            print(f"   🤖 GEMINI_LOCAL 响应成功 ({elapsed:.1f}s, {meta['total_tokens']} tokens)")
            return content, meta
        except Exception as e:
            meta["error"] = str(e)
            print(f"   ❌ GEMINI_LOCAL 请求异常: {e}")
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
                    # 标准化数据结构 / Normalize schema
                    result = normalize_ai_response(result)
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
