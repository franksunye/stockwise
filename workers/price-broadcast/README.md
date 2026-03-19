## stockwise-price-broadcast-poc

Cloudflare Workers POC for `GET /api/stock/prices/all`.

- 独立于现有 Next.js / Vercel API，不改变当前生产流量拓扑。
- 仅用于验证 Workers 在价格广播场景下的 **性能 / 成本 / 工程复杂度**。

### 本地开发

1. 安装依赖：

   ```bash
   cd workers/price-broadcast
   pnpm install # 或 npm / yarn
   ```

2. 启动本地 Worker：

   ```bash
   pnpm dev
   # 然后访问 http://127.0.0.1:8787/api/stock/prices/all
   ```

2. 配置 Turso 连接（可选但推荐）：

   ```bash
   # 一次性在 Cloudflare 账户中为该 Worker 设置机密
   wrangler secret put TURSO_DB_URL
   wrangler secret put TURSO_AUTH_TOKEN
   ```

   这两个值应与当前 backend/frontend 使用的一致（`TURSO_DB_URL` / `TURSO_AUTH_TOKEN`）。

未配置 Turso 时，Worker 会返回静态示例数据，便于先完成端到端 POC 与观测；  
配置 Turso 后，会针对 `global_stock_pool` 中、`stock_meta.market = ?` 的股票，从 `daily_prices` 中抽取每只股票最新价格，构成全量价格广播响应。

### Vercel vs Worker 对比（需登录态）

`/api/stock/prices` 需要登录。对比脚本会从 `backend/.env`、`frontend/.env` 加载 `USER_SESSION_SECRET`，并从 `COMPARE_USER_ID` 或 Turso 查询获取一个 `user_id`，生成 session cookie 后请求 Vercel：

```bash
# 确保 frontend/.env 或 backend/.env 中有 USER_SESSION_SECRET
# 可选：COMPARE_USER_ID=xxx 指定用户，否则从 Turso 自动取第一个用户
pnpm exec tsc scripts/compare-with-vercel.ts --module commonjs --lib es2015,dom --outDir scripts
VERCEL_PRICES_URL="https://app.ziso.cc/api/stock/prices?symbols=00700,03690" \
WORKER_PRICES_ALL_URL="http://127.0.0.1:8787/api/stock/prices/all?market=hk" \
node scripts/compare-with-vercel.js
```

### 简单压测（本地或远程 URL）

> 仅用于 POC 对比，不对生产环境做长期压测。

1. 构建 TS：

   ```bash
   pnpm exec tsc scripts/bench.ts --module commonjs --outDir scripts
   ```

2. 设置目标 URL 与请求量（可针对本地 wrangler dev 或远程 Worker）：

   ```bash
   export BENCH_TARGET_URL="http://127.0.0.1:8787/api/stock/prices/all?market=hk"
   export BENCH_REQUESTS=200
   export BENCH_CONCURRENCY=20
   node scripts/bench.js
   ```

脚本会输出 total / success / failure 以及 p50/p90/p95/p99 和总 wall time，可直接贴入 `33_Cloudflare_Workers_Migration_POC_20260318.md` 的测量结果章节。 


