# 量化与 AI 双层解耦重构执行方案 (Action Plan)

**文档状态**: Draft  
**日期**: 2026-03-06  
**作者**: Gemini  
**关联文档**: `27_DeepSeek_V3_Rich_Context_Limits.md`, `27_Acceptance_Criteria_v1.md`, `39_Tradeability_Dual_Lane_Operations.md`, [Spec 40 (UX)](../3_Product/Specs/40_Quant_AI_Dual_Layer_UX.md)

---

## 证据边界（计划口径）

- 本文是“执行方案”，不是“结果复盘”。
- 文中涉及的代码病灶（如 `validator.py` / `ai_service.py` / `runner.py`）属于可在仓库中直接核验的问题陈述。
- 文中涉及“收益提升”“命中率改善”等效果性判断，统一视为待验证假设；只有通过回测/线上指标后才可升级为事实结论。

---

## 0. 重构愿景

基于我们对 LLM 物理边界以及当前系统“观望陷阱 (Side Trap)”的深度反思，本路线图旨在将 StockWise 从一个**依赖单一庞大 LLM 兼顾计算与叙事**的脆弱系统，平滑迁移至工业界主流的**“量化雷达 (Layer 1) + AI 参谋 (Layer 2) 物理解耦架构”**。

这套手术方案将在确保历史数据评估不失真的前提下，分阶段、低风险地赋予系统“勇于捕捉右侧暴涨，并敢于冷血机械止损”的能力。

---

## Phase 0: 核心漏洞止血与评估基线修复（首要任务）

在增加任何新体系前，必须先铲除阻碍系统认知进化的历史 Bug。

*   **Action 0.1：修复 `validator.py` 的虚假高胜率漏洞**
    *   **位置**: `backend/engine/validator.py`
    *   **病灶**: 判定 `Side` (观望) 是否正确的逻辑缺失了绝对值保护；在当前实现中 `NOISE_THRESHOLD=1.0`（1%）时，暴跌也可能被误标为 `Correct`，污染反思闭环库。
    *   **处方**: 将逻辑更正为 `abs(cumulative_change) <= NOISE_THRESHOLD`。以此重构真实胜率。
*   **Action 0.2：解除过度防守的封印（熔断降级）**
    *   **位置**: `backend/engine/ai_service.py`
    *   **病灶**: 强制将置信度不足（如 < 0.75）的 `Long/Short` 压制回 `Side`。
    *   **处方**: 审查该门槛的必要性。在后续解耦完成前，需适当为放量突破的个股赋予“跳过降级”的白名单特权；或者在后处理中不再一刀切地抹杀 AI 的倾向性。

---

## Phase 1: 建立纯粹的量化雷达 (构建 Layer-1)

将“是否具有交易优势”（触发点）的审批权完全收归传统数字与统计学。

*   **Action 1.1：定义交易状态机 (State Machine)**
    在系统底层剥离模糊的 `Long/Side/Short`，拥抱极其精确的执行状态：
    1.  `NoSetup` (查无战机：趋势极度走坏或彻底死水)
    2.  `Watch` (重点盯防：随时可能爆仓或突破)
    3.  `TriggeredLong` (开火做多：触发战术买点)
    4.  `RiskOff` (防守清仓：触发无理由机械止损)
*   **Action 1.2：硬编码短线触发算子 (Trigger Algorithms)**
    用 Python 构建计算模块，直连 `daily_prices`：
    *   **进攻触发**：如 VCP (波动率收敛) 后的放量（示例：>1.5倍）突破 MA20。只要数字达标，立刻输出 `TriggeredLong`。
    *   **防守触发**：跌破前一交易日低点，或价格偏离（均线乖离率过大），立刻输出 `RiskOff`。
    *   **参数口径约束**：本文中的阈值仅作“研究示例参数”。生产参数以 `backend/strategy_config/tradeability_params_v1.json` 与 `39_Tradeability_Dual_Lane_Operations.md` 为唯一准。

---

## Phase 2: 降维与重塑 LLM 的权责 (构建 Layer-2)

将大模型（如 DeepSeek V3）从“被逼迫做二选一”的计算苦力，解放为“拥有丰富消息与大局观”的战术参谋长。

*   **Action 2.1：重构 `runner.py` (从“平行赛跑”到“流水线编排”)**
    *   **位置**: `backend/engine/runner.py`
    *   **病灶**: 当前代码中 `asyncio.gather(*tasks)` 让所有的模型（Rule, DeepSeek, 混元）在同一个起跑线上平行盲猜，导致量化的声音被高优先级的 LLM 压制。
    *   **处方**: 修改执行流。首先 `await quant_engine.detect(symbol)` 拿到 Layer-1 的红绿灯状态，然后将该状态封装进 `model_specific_data` 上下文中，再传递给后续的 LLMs。
*   **Action 2.2：外推决策指令至 Prompt (提示词外科手术)**
    *   **位置**: `backend/templates/prompts/` 相关的 `j2` 文件。
    *   **病灶**: 当前我们在 Prompt 最后还在问它“请告诉我综合方向是什么”。这会唤起安全对齐护栏。
    *   **处方**: 强硬地在 Prompt 开头注入 Layer-1 的结果：`[系统指令：当前股票量价已触发【强势多头突破/RiskOff 破位清仓】！]`。明确告诉大模型，**方向已经由数学决定，无需你负责任**。
*   **Action 2.3：重新规划大模型的核心产出 (Tactical Overlay)**
    *   **情感定性与归纳**：让 AI 阅读该股近期的海量新闻和基本面，回答“这个由电脑捕获的放量突破，背后有没有实质性的国策/基本面异动支撑？还是纯粹游资炒作？”
    *   **用户级战术简报生成**：让 AI 输出令人信服的操作文案，例如针对 `RiskOff` 信号：“虽然该股基本面依然优良，但量化警戒器显示资金存在崩跌式出逃，纪律高于一切，建议空仓者严禁介入，持仓者立即减半！”

---

## Phase 3: 投研终端界面的降维打击 (UI 升格)

将底层的分工，直观、清晰、有压迫感地传达给用户。

*   **Action 3.1：拆分雷达预警与 AI 建言**
    *   **位置**: `frontend/src/components/dashboard/AICouncil.tsx` / `TacticalBriefDrawer.tsx` 等。
    *   **前端保护约束（对齐 Spec 40）**: 改造仅限 UI/DOM 展示层；不得破坏现有 `SWR Map Cache` 与 `Zero UI Flash` 机制。
    *   **处方**:
        *   首屏最显眼的图标（如红绿信号灯/警笛）由 Layer-1 量化雷达直接接管，反应最冰冷的“当前可交易状态（如 `TriggeredLong`）”。
        *   下方展开的文字报告区，展示 Layer-2 也就是 DeepSeek V3 极富同理心和宏观大局观的战役复盘与防守建议。

---

## 执行建议 (Next Steps)

按照从后到前、从深到浅的原则，我们的手术刀应遵循以下顺序切入：
1.  **即刻执行**: 检修 `validator.py` 并对冲评估历史 Bug **(Phase 0)**。
2.  **基建筹备**: 拉取数据，先用伪代码验证量化触发逻辑的收益率是否真实存在 **(Phase 1)**。
3.  **核心剥离**: 修改 AI 推理链，强灌溉量化状态，观测其生成的战术文本质量改变 **(Phase 2)**。
4.  **门面翻新**: 最后升级 UI **(Phase 3)**。

---

## 执行进度同步（2026-03-06）

### A. 已完成（#1 止血）

- **Action 0.1 已完成**：`backend/engine/validator.py` 的 `Side` 判定更正为 `abs(cumulative_change) <= NOISE_THRESHOLD`。
- **Action 0.2 已完成（第一阶段）**：`backend/engine/ai_service.py` 去除硬编码强制降级，改为可配置风控模式：
  - `AI_CIRCUIT_MODE=warn`（默认，记录低置信度但不改信号）
  - `AI_CIRCUIT_MODE=force_side`（兼容旧行为）
  - `AI_CIRCUIT_MODE=off`（关闭该护栏）
- **测试补强**：新增 `backend/tests/test_ai_service_guardrail_modes.py`，覆盖 `warn/force_side/off` 三种模式。
- **代码合入状态**：提交 `ef89bd1` 已推送 `main`。

### B. 验证证据（研发口径：本地 SQLite）

- 单测通过：`python -m pytest backend/tests/test_ai_service_guardrail_modes.py backend/tests/test_ai_service_v2_storage.py -q`，结果 `4 passed`。
- 本地强制校验：`$env:DB_SOURCE='local'; python backend/main.py --verify --force`，结果 `Validation Complete: 495 predictions updated`。
- 近 10 天窗口复核：`signal='Side' AND validation_status='Correct' AND actual_change < -1.0` 结果为 `0`（本地库）。

### C. 当前风险与口径

- `verify_all_pending` 默认只覆盖近 10 天窗口；历史更早数据若需完全重算，应单独执行历史批处理方案。
- 生产库全量回写在一次性长连接下曾出现连接重置，建议按 `target_date` 分批触发 GitHub Actions `verify_predictions.yml`。

### D. 下一步（对齐战略/工程/Spec）

1. 推进 **Phase 1**：先落地 Layer-1 状态机与参数治理，不直接改 UI 主路径。
2. 推进 **Phase 2**：将 Runner 改为“先量化、后 AI”流水线，固定职责边界。
3. 推进 **Phase 3**：按 Spec 40 做展示层改造，保持 SWR 零闪烁约束不回归。
