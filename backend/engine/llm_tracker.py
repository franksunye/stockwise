"""
LLM 调用追踪模块
记录每次 LLM 调用的提示词、响应、Token 使用和延迟等信息
"""

import uuid
import time
import json
from datetime import datetime
from typing import Optional, Dict, Any
from dataclasses import dataclass, field, asdict


@dataclass
class LLMTrace:
    """LLM 调用追踪数据"""
    trace_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    symbol: Optional[str] = None
    model: str = ""
    
    # 提示词
    system_prompt: str = ""
    user_prompt: str = ""
    
    # 响应
    response_raw: str = ""
    response_parsed: Optional[str] = None  # JSON 字符串
    
    # Token 统计
    input_tokens: int = 0
    output_tokens: int = 0
    total_tokens: int = 0
    
    # 时间统计 (毫秒)
    latency_ms: int = 0
    
    # 状态
    status: str = "pending"  # pending, success, error, parse_failed
    error_message: str = ""
    retry_count: int = 0
    
    # 时间戳
    created_at: str = field(default_factory=lambda: datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class LLMTracker:
    """LLM 调用追踪器"""
    
    def __init__(self):
        self._current_trace: Optional[LLMTrace] = None
        self._start_time: float = 0
        
    def start_trace(self, symbol: str = None, model: str = "") -> LLMTrace:
        """开始一次新的追踪"""
        self._current_trace = LLMTrace(symbol=symbol, model=model)
        self._start_time = time.time()
        return self._current_trace
    
    def set_prompts(self, system_prompt: str, user_prompt: str):
        """记录提示词"""
        if self._current_trace:
            self._current_trace.system_prompt = system_prompt
            self._current_trace.user_prompt = user_prompt
    
    def set_response(self, raw_response: str, parsed_response: Dict = None):
        """记录响应"""
        if self._current_trace:
            self._current_trace.response_raw = raw_response or ""
            if parsed_response:
                self._current_trace.response_parsed = json.dumps(parsed_response, ensure_ascii=False)
    
    def set_tokens(self, input_tokens: int = 0, output_tokens: int = 0, total_tokens: int = 0):
        """记录 Token 使用量"""
        if self._current_trace:
            self._current_trace.input_tokens = input_tokens
            self._current_trace.output_tokens = output_tokens
            self._current_trace.total_tokens = total_tokens or (input_tokens + output_tokens)
    
    def set_status(self, status: str, error_message: str = ""):
        """设置状态"""
        if self._current_trace:
            self._current_trace.status = status
            self._current_trace.error_message = error_message
    
    def increment_retry(self):
        """增加重试计数"""
        if self._current_trace:
            self._current_trace.retry_count += 1
    
    def end_trace(self) -> Optional[LLMTrace]:
        """结束追踪并计算延迟"""
        if self._current_trace:
            elapsed_ms = int((time.time() - self._start_time) * 1000)
            self._current_trace.latency_ms = elapsed_ms
            
            # 保存到数据库
            self._save_trace(self._current_trace)
            
            trace = self._current_trace
            self._current_trace = None
            return trace
        return None
    
    def _save_trace(self, trace: LLMTrace):
        """保存追踪记录到数据库 (自动适配配置)"""
        try:
            from database import get_connection
            
            conn = get_connection()
            cursor = conn.cursor()
            
            # 确保表存在
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS llm_traces (
                    trace_id TEXT PRIMARY KEY,
                    symbol TEXT,
                    model TEXT,
                    system_prompt TEXT,
                    user_prompt TEXT,
                    response_raw TEXT,
                    response_parsed TEXT,
                    input_tokens INTEGER DEFAULT 0,
                    output_tokens INTEGER DEFAULT 0,
                    total_tokens INTEGER DEFAULT 0,
                    latency_ms INTEGER DEFAULT 0,
                    status TEXT DEFAULT 'pending',
                    error_message TEXT,
                    retry_count INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            cursor.execute("""
                INSERT INTO llm_traces (
                    trace_id, symbol, model,
                    system_prompt, user_prompt,
                    response_raw, response_parsed,
                    input_tokens, output_tokens, total_tokens,
                    latency_ms, status, error_message, retry_count, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                trace.trace_id, trace.symbol, trace.model,
                trace.system_prompt, trace.user_prompt,
                trace.response_raw, trace.response_parsed,
                trace.input_tokens, trace.output_tokens, trace.total_tokens,
                trace.latency_ms, trace.status, trace.error_message, 
                trace.retry_count, trace.created_at
            ))
            
            conn.commit()
            conn.close()
            
        except Exception as e:
            # 追踪失败不应该影响主流程
            print(f"   ⚠️ 追踪记录保存失败: {e}")
    
    def get_current_trace(self) -> Optional[LLMTrace]:
        """获取当前追踪"""
        return self._current_trace


# 估算 Token 数量的简单方法
def estimate_tokens(text: str) -> int:
    """
    估算文本的 Token 数量
    中英文混合场景的粗略估算：
    - 英文约 4 字符 = 1 token
    - 中文约 1.5 字符 = 1 token
    """
    if not text:
        return 0
    
    # 统计中文字符
    chinese_chars = sum(1 for c in text if '\u4e00' <= c <= '\u9fff')
    other_chars = len(text) - chinese_chars
    
    # 粗略估算
    chinese_tokens = chinese_chars / 1.5
    other_tokens = other_chars / 4
    
    return int(chinese_tokens + other_tokens)


# 全局追踪器实例
_tracker: Optional[LLMTracker] = None


def get_tracker() -> LLMTracker:
    """获取全局追踪器实例"""
    global _tracker
    if _tracker is None:
        _tracker = LLMTracker()
    return _tracker
