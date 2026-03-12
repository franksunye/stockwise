# 生产晋升建议（2026-03-12）

## 1. 结论先行

基于当前目录内的单案例实验、复跑审计、线上真相核对和修复后全量基线结果，**当前最适合作为生产晋升候选的版本是 `B2_RICH_TABLES` 路线**。

对应 prompt 资产：

- System: [`prompts/Shared_Optimized_System.md`](/Users/yesun/Code/stockwise/docs/7_Debug_Traces/prompts/Shared_Optimized_System.md)
- User: [`prompts/B2_Rich_User.md`](/Users/yesun/Code/stockwise/docs/7_Debug_Traces/prompts/B2_Rich_User.md)

这是当前专项的正式实验结论。

## 2. 为什么是 `B2`

### 2.1 它是当前“质量优先”路线里最均衡的版本

和其他路线相比：

- 比 `baseline_old` 更轻，明显降低 prompt 冗余
- 比 `B1` 信息更完整，更适合保留多周期上下文
- 比 `B3` 更稳，历史结构脆弱性更低
- 比 `B4_NEW / B4_STRICT` 更接近当前生产解析链和三态主链

因此，`B2` 的优势不是“最省”或“最新”，而是：

- **最均衡**
- **最容易迁回主链**
- **当前工程风险最低**

### 2.2 它已经通过当前单案例基线

当前最新单案例全量复跑结果：

- [`results/eval_runs/20260312_214935/summary.json`](/Users/yesun/Code/stockwise/docs/7_Debug_Traces/results/eval_runs/20260312_214935/summary.json)

基线状态说明：

- [`CURRENT_BASELINE_STATUS_20260312.md`](/Users/yesun/Code/stockwise/docs/7_Debug_Traces/CURRENT_BASELINE_STATUS_20260312.md)

在这轮修复后基线里：

- `parse_success_rate = 1.0`
- `assertion_pass_rate = 1.0`

而 `B2` 所在路线本身没有暴露新的结构性问题。

### 2.3 它和当前生产目标更一致

当前生产目标不是做“最激进的新语义试验”，而是：

- 降低旧 prompt 冗余
- 提高结构稳定性
- 保留交易判断的完整性
- 尽量少改动现有主链

`B2` 最符合这个目标。

## 3. 其他版本的定位

### 3.1 `B1_MINIMAL_FEATURES`

定位：

- 成本优先候选

优点：

- token 更低
- latency 更低

缺点：

- 输入信息密度更低
- 更适合作为“降本分支”，不适合作为当前默认生产晋升结论

建议：

- 保留
- 作为后续成本优化备选路线

### 3.2 `B3_LOGIC_DISTILLED`

定位：

- 蒸馏研究路线

优点：

- 有研究价值
- narrative distillation 方向值得继续探索

缺点：

- 历史上结构最脆弱
- 这轮虽已修复，但可信度仍不如 `B2`

建议：

- 暂不晋升生产
- 保留为研究态 prompt

### 3.3 `B4_NEW_4_STATES` / `B4_STRICT_4_STATES`

定位：

- 语义升级研究路线

优点：

- 四状态语义更贴近产品动作语言
- `RiskOff` 表达比 `Side` 更直接

缺点：

- 当前主链 normalizer 仍偏 legacy 三态
- 四状态收益已证明主要是语义收益，不是确定的成本收益
- 若直接晋升，会牵动解析链、枚举、前后端契约

建议：

- 暂不作为当前默认生产替换方案
- 作为下一阶段“产品语义升级”专项处理

## 4. 建议晋升的不是“整个实验目录”，而是这 3 类改动

### 4.1 先晋升 `B2` 的 prompt 结构思想

建议迁回正式模板的内容：

- 静态 schema 约束从 user prompt 尽量上移到 system prompt
- user prompt 聚焦当次数据，不再承担大段固定契约文本
- 保留清晰的绝对锚点与 Layer-1 风险约束

目标文件：

- [`backend/templates/prompts/stock_analysis_system.j2`](/Users/yesun/Code/stockwise/backend/templates/prompts/stock_analysis_system.j2)
- [`backend/templates/prompts/stock_analysis_user.j2`](/Users/yesun/Code/stockwise/backend/templates/prompts/stock_analysis_user.j2)
- [`backend/engine/prompts.py`](/Users/yesun/Code/stockwise/backend/engine/prompts.py)

### 4.2 同步修掉当前主链里已知的逻辑问题

建议一并处理：

- `as_of_date` 曾误触发“请假装今天是”的回填式语义
- Layer-1 四状态在 prompt 入口被压扁成 legacy 三态

原因：

- 这两个问题会直接削弱实验结论向生产迁移的价值

### 4.3 暂时不要把四状态主链化

当前不建议直接把 `RiskOff / Wait / ...` 全量升为生产默认枚举。

原因：

- 需要先改 normalizer
- 需要核对前端、数据库、下游消费方是否接受新枚举
- 这已经不是 prompt 微调，而是产品契约升级

## 5. 推荐的实施顺序

### Phase 1

将 `B2` 的结构思想迁回生产 prompt 模板，但仍保持 legacy 三态输出。

目标：

- 先吃到 prompt 减重和结构优化收益
- 不扩大下游改动面

### Phase 2

修正式主链中的：

- `as_of_date` 逻辑
- Layer-1 信号压缩问题

目标：

- 让生产链与实验结论一致

### Phase 3

如果前两步稳定，再单独开启四状态升级评估。

目标：

- 把四状态从“prompt 研究”升级为“产品语义升级”

## 6. 一句话结论

**当前实验的正式结论是：`B2_RICH_TABLES` 是最好的生产晋升候选；`B1` 是降本备选；`B4` 是下一阶段语义升级候选；`B3` 保持研究态。**
