import unittest
from unittest.mock import patch

from backend.scripts.send_admin_workflow_notification import (
    parse_metadata,
    send_admin_workflow_notification,
)


class TestWorkflowAdminNotification(unittest.TestCase):
    def test_parse_metadata_requires_key_value(self):
        with self.assertRaises(ValueError):
            parse_metadata(["invalid"])

    def test_failure_notification_mentions_admin_and_rerun(self):
        with patch(
            "backend.scripts.send_admin_workflow_notification.get_admin_mobiles",
            return_value=["13800000000"],
        ), patch(
            "backend.scripts.send_admin_workflow_notification.send_wecom_notification",
            return_value=True,
        ) as notify_mock:
            ok = send_admin_workflow_notification(
                task_name="Tradeability 夜间编排",
                status="failed",
                message="CN sidecar 失败",
                rerun_workflow="tradeability_postclose_pipeline.yml",
                metadata={"sample_sync_cn": "success", "sidecar_cn": "failure"},
            )

        self.assertTrue(ok)
        message = notify_mock.call_args.args[0]
        self.assertIn("后台任务失败", message)
        self.assertIn("Tradeability 夜间编排", message)
        self.assertIn("CN sidecar 失败", message)
        self.assertIn("重试入口", message)
        self.assertEqual(
            notify_mock.call_args.kwargs["mentioned_mobile_list"],
            ["13800000000"],
        )

    def test_success_notification_uses_chinese_metadata(self):
        with patch(
            "backend.scripts.send_admin_workflow_notification.send_wecom_notification",
            return_value=True,
        ) as notify_mock:
            ok = send_admin_workflow_notification(
                task_name="Tradeability 夜间编排",
                status="success",
                message="CN/HK 夜间研究链已完成",
                metadata={"sample_sync_cn": "success", "sidecar_hk": "success"},
            )

        self.assertTrue(ok)
        message = notify_mock.call_args.args[0]
        self.assertIn("后台任务成功", message)
        self.assertIn("CN 样本同步", message)
        self.assertIn("HK Sidecar", message)
        self.assertNotIn("mentioned_mobile_list", notify_mock.call_args.kwargs)

