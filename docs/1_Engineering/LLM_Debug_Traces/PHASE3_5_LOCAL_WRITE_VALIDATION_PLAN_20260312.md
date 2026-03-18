# Phase 3.5 本地写库链路验证方案（2026-03-12）

## 1. 目标

在进入真实线上写库验证之前，先完成一次**本地写库链路验证**。

这一步比本地主链路影子测试更进一步，因为它不仅看：

- LLM 返回
- parser
- normalizer

还看：

- 主链是否成功写入本地 `ai_predictions_v2`
- `prompt_version` 是否正确落库
- token / latency / reasoning 是否按预期保存

## 2. 为什么先做这一步

原因：

- 比直接上线上写库更稳妥
- 比纯影子测试更接近真实主链
- 能先排除“写库路径兼容性”问题

这一步的目标不是替代线上验证，而是：

- 作为 `Phase 4` 前的最后一道本地保护层

## 3. 执行范围

建议只做：

- 单标的
- 单模型
- 单日期
- 强制重跑

推荐案例：

- `300502 / 2026-03-12`

推荐模型：

- `gemini-3-flash`

推荐环境：

- `DB_SOURCE=local`
- `STOCK_ANALYSIS_PROMPT_VARIANT=b2`

## 4. 执行方式

核心思路：

- 使用当前正式主链命令
- 但写入本地 SQLite
- 跑完后直接 SQL 验证

## 5. 验证项

### 写入前

先确认本地已有记录状态：

- `model_id`
- `prompt_version`
- `signal`
- `confidence`

### 写入后

重点回查：

- 是否新增 / 覆盖了 `gemini-3-flash`
- `prompt_version` 是否为 `b2.v1`
- `signal` 是否合理
- `confidence` 是否正常
- `token_usage_input/output`
- `execution_time_ms`

## 6. 验收标准

若本地写库链路验证通过，至少应满足：

- 主链执行成功
- 本地 `ai_predictions_v2` 写入成功
- `prompt_version = b2.v1`
- 结果结构未异常
- token / latency 字段正常落库

## 7. 当前结论边界

这一步如果通过，只能说明：

- `B2_PROD_SAFE` 已通过本地写库链路验证

不能直接说明：

- 已经可以默认切生产
- 线上真实写库一定无风险
