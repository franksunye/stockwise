import unittest

from backend.admin_notifications import build_failure_message, build_success_message


class TestAdminNotifications(unittest.TestCase):
    def test_build_failure_message_uses_chinese_labels_and_rerun_link(self):
        message = build_failure_message(
            task_name="A股盘后同步",
            error_message="上游接口超时",
            duration=12.3,
            metadata={"market": "CN"},
            rerun_workflow="data_sync_cn.yml",
        )

        self.assertIn("后台任务失败", message)
        self.assertIn("**任务**: A股盘后同步", message)
        self.assertIn("上游接口超时", message)
        self.assertIn("重试入口", message)
        self.assertIn("data_sync_cn.yml", message)

    def test_build_success_message_uses_chinese_labels(self):
        message = build_success_message(
            task_name="早盘计划提醒",
            duration=5.0,
            metadata={"delivered_users": 18},
        )

        self.assertIn("后台任务成功", message)
        self.assertIn("**任务**: 早盘计划提醒", message)
        self.assertIn("**耗时**: 5.0s", message)
        self.assertIn("Delivered Users", message)


if __name__ == "__main__":
    unittest.main()
