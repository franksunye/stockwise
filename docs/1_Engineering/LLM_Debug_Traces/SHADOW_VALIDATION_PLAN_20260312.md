# Phase 3 影子验证计划（2026-03-12）

## 1. 目标

在不替换生产默认模板、不写库的前提下，对同一份本地真实上下文同时运行：

- `legacy`
- `B2_PROD_SAFE`

并比较：

- parse 是否稳定
- raw / normalized signal 是否漂移
- token
- latency
- summary 风格

## 2. 验证对象

- `legacy`
  - 当前正式默认模板
- `B2_PROD_SAFE`
  - 当前生产代码中的并行 B2 变体

注意：

- 这一步不是验证 `B2_LAB`
- 而是验证 `B2_PROD_SAFE`

## 3. 工具

- [`shadow_compare_b2_prod_safe.py`](/Users/yesun/Code/stockwise/docs/7_Debug_Traces/scripts/shadow_compare_b2_prod_safe.py)

运行方式：

```bash
.venv/bin/python docs/7_Debug_Traces/scripts/shadow_compare_b2_prod_safe.py --symbol 300502 --date 2026-03-12 --cooldown-s 5
```

输出目录：

- `docs/7_Debug_Traces/results/shadow_runs/<run_id>/`

## 4. 当前验收标准

`B2_PROD_SAFE` 至少应满足：

- parse 成功
- normalized signal 不出现异常漂移
- tactics / key levels 仍可被正式 normalizer 吃下
- token 或结构清晰度具备可解释收益

## 5. 当前阶段结论边界

若影子验证通过，只能说明：

- `B2_PROD_SAFE` 具备进入小流量验证的资格

不能直接说明：

- `B2_LAB` 已经生产化完成
- `B2_PROD_SAFE` 一定优于 `legacy`
