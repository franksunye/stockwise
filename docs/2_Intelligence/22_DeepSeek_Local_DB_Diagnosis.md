# DeepSeek 本地数据库诊断（2026-03-05）

> 定位：本文件为“事故诊断与证据归档”（一次性事实记录）。
> 后续长期策略与执行规范见：
> [23_LLM_Output_Stability_Playbook.md](/c:/cygwin64/home/frank/StockWise/docs/2_Intelligence/23_LLM_Output_Stability_Playbook.md)

## 范围与口径
- 数据源：`data/stockwise.db` 的 `llm_traces` 表。
- 目标模型：`deepseek-v3`（并与 `deepseek-aliyun` 做对比）。
- 检查时间：2026-03-05（Asia/Shanghai）。

## 核心结论
1. `deepseek-v3` 稳定性显著低于 `deepseek-aliyun`。  
2. 当前主要问题不是单一“啰嗦”，而是“长输出 + JSON 格式退化 + 部分截断 + 接口层错误”叠加。  
3. 2026-03-05 当天出现连续 `parse_failed`，集中在 `00700`。

## 关键数据
- `deepseek-v3`（229 条）：
  - `success`: 132（57.6%）
  - `parse_failed`: 43（18.8%）
  - `error`: 54（23.6%）
- `deepseek-aliyun`（324 条）：
  - `success`: 311（96.0%）
  - `parse_failed`: 10（3.1%）
  - `error`: 3（0.9%）

## 2026-03-05 现象（deepseek-v3）
- 当天 `parse_failed`：9 条（全部为 `00700`）。
- 失败样本特征（按样本观察）：
  - 弯引号/全角结构符号污染（如 U+201C/U+201D/U+FF0C）。
  - JS 对象格式退化（`key: value`）。
  - 中途截断（数组/对象未闭合，停止在字段中间）。

## 输出长度对比（平均 `response_raw`）
- `deepseek-v3`：约 3741 字符（success 样本）。
- `deepseek-aliyun`：约 1504 字符（success 样本）。

说明：`deepseek-v3` 输出更长，且在长输出时更容易出现结构退化或截断。

## error 类型（deepseek-v3）
- `HTTP 402 Insufficient Balance`（最多）
- `HTTP 401 Authentication Fails`
- `Read timed out / SSL EOF`
- `Invalid URL '/chat/completions'`（配置问题）

说明：`error` 中有一部分属于接口与配置层问题，不是提示词或解析器单点可解决。

## 对当前策略的支持
- “LLM 有返回但解析失败 -> 通知 ADMIN -> 不重试”是合理止损策略。
- 解析能力应走“通用漏斗”升级，不继续堆补丁式替换。
- 生产侧保持小步变更，优先稳定。
