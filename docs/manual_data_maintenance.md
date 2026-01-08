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

## 步骤 3: 每日简报生成验证 (本地调试模式)

如果您需要验证“每日简报生成”模块 (Tavily + Local LLM)，请确保已配置本地 LLM 环境。

### 前置条件 (.env)
```ini
# Tavily 搜索密钥 (必须)
TAVILY_API_KEY=tvly-xxxxxxxx

# 本地 LLM 配置 - Gemini SDK 模式 (推荐)
LLM_PROVIDER=gemini_local
GEMINI_LOCAL_BASE_URL=http://127.0.0.1:8045  # 注意: 不需要 /v1 后缀
GEMINI_LOCAL_MODEL=gemini-3-flash            # 本地对应模型名
LLM_API_KEY=sk-any-string                    # 本地通常不校验 Key
```

### 数据库模型配置 (重要)

如果使用 Gemini Local 模式进行 AI 预测，需要确保 `prediction_models` 表中的配置正确：

```sql
-- 查看当前配置
SELECT model_id, provider, config_json FROM prediction_models WHERE model_id = 'gemini-3-flash';

-- 正确的配置应该是:
-- provider = 'adapter-gemini-local'
-- config_json = '{"model":"gemini-3-flash","api_key_env":"LLM_API_KEY","base_url_env":"GEMINI_LOCAL_BASE_URL","max_tokens":8192}'

-- 如果配置错误，执行以下 SQL 修复:
UPDATE prediction_models 
SET provider = 'adapter-gemini-local',
    config_json = '{"model":"gemini-3-flash","api_key_env":"LLM_API_KEY","base_url_env":"GEMINI_LOCAL_BASE_URL","max_tokens":8192}' 
WHERE model_id = 'gemini-3-flash';
```

**常见配置错误**:
- `provider` 设置为 `adapter-openai` 而不是 `adapter-gemini-local`
- `config_json` 中 `model` 设置为 `gpt-3.5-turbo` 而不是 `gemini-3-flash`
- `config_json` 中 `base_url_env` 设置为 `LLM_BASE_URL` 而不是 `GEMINI_LOCAL_BASE_URL`

### 命令
该脚本支持两种模式：全量生成（生产模式）和单用户生成（调试模式）。

#### 1. 调试单个用户 (Phase 1 + Phase 2)
这将强制为指定用户生成 Phase 1 的股票分析和 Phase 2 的简报组装。
```powershell
python backend/engine/brief_generator.py --user "user_r8gscc58m"
```
*   **用途**: 快速验证 LLM 的中文输出和 Tavily 的新闻抓取是否正常。
*   **结果**: 检查控制台输出的日志，以及数据库 `stock_briefs` 和 `daily_briefs` 表。

#### 2. 全量运行 (模拟生产 CI 环境)
这会为数据库中的**所有活跃用户**生成简报。
```powershell
python backend/engine/brief_generator.py
```

#### 3. 仅测试推送 (不生成，仅广播)
如果您只想测试 `notifications.py` 能否正确读取数据库并发送 WebPush，可以使用：
```powershell
python backend/notifications.py --action push_daily
```


> **注意**: 本地运行时，请确保您的 VPN/代理允许访问 Tavily API，同时本地 LLM 服务 (8045端口) 处于运行状态。

### 关键配置：切换本地/线上数据库 (`DB_SOURCE`)

默认情况下，如果您在本地开发环境配置了 `.env` 并设置了 `DB_SOURCE=local`，上述命令只会修改 **本地 SQLite 数据库 (`data/stockwise.db`)**。

**如果您想在本地直接生成并写入 线上 Turso 数据库 (Production Data)：**

必须在运行命令时临时覆盖 `DB_SOURCE` 环境变量为 `cloud`。

#### PowerShell (Windows)
```powershell
# 单用户 + 线上数据库
$env:DB_SOURCE="cloud"; python backend/engine/brief_generator.py --user "user_kks6hezt3"

# 全量 + 线上数据库
$env:DB_SOURCE="cloud"; python backend/engine/brief_generator.py
```

#### 查询线上用户列表
如果您不知道线上有哪些用户，可以先查询：
```powershell
node frontend/scripts/turso-cli.mjs query "SELECT user_id, COUNT(symbol) as cnt FROM user_watchlist WHERE user_id LIKE 'user_%' GROUP BY user_id"
```

#### Bash (Linux/Mac)
```bash
DB_SOURCE=cloud python backend/engine/brief_generator.py
```

**验证方法**:
运行后，检查终端日志。
*   如果看到 `🔧 模式切换: 强制使用本地 SQLite` -> 正在操作 **本地库**。
*   如果看到 `Using Turso DB...` (或没有上述提示) -> 正在操作 **线上库**。
