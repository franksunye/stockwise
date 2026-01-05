# StockWise 手动数据运维指南

本文档记录了如何在本地手动补充或更新 AI 预测数据，用于日常运维和数据修复。

## 场景描述

当我们需要为特定用户群体（如 PRO 用户）或特定股票列表强制刷新 AI 预测数据时，可以使用本地脚本进行批量处理。这通常发生在新模型上线、数据修复或例行巡检之后。

## 前置准备

确保你已经配置好了本地开发环境：
1.  Python 虚拟环境已激活。
2.  `.env` 文件配置正确，包含有效的数据库连接串 (`TURSO_DATABASE_URL`) 和 LLM API Key。
3.  PowerShell (Windows) 或 Bash (Linux/Mac) 终端。

## 步骤 1: 确定目标股票列表

首先，你需要从数据库中提取需要更新的股票代码。

### 示例：获取所有 PRO 用户关注的股票

使用 `turso-cli`工具查询：

```powershell
# 在项目根目录下执行
node frontend/scripts/turso-cli.mjs query "SELECT DISTINCT w.symbol FROM user_watchlist w JOIN users u ON w.user_id = u.user_id WHERE u.subscription_tier = 'pro'" --raw
```

*注意：`--raw` 标志（如果工具支持）或手动从 JSON 输出中提取 `symbol` 列表。*

假设你得到的列表是：`['000547', '00700', '600519']`。

## 步骤 2: 批量执行 AI 分析

使用 `backend/main.py` 的 `--analyze` 和 `--force` 参数来强制生成新的预测记录。

### 关键参数说明
*   `--analyze`: 仅执行 AI 分析预测模块，不进行全量数据同步。
*   `--symbol <代码>`: 指定单只股票。
*   `--force`: **重要**。忽略"今日已分析"的检查，强制重新生成数据。不加此参数时，如果当日已有记录，程序会跳过。

### PowerShell 脚本（推荐）

为了防止并发过高导致数据库连接拒绝（`Cannot connect to host ...`），**强烈建议**在循环中加入 `Start-Sleep` 进行速率限制。

```powershell
# 定义股票列表
$symbols = @('000547', '00700', '600519', '02171')

# 批量执行
foreach ($s in $symbols) { 
    Write-Host "正在分析 $s ..." -ForegroundColor Cyan
    
    # 执行分析命令
    python backend/main.py --analyze --symbol $s --force
    
    # 冷却时间 (Cool Down) - 防止 Turso/SQLite 连接过载
    Write-Host "冷却 5 秒..." -ForegroundColor DarkGray
    Start-Sleep -Seconds 5 
}
```

### Bash 脚本

```bash
symbols=("000547" "00700" "600519")

for s in "${symbols[@]}"; do
    echo "正在分析 $s ..."
    python backend/main.py --analyze --symbol $s --force
    echo "冷却 5 秒..."
    sleep 5
done
```

## 常见问题处理

### 1. 数据库连接错误 (`Cannot connect to host ... turso.io`)
**原因**：并发请求过多，导致 Turso 的 HTTP 连接池耗尽或被限流。
**解决**：增加 `Start-Sleep` 的时间（例如从 5秒增加到 10秒），或者减小批量处理的大小。

### 2. 模型调用失败
检查 `.env` 中的 `LLM_BASE_URL` 和 `LLM_API_KEY` 是否有效。如果使用本地 LLM Proxy，确保 Proxy 服务正在运行。

### 3. "AI 分析完成! 成功: 0/1"
如果是 0/1 且没有明显报错，通常是因为没有加 `--force` 参数，且数据库中已经存在今日的预测记录。加上 `--force` 即可。
