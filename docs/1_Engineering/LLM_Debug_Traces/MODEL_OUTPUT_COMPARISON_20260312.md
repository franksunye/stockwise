# 同案例模型结果对照（2026-03-12）

## 1. 对照对象

- 标的：`300502`
- 日期：`2026-03-12`
- 模板：`B2_PROD_SAFE` (`prompt_version = b2.v1`)
- 环境：本地主链路、本地 SQLite、真实写库验证

## 2. 核心结果对照

| 维度 | `deepseek-v3` | `gemini-3-flash` | 观察 |
|---|---|---|---|
| `signal` | `Side` | `Side` | 两边主信号一致 |
| `confidence` | `0.4` | `0.85` | Gemini 明显更高，DeepSeek 更克制 |
| `prompt_version` | `b2.v1` | `b2.v1` | 模板一致 |
| `execution_time_ms` | `46379` | `26529` | Gemini 更快 |
| `token_usage_input` | `3427` | `4547` | DeepSeek 输入 token 更低 |
| `token_usage_output` | `929` | `1399` | DeepSeek 输出更短 |
| `is_primary` | `1` | `0` | 本地写库状态，不代表线上切换 |

## 3. 摘要与风格对照

| 维度 | `deepseek-v3` | `gemini-3-flash` |
|---|---|---|
| `summary` | 股价放量跌破关键均线，主力大幅流出，短期趋势转弱。量化状态为RiskOff，应优先防守，等待企稳信号。 | 跌破MA20关键支撑，指标共振走弱，受限RiskOff约束，建议持币防御，关注375支撑。 |
| `counter_argument` | 股价处于中期机会位（18%），短期均线仍呈多头排列，且ATR显示波动较大，存在超跌反弹可能。 | 长期趋势仍处于牛市，若股价在366.11筹码锚点获得强力支撑，可能形成超跌反弹。 |
| `tomorrow_focus` | 关注375.67支撑有效性及能否收复381.14（MA20）。 | 375.67支撑有效性及MA20(381.14)反抽压力。 |

## 4. 推理链对照

| 维度 | `deepseek-v3` | `gemini-3-flash` |
|---|---|---|
| `trend` | 短期上升趋势破坏，进入调整。 | 短期趋势转弱 |
| `momentum` | 动量指标与资金流向均偏空。 | 下行压力加大 |
| `levels` | 价格处于关键支撑位边缘，方向待定。 | 支撑重心下移 |
| `context` | 市场环境与系统约束均不支持进攻。 | 环境不支持进攻 |
| `decision` | 选择观望，等待更明确的企稳或突破信号。 | 执行防御策略 |

## 5. 战术动作对照

| 维度 | `deepseek-v3` | `gemini-3-flash` | 观察 |
|---|---|---|---|
| `holding_profit[0].action` | `持仓观察` | `减仓` | Gemini 更主动，DeepSeek 更克制 |
| `holding_profit[0].trigger` | `不跌破一防位` | `股价反弹至381.14附近无法放量突破` | Gemini 触发条件更具体 |
| `empty[0].action` | `等待观察` | `观望` | 两边均为防守型空仓动作 |
| `empty[0].trigger` | `价格收盘重新站上MA20（381.14）且成交量温和放大` | `股价在375.67至381.14区间窄幅震荡` | DeepSeek 更像右侧确认，Gemini 更像区间等待 |
| tactics 数量 | `2 / 2 / 2` | `2 / 2 / 2` | 结构完整度一致 |

## 6. 当前判断

| 结论项 | 判断 |
|---|---|
| 解析链兼容性 | 两边都通过 |
| 风险语义保真 | 两边都保留了 `RiskOff` 防守约束 |
| 风格 | DeepSeek 更保守，Gemini 更执行导向 |
| 成本/速度 | Gemini 更快；DeepSeek 更短、更省输出 token |
| 交易口吻贴近度 | DeepSeek 更接近线上既有“克制型 Side”风格 |

## 7. 推荐表述

当前更严谨的结论应写为：

- `B2_PROD_SAFE` 在 `deepseek-v3` 与 `gemini-3-flash` 上都能跑通正式解析链。
- 同一模板下，DeepSeek 倾向输出更克制、更保守的 `Side`；Gemini 倾向输出更明确、更高置信度的防御动作。
- 若目标是贴近当前线上 DeepSeek 风格，`DeepSeek + B2_PROD_SAFE` 的表现更自然。
