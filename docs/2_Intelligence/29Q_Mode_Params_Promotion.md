# 模式参数本地回测直发专项

日期：2026-03-10

## 目标

三核心模式（`steady / balanced / aggressive`）的生产参数，不再强制等待线上连续数周观察后才允许上线。

改为：

1. 本地用历史数据回测，形成三模式最优参数发布产物。
2. 通过独立发布脚本将参数包写入生产配置文件。
3. 线上 experiment / sidecar / strategy_version promotion 继续运行，不受影响。

## 关键边界

1. 本专项只解决 `params_bundle` 的发布，不替代 `strategy_version` 的晋级治理。
2. `tradeability_v1 / tradeability_v2` 的 version promotion 仍走原有 acceptance / experiment / promotion gate。
3. 三模式参数包现在收口到：
   - `backend/strategy_config/mode_params_bundles_v1.json`

## 新发布链

本地研究产出一个 release artifact，最少包含：

```json
{
  "config_version": "mode_params_bundles_v1",
  "strategy_version": "tradeability_v2",
  "generated_at": "2026-03-10T00:00:00Z",
  "source": {
    "market": "CN",
    "method": "local_backtest",
    "artifact": "tmp/mode_backtest/best_release.json"
  },
  "bundles": {
    "steady": { "default": {} },
    "balanced": { "default": {} },
    "aggressive": { "default": {} },
    "observe_only": { "default": {} }
  }
}
```

执行：

```bash
./.venv/bin/python backend/scripts/build_mode_params_release.py \
  --manifest tmp/mode_backtest/candidate_manifest.json

./.venv/bin/python backend/scripts/promote_mode_params_release.py \
  --release-json tmp/mode_backtest/best_release.json \
  --execute \
  --actor ops:local-backtest-promotion
```

默认先 dry-run；加 `--execute` 才会真正写入。

## 运行影响

1. `backend/engine/layer1_state.py` 会优先读取 `mode_params_bundles_v1.json`。
2. 若配置缺失或损坏，系统回退到代码内置 bundle，避免生产中断。
3. 发布动作会写入 `promotion_audit_log`，事件类型为 `mode_params_release`。

## 推荐执行顺序

1. 本地补齐历史样本或生产模式绩效数据。
2. 准备三模式 candidate manifest，分别列出 `steady / balanced / aggressive` 的候选参数。
3. 运行 `build_mode_params_release.py`，生成 `best_release.json` 与 `best_release.md`。
4. 先 dry-run 审核 bundle 覆盖范围。
5. `--execute` 发布参数包。
6. 次日重跑 `run_mode_pipeline.py` 或对应生产流水线，确认模式绩效快照已反映新参数。
7. 保留线上实验继续观测，用于后续迭代，而不是阻塞这次参数上线。
