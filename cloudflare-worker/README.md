# StockWise Realtime Sync Scheduler

基于 Cloudflare Workers 的精准调度器，解决 GitHub Actions schedule 不准确的问题。

## 架构

```
Cloudflare Worker (Cron: */10 * * * *)
        ↓
检查是否在交易时段 (北京时间 09:10-16:10, 周一至周五)
        ↓
触发 GitHub Actions workflow_dispatch
        ↓
GitHub Actions 执行 Python ETL 脚本
```

## 部署步骤

### 1. 创建 GitHub Personal Access Token

1. 访问 [GitHub Token Settings](https://github.com/settings/tokens?type=beta)
2. 点击 **"Generate new token"** → **"Fine-grained token"**
3. 设置：
   - **Token name**: `stockwise-scheduler`
   - **Expiration**: 选择合适的过期时间（建议 90 天或更长）
   - **Repository access**: 选择 **"Only select repositories"** → 选择 `stockwise`
   - **Permissions**:
     - **Actions**: Read and Write ✅
4. 点击 **Generate token** 并复制 token（以 `github_pat_` 开头）

### 2. 安装 Wrangler CLI

```bash
npm install -g wrangler
```

### 3. 登录 Cloudflare

```bash
wrangler login
```

这会打开浏览器让你授权。

### 4. 部署 Worker

```bash
cd cloudflare-worker
wrangler deploy
```

### 5. 配置环境变量 (Secrets)

在 Cloudflare Dashboard 中设置 Secrets:

```bash
# 设置 GitHub Token (敏感信息，必须用 secret)
wrangler secret put GITHUB_TOKEN
# 粘贴你的 GitHub Fine-grained Token

# 设置其他环境变量
wrangler secret put GITHUB_OWNER
# 输入: franksunye

wrangler secret put GITHUB_REPO
# 输入: stockwise

wrangler secret put GITHUB_WORKFLOW
# 输入: data_sync_realtime.yml
```

或者在 [Cloudflare Dashboard](https://dash.cloudflare.com/) 中：
1. 进入 **Workers & Pages**
2. 选择 **stockwise-scheduler**
3. **Settings** → **Variables and Secrets**
4. 添加以下变量：

| 变量名            | 值                       | 类型       |
| ----------------- | ------------------------ | ---------- |
| `GITHUB_TOKEN`    | `github_pat_xxxx...`     | **Secret** |
| `GITHUB_OWNER`    | `franksunye`             | Variable   |
| `GITHUB_REPO`     | `stockwise`              | Variable   |
| `GITHUB_WORKFLOW` | `data_sync_realtime.yml` | Variable   |

### 6. 验证部署

访问 Worker URL 测试：

```bash
# 检查状态
curl https://stockwise-scheduler.<your-subdomain>.workers.dev/status

# 手动触发 (测试用)
curl https://stockwise-scheduler.<your-subdomain>.workers.dev/trigger
```

## 费用

**完全免费**！

- 免费计划：每日 100,000 次请求
- 你的用量：每日约 42 次请求（交易时段每 10 分钟 1 次）
- 使用率：< 0.05%

## 监控

在 Cloudflare Dashboard 中可以查看：
- 请求日志
- Cron 执行历史
- 错误信息

## 故障排查

**问题：Cron 没有执行**
- 检查 Cloudflare Dashboard 中的 Cron 日志
- 确保 Worker 已部署且 Cron Trigger 已启用

**问题：GitHub Actions 没有被触发**
- 检查 `GITHUB_TOKEN` 是否正确设置
- 确保 Token 有 Actions: Read and Write 权限
- 查看 Worker 日志中的错误信息

**问题：交易时段判断不准**
- Worker 使用 UTC 时间计算北京时间
- 检查日志中的 `Beijing time` 输出
