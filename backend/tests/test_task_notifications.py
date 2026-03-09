import unittest
from unittest.mock import patch

from backend.engine.task_logger import TaskLogger
from backend.job_guard import JobGuard


class TestTaskNotifications(unittest.TestCase):
    def test_task_logger_success_uses_chinese_admin_message(self):
        logger = TaskLogger(agent_id="system_guardian", task_name="每日简报推送")

        with patch.object(logger, "_log") as log_mock, \
             patch("backend.utils.send_wecom_notification") as notify_mock:
            logger.success(
                message="简报已完成推送",
                metadata={"delivered_users": 18},
                notify=True,
            )

        log_mock.assert_called_once()
        notify_mock.assert_called_once()
        message = notify_mock.call_args.args[0]
        self.assertIn("后台任务成功", message)
        self.assertIn("**任务**: 每日简报推送", message)
        self.assertIn("**已送达用户**: 18", message)
        self.assertIn("**说明**: 简报已完成推送", message)

    def test_task_logger_failure_mentions_admins_and_rerun_link(self):
        logger = TaskLogger(agent_id="system_guardian", task_name="预测验证")

        with patch.object(logger, "_log") as log_mock, \
             patch("backend.engine.task_logger.get_admin_mobiles", return_value=["13800000000"]), \
             patch("backend.utils.send_wecom_notification") as notify_mock:
            logger.fail(
                message="验证数据缺失",
                metadata={"market": "CN"},
                notify=True,
                channel_alert=True,
                rerun_workflow="verify_predictions.yml",
            )

        log_mock.assert_called_once()
        notify_mock.assert_called_once()
        message = notify_mock.call_args.args[0]
        self.assertIn("后台任务失败", message)
        self.assertIn("验证数据缺失", message)
        self.assertIn("**市场**: CN", message)
        self.assertIn("重试入口", message)
        self.assertIn("预测验证", message)
        self.assertEqual(
            notify_mock.call_args.kwargs["mentioned_mobile_list"],
            ["13800000000"],
        )

    def test_job_guard_failure_notifies_admin_with_rerun_link(self):
        guard = JobGuard(
            task_name="A股盘后同步",
            notify_on_success=False,
            notify_on_fail=True,
            channel_alert=True,
            rerun_workflow="data_sync_cn.yml",
        )
        guard.start_time = 0.0
        guard.log_id = 1
        guard.set_stats(success=False, failed_count=2, error="上游超时")

        with patch.object(guard, "_log_db") as log_mock, \
             patch("backend.job_guard.time.time", return_value=12.3), \
             patch("backend.job_guard.get_admin_mobiles", return_value=["13800000000"]), \
             patch("backend.job_guard.send_wecom_notification") as notify_mock:
            guard.__exit__(None, None, None)

        log_mock.assert_called_once()
        message = notify_mock.call_args.args[0]
        self.assertIn("后台任务失败", message)
        self.assertIn("上游超时", message)
        self.assertIn("**失败数量**: 2", message)
        self.assertIn("重试入口", message)
        self.assertIn("A股盘后同步", message)
        self.assertEqual(
            notify_mock.call_args.kwargs["mentioned_mobile_list"],
            ["13800000000"],
        )

