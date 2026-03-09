import time
import json
import traceback
import os
import uuid
from datetime import datetime
from typing import Dict, Any, Optional

from backend.logger import logger
from backend.database import get_connection
from backend.utils import send_wecom_notification
from backend.config import BEIJING_TZ
try:
    from backend.admin_notifications import (
        build_failure_message,
        build_success_message,
        get_admin_mobiles,
    )
except ImportError:
    from admin_notifications import (
        build_failure_message,
        build_success_message,
        get_admin_mobiles,
    )

class JobGuard:
    """
    工业级作业守卫 (Enterprise Job Execution Guard)
    
    职责：
    1. 任务生命周期管理 (Start -> Success/Fail)。
    2. 数据库任务日志持久化 (与 TaskLogger Schema 完全对齐)。
    3. 异常自动上报与企微报警，支持 @管理员。
    4. 运维操作联动 (Rerun Links)。
    """
    
    def __init__(self, 
                 task_name: str, 
                 agent_id: str = "system_scheduler",
                 task_type: str = "maintenance",
                 triggered_by: str = "scheduler",
                 notify_on_success: bool = True, 
                 notify_on_fail: bool = True,
                 channel_alert: bool = True,
                 rerun_workflow: str = None):
        
        self.task_name = task_name
        self.agent_id = agent_id
        self.task_type = task_type
        self.triggered_by = triggered_by
        
        self.notify_on_success = notify_on_success
        self.notify_on_fail = notify_on_fail
        self.channel_alert = channel_alert
        self.rerun_workflow = rerun_workflow
        
        self.start_time = None
        self.stats: Dict[str, Any] = {}
        self.dimensions: Dict[str, Any] = {}
        self.log_id = None
        self.date_str = datetime.now(BEIJING_TZ).strftime("%Y-%m-%d")
        self.pipeline_run_id = os.environ.get("PIPELINE_RUN_ID") or f"job-{self.date_str}-{uuid.uuid4().hex[:8]}"

    def __enter__(self):
        """任务开始"""
        self.start_time = time.time()
        now_str = datetime.now(BEIJING_TZ).strftime("%Y-%m-%d %H:%M:%S")
        os.environ["PIPELINE_RUN_ID"] = self.pipeline_run_id
        
        logger.info(f"🛡️ [JobGuard] Task Started: {self.task_name} (Type: {self.task_type})")
        
        # 1. 初始记录: status=running
        self._log_db(status="running", message=f"Task {self.task_name} initialized")
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """任务结束"""
        duration = time.time() - self.start_time
        
        if exc_type:
            # 🚨 异常检测
            error_msg = str(exc_val)
            stack_trace = "".join(traceback.format_tb(exc_tb))
            logger.error(f"❌ [JobGuard] Task FAILED: {error_msg}\n{stack_trace}")
            
            # DB 记录失败
            self._log_db(status="failed", message=error_msg, metadata={"stack_trace": stack_trace, "error": error_msg})
            
            # 发送失败报警
            if self.notify_on_fail:
                self._send_fail_notification(error_msg, duration)
            return False # 继续抛出异常
            
        else:
            # ✅ 正常结束
            # 检查业务逻辑认为的成功 (如果 stats['success'] == False)
            if self.stats.get("success") is False:
                error = self.stats.get("error", "Business logic failure")
                self._log_db(status="failed", message=error, metadata=self.stats)
                if self.notify_on_fail:
                    self._send_fail_notification(error, duration)
            else:
                logger.info(f"✅ [JobGuard] Task Success: {self.task_name}. Duration: {duration:.1f}s")
                self._log_db(status="success", message="Completed successfully", metadata=self.stats)
                if self.notify_on_success:
                    self._send_success_notification(duration)
            return True

    def set_stats(self, **kwargs):
        """汇报业务指标"""
        self.stats.update(kwargs)

    def set_dimensions(self, **kwargs):
        """增加分类维度 (e.g., market='HK')"""
        self.dimensions.update(kwargs)

    def get_pipeline_run_id(self) -> str:
        return self.pipeline_run_id

    def _log_db(self, status: str, message: str = None, metadata: dict = None):
        """向 task_logs 表写入数据 (对齐 TaskLogger 标准)"""
        try:
            conn = get_connection()
            cursor = conn.cursor()
            
            now_str = datetime.now(BEIJING_TZ).strftime("%Y-%m-%d %H:%M:%S")
            dim_payload = dict(self.dimensions) if self.dimensions else {}
            dim_payload.setdefault("pipeline_run_id", self.pipeline_run_id)
            dim_json = json.dumps(dim_payload, ensure_ascii=False)
            meta_payload = dict(metadata) if metadata else {}
            meta_payload["trace_envelope"] = {
                "pipeline_run_id": self.pipeline_run_id,
                "component": "backend.job_guard",
                "task_name": self.task_name,
                "status": status,
            }
            meta_json = json.dumps(meta_payload, ensure_ascii=False)
            
            if status == "running":
                cursor.execute("""
                    INSERT INTO task_logs 
                    (agent_id, task_name, display_name, task_type, date, status, triggered_by, start_time, dimensions, message)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    self.agent_id, self.task_name, self.task_name, self.task_type, self.date_str, 
                    status, self.triggered_by, now_str, dim_json, message
                ))
                self.log_id = cursor.lastrowid
            elif self.log_id:
                cursor.execute("""
                    UPDATE task_logs 
                    SET status = ?, end_time = ?, message = ?, metadata = ?, updated_at = datetime('now', '+8 hours')
                    WHERE id = ?
                """, (status, now_str, message, meta_json, self.log_id))
            
            conn.commit()
            conn.close()
        except Exception as e:
            logger.error(f"⚠️ [JobGuard] DB Validation Log Failed: {e}")

    def _send_success_notification(self, duration: float):
        """成功通知"""
        metadata = {k: v for k, v in self.stats.items() if k != "success"}
        send_wecom_notification(
            build_success_message(
                task_name=self.task_name,
                duration=duration,
                metadata=metadata,
            )
        )

    def _send_fail_notification(self, error_msg: str, duration: float):
        """失败提醒 (带精准 @ 和 运维链接)"""
        metadata = {k: v for k, v in self.stats.items() if k != "success"}
        mentioned_list = []
        if self.channel_alert:
            admin_mobiles = get_admin_mobiles()
            if admin_mobiles:
                mentioned_list.extend(admin_mobiles)
            else:
                mentioned_list.append("@all")

        send_wecom_notification(
            build_failure_message(
                task_name=self.task_name,
                error_message=error_msg,
                duration=duration,
                metadata=metadata,
                rerun_workflow=self.rerun_workflow,
            ),
            mentioned_mobile_list=mentioned_list if mentioned_list else None,
        )
