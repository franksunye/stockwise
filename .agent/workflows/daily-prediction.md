---
description: 每日全自动执行本地 AI 股票预测流程
---

// turbo-all

这是一个自动化工作流，用于执行每日的 PRO 用户股票 AI 预测。

1. **准备环境与代码更新**
   确保本地代码是最新的（可选，视情况而定）。
   `git pull`

2. **执行预测脚本**
   利用 `local-data-ops` 技能中的标准脚本执行预测。
   `C:\cygwin64\home\frank\StockWise\backend\scripts\run_prediction.ps1`

3. **结果验证**
   查询数据库，确认今日生成的数据量。
   `node frontend/scripts/turso-cli.mjs query "SELECT COUNT(*) as total FROM ai_predictions_v2 WHERE date = '$(Get-Date -Format 'yyyy-MM-dd')'"`

4. **完成通知**
   任务结束，请检查上述验证步骤的输出结果。
