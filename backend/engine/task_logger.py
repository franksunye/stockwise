import json
from datetime import datetime
from backend.database import get_connection
from backend.logger import logger
from backend.engine.task_registry import AGENTS

class TaskLogger:
    def __init__(self, 
                 agent_id: str, 
                 task_name: str, 
                 date: str = None, 
                 triggered_by: str = 'system'):
        """
        Initialize a logger for a specific task.
        """
        if agent_id not in AGENTS:
             logger.warning(f"⚠️ Unknown Agent ID: {agent_id}, defaulting to system_guardian")
             agent_id = "system_guardian"
             
        self.agent_id = agent_id
        self.task_name = task_name
        self.triggered_by = triggered_by
        
        if date:
            self.date = date
        else:
            self.date = datetime.now().strftime("%Y-%m-%d")

    def start(self, display_name: str, task_type: str, dimensions: dict = None, message: str = None, metadata: dict = None):
        """Log task start."""
        self._log(
            status="running", 
            display_name=display_name, 
            task_type=task_type,
            dimensions=dimensions,
            message=message, 
            metadata=metadata, 
            start=True
        )

    def success(self, message: str = None, metadata: dict = None):
        """Log task success."""
        self._log(status="success", message=message, metadata=metadata, end=True)

    def fail(self, message: str = None, metadata: dict = None):
        """Log task failure."""
        self._log(status="failed", message=message, metadata=metadata, end=True)

    def _log(self, status: str, display_name: str = None, task_type: str = None, dimensions: dict = None, 
             message: str = None, metadata: dict = None, start: bool = False, end: bool = False):
        try:
            conn = get_connection()
            cursor = conn.cursor()
            
            now = datetime.now()
            
            # Check if entry exists for this task/date/agent
            # Note: We technically allow multiple runs of same task_name if repeated, 
            # but for 'daily plan' logic usually we update the latest one.
            # However, for activity log, we might want discrete entries if re-run?
            # Let's stick to "Update if Pending/Running, Insert if New or Finished?"
            # For simplicity: Update the *latest* entry if it matches task_name and date.
            
            cursor.execute(
                """SELECT id, status FROM task_logs 
                   WHERE task_name = ? AND date = ? AND agent_id = ? 
                   ORDER BY id DESC LIMIT 1""",
                (self.task_name, self.date, self.agent_id)
            )
            row = cursor.fetchone()
            
            meta_json = json.dumps(metadata) if metadata else None
            dim_json = json.dumps(dimensions) if dimensions else None
            
            if row and (row[1] == 'pending' or row[1] == 'running'):
                # Update existing active entry
                log_id = row[0]
                update_fields = ["status = ?", "updated_at = datetime('now', '+8 hours')"]
                params = [status]
                
                if message:
                    update_fields.append("message = ?")
                    params.append(message)
                
                if start:
                    update_fields.append("start_time = ?")
                    params.append(now)
                    # If starting, we might want to update display_name/type/dims if provided
                    if display_name:
                        update_fields.append("display_name = ?")
                        params.append(display_name)
                    if task_type:
                        update_fields.append("task_type = ?")
                        params.append(task_type)
                    if dim_json:
                        update_fields.append("dimensions = ?")
                        params.append(dim_json)
                
                if end:
                    update_fields.append("end_time = ?")
                    params.append(now)
                    
                if meta_json:
                    update_fields.append("metadata = ?")
                    params.append(meta_json)
                
                params.append(log_id)
                
                sql = f"UPDATE task_logs SET {', '.join(update_fields)} WHERE id = ?"
                cursor.execute(sql, params)
            else:
                # Insert new entry (if not exists or if previous was already finished and we are restarting)
                # But wait, 'start' method implies a new run.
                if not start and not row:
                     # Trying to update a non-existent task? Insert it as finished/failed?
                     # Let's simple INSERT if we are starting.
                     pass
                
                if start or not row:
                    cursor.execute("""
                        INSERT INTO task_logs 
                        (agent_id, task_name, display_name, task_type, date, 
                         status, triggered_by, start_time, end_time, 
                         dimensions, message, metadata)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        self.agent_id, self.task_name, display_name or self.task_name, task_type or 'unknown', self.date,
                        status, self.triggered_by, 
                        now if start else None, 
                        now if end else None, 
                        dim_json, message, meta_json
                    ))
            
            conn.commit()
            conn.close()
            logger.info(f"[{self.agent_id}] {status.upper()} {self.task_name}: {message or ''}")
            
        except Exception as e:
            logger.error(f"❌ Failed to write task log: {e}")

# Factory / Helper
def get_task_logger(agent_id: str, task_name: str, triggered_by: str = 'system'):
    return TaskLogger(agent_id, task_name, triggered_by=triggered_by)
