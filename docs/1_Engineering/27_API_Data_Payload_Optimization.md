# 27. API Data Payload Optimization

**Status**: Draft / Recommended Revision

## 1. 目标

本方案的目标不是“把所有 API 都瘦到最小”，而是：

- 减少明确存在的 over-fetch
- 降低不必要的 JSON 体积与 DB -> Vercel -> Client 的传输成本
- 不破坏当前 Dashboard、AICouncil、SilentPoster、Onboarding 等核心体验
- 优先处理低风险、高收益、容易验证的字段裁剪

---

## 2. 现状判断

### 2.1 确实存在的 over-fetch

当前系统里确实有一部分 payload 偏大，主要集中在以下几类：

#### A. `layer1_payload`

`layer1_payload` 往往包含完整策略上下文，但当前前端主消费场景里，最明确依赖的是：

- `close`
- `change_percent`

因此，这部分有较明显的压缩空间。

#### B. `api/stock?history=...` 仍使用 `SELECT *`

历史价格接口当前直接读取 `daily_prices` 全字段。在仅用于历史行情展示时，不一定需要所有技术指标与附加字段。

#### C. 部分 Prediction/History 接口携带了较多技术指标列

例如：

- `rsi`
- `macd`
- `kdj`
- `boll_*`

这些字段在某些视图里是有价值的，但并非所有调用场景都必须携带。

### 2.2 不应误判为“可以直接裁掉”的字段

#### A. `ai_reasoning` 当前不是纯冗余字段

`ai_reasoning` 并不只是列表摘要文本。当前系统中，它被多个核心功能直接消费：

- Dashboard 卡片即时展示 summary / tactics
- AICouncil 分析摘要
- SilentPoster 海报文案与视觉故事
- Onboarding 首屏 reveal 文案

也就是说，`ai_reasoning` 当前仍然承担“即时详情数据源”的职责，而不只是一个可以替换成 summary-only 的大字段。

**结论：本轮不应对 `ai_reasoning` 做主体裁剪。**

#### B. `batch` 已经不是最严重的共享负载源

在最近一轮 CPU 优化后：

- public 页面已经大面积静态化
- almanac 已迁出到 shared API
- batch 已经不再承担 Almanac 负载

因此，本轮 payload 优化应更精确，而不是继续假设 `batch` 仍然承载大量最容易砍掉的共享数据。

---

## 3. 本轮推荐策略

本轮采用 **有限瘦身（Targeted Payload Trimming）**，而不是激进重构。

### 3.1 优先做的内容

| 项目 | 建议 | 风险 | 备注 |
| :--- | :--- | :--- | :--- |
| `layer1_payload` | 裁剪为最小必要子集 | 低 | 当前有较明确使用边界 |
| `api/stock?history=...` | 替换 `SELECT *` 为显式列 | 低 | 很适合做第一批 |
| `daily_prices` 技术指标列 | 按调用场景裁剪 | 中 | 不能一刀切 |
| Payload 基线测量 | 必做 | 低 | 先测再改 |

### 3.2 本轮不建议做的内容

| 项目 | 原因 |
| :--- | :--- |
| 直接裁掉 `ai_reasoning` 主体 | 当前多个核心交互直接依赖 |
| 统一引入 `?depth=full` 改造所有详情链路 | 工程改动范围过大，且当前调用方式并非围绕 detail endpoint 设计 |
| 先改 SQL 再补测试 | 风险顺序错误，容易打断现有体验 |

---

## 4. 推荐实施顺序

### 4.0 下一步执行原则

本方案的**下一步不是直接改 SQL，也不是直接删字段**，而是先完成一轮可复现的 payload 基线测量。

原因：

- 当前我们已经知道系统里存在 over-fetch，但还没有量化“最胖的是谁”
- 如果不先测量，开发很容易先去动风险高但收益不明确的字段
- 当前最适合 StockWise 的推进方式，是先拿到数据，再做第一刀低风险裁剪

**结论：开发必须从 Phase 1 开始执行，不允许跳过。**

## Phase 1: 基线测量

### 目标

先确认到底哪些接口 payload 最大，哪些字段最值得裁剪，避免“优化想象中的问题”。

### 工作项

- 统计以下接口的响应体大小：
  - `/api/stock/batch`
  - `/api/predictions`
  - `/api/history`
  - `/api/stock?history=...`
- 分别记录：
  - 单 symbol
  - 5 symbols
  - 10 symbols
  - 带 history / 不带 history
- 记录以下指标：
  - `Content-Length`
  - 响应 JSON 字段数量
  - 关键大字段大小占比（尤其是 `layer1_payload`、`ai_reasoning`）

### 产出要求

- 输出一份“优化前基线”
- 不做基线就不要直接进入字段裁剪

### 执行要求

#### 1. 测量方式

开发应至少采用以下一种方式：

- 编写本地 profiling 脚本
- 编写专门的 payload audit test
- 使用本地 `next start` + 自动请求脚本采样

不建议只靠浏览器 Network 面板手工截图作为唯一依据。

#### 2. 采样环境

优先使用：

- 本地生产构建环境
- 固定测试账号
- 固定 symbol 集合

建议至少准备两组 symbol：

- 常规港股大票：如 `00700`
- 多 symbol 组合：5 个、10 个 watchlist 标的

#### 3. 必须记录的内容

每个接口至少记录以下信息：

- 请求路径
- 请求参数
- 响应状态码
- `Content-Length` 或等价字节数
- 响应 JSON 顶层字段
- 单条记录中最大的 3 个字段

#### 4. 阶段数据 (初步采样 - Dev Mode)

> [!WARNING]
> 以下数据为 `npm run dev` 环境下的初步采样，仅用于识别字段权重。正式验收需对齐到 `Production Build` 环境。

| 接口 | 场景 | 优化前 (Dev) | 优化后 (Dev) | 减重比例 | 核心改进 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `/api/stock/batch` | 1 symbol | 64.3 KB | **30.6 KB** | **-52%** | 精简 `layer1_payload` |
| `/api/stock/batch` | 5 symbols | 67.1 KB | **33.5 KB** | **-50%** | 杜绝轨迹记录过度膨胀 |
| `/api/predictions` | 30 条 | 170.9 KB | **159.3 KB** | **-7%** | `layer1_payload` 极简化 |
| `/api/stock` | 30日历史 | 10.5 KB | **3.2 KB** | **-69%** | 消除 `SELECT *` 冗余列 |

#### 5. 阶段退出条件 (进行中)

- [x] 已拿到 4 个目标接口的基线数据 (初步)
- [x] 已确认 `history` 是 Batch API 的绝对大头 (75%+)
- [x] 已确认 `ai_reasoning` 单条占比可控
- [x] 已确认 `layer1_payload` 冗余效应显著
- [ ] **待办**：在 Production Build 环境下重新校准数据

### 本阶段开发任务 (进行中)

- [x] 新增 payload profiling 脚本
- [/] 在本地生产构建环境执行采样 (当前为 Dev 采样，待切换)
- [x] 输出初步 payload 基线分析
- [x] 标记 top payload contributor 字段
- [x] 明确 Phase 2 优化项

---

## Phase 2: 低风险字段瘦身

### Task 1. 裁剪 `layer1_payload`

**适用接口：**

- `api/stock/batch`
- `api/predictions`

**建议策略：**

在 SQL 或服务端映射层中，仅保留：

- `close`
- `change_percent`

**目标结构建议：**

```json
{
  "close": 123.45,
  "change_percent": 1.23
}
```

**注意：**

- 保持字段名兼容 `HistoricalCard.tsx`
- 若当前前端既接受 string 又接受 object，服务端应保持兼容策略一致
- 不要在这一轮顺手改动 `validation_data`

**完成标准：**

- `HistoricalCard` 基准日展示无回归
- 相关接口响应体大小明显下降

**进入前提：**

- 必须已有 Phase 1 基线证明 `layer1_payload` 是高占比字段之一
- 如果测量结果显示收益极小，则应暂停该任务并重新评估

### Task 2. 改掉 `api/stock?history=...` 的 `SELECT *`

**文件：**

- `frontend/src/app/api/stock/route.ts`

**建议字段：**

- `date`
- `open`
- `high`
- `low`
- `close`
- `volume`
- `change_percent`

如当前 UI 并未消费更多指标，则不应继续返回其余列。

**完成标准：**

- 历史价格接口不再使用 `SELECT *`
- 现有历史展示功能正常

**进入前提：**

- 已确认当前历史展示不依赖更多 `daily_prices` 字段
- 已完成 grep 和调用方核对

---

## Phase 3: 场景化裁剪技术指标

### 目标

不是删除所有技术指标，而是确认“哪个接口、哪个视图真正需要哪些指标”。

### 建议策略

#### A. Latest price 场景

如果当前 Dashboard 卡片只展示：

- `close`
- `change_percent`
- `rsi`

则 latest price 场景可以先只保留这几项，不必携带完整 `macd/kdj/boll`。

#### B. History / full detail 场景

对于：

- `StockProfile`
- `Predictions`
- 更深层研究页

仍可保留较完整指标列，但必须明确这是“详情接口”，而不是默认列表接口。

### 边界要求

- 没有 grep 到真实使用点之前，不允许删指标字段
- 任何指标裁剪都要写明“影响接口”和“消费组件”

---

## 5. `ai_reasoning` 的处理原则

### 5.1 本轮原则

**保留主体，不做 summary-only 改造。**

原因：

- 当前多个核心组件直接解析完整 JSON
- 当前并没有成熟的“列表拿 summary，点开再取 full details”的一致数据流
- 如果强行推进，极易造成体验回退或新增额外请求链路

### 5.2 如果未来要优化 `ai_reasoning`

必须先完成下面前置条件：

1. 明确列出所有消费 `ai_reasoning` 的组件
2. 区分“只要 summary”与“需要完整 tactics/story”的调用场景
3. 为完整详情建立稳定的数据获取模式
4. 补齐对应的交互与回归测试

在这些前置条件没满足之前，不建议动 `ai_reasoning` 主体。

---

## 6. 风险评估

### 6.1 字段裁剪引发隐性 UI 回归

这是本方案最大的真实风险。

尤其是：

- `layer1_payload`
- `rsi/macd/kdj/boll`
- `ai_reasoning`

看起来“前端似乎没怎么显示”，但实际可能被：

- fallback 逻辑
- 条件分支
- 隐藏的深层弹层
- 未来已上线但不常见的功能

所依赖。

### 6.2 SQL 侧 JSON 裁剪不等于零成本

SQLite/libSQL JSON 函数确实很快，但它仍是每行执行的逻辑。  
因此本轮更建议：

- 先做“高确定性的小裁剪”
- 不要把所有 payload 优化都堆到 SQL 表达式上

### 6.3 过早引入“详情模式”会放大复杂度

如果没有完整梳理现有调用链，就贸然引入：

- `?depth=full`
- dedicated detail endpoint

反而会让前后端契约变复杂，增加维护成本。

---

## 7. 开发工作清单

### Phase 1: 基线测量

- [ ] 统计 `/api/stock/batch` 响应体大小
- [ ] 统计 `/api/predictions` 响应体大小
- [ ] 统计 `/api/history` 响应体大小
- [ ] 统计 `/api/stock?history=...` 响应体大小
- [ ] 记录主要大字段占比

### Phase 2: 低风险裁剪

- [ ] Phase 1 基线测量完成并已归档
- [ ] 裁剪 `layer1_payload` 为最小必要结构
- [ ] 验证 `HistoricalCard.tsx` 展示无回归
- [ ] 将 `api/stock?history=...` 从 `SELECT *` 改为显式列
- [ ] 对优化前后 `Content-Length` 做对比

### Phase 3: 场景化指标裁剪

- [ ] grep 各技术指标的真实消费点
- [ ] 列出 latest/list/detail 三类接口所需字段
- [ ] 仅对 latest/list 场景裁剪非必要指标
- [ ] 保持 detail 场景不受影响

### Phase 4: 验证

- [ ] 验证 Dashboard 卡片
- [ ] 验证 HistoricalCard
- [ ] 验证 AICouncil
- [ ] 验证 SilentPoster
- [ ] 验证 OnboardingOverlay
- [ ] 验证 StockProfile 历史加载

---

## 8. 验收标准

本方案只有在以下条件同时满足时才算完成：

- API payload 体积有可量化下降
- Dashboard 核心展示无回归
- AICouncil / SilentPoster / Onboarding 不受影响
- 没有因为 payload 裁剪新增额外阻塞请求
- 没有引入新的权限或缓存复杂度

---

## 9. 最终建议

StockWise 当前的 over-fetch 问题是真实存在的，但它更像是 **局部肥胖**，而不是需要一次性做“大规模 payload 重构”。

最适合当前项目的做法是：

1. 先测量真实 payload 基线
2. 先裁剪 `layer1_payload`
3. 先消除少数明确的 `SELECT *`
4. 暂时不要动 `ai_reasoning` 主体

等这些低风险优化完成后，再评估是否值得进入下一轮更深的 detail/list 数据分层设计。

### 当前建议给开发的直接指令

如果团队准备开始执行，本轮应按以下顺序推进：

1. 先完成 Phase 1 基线测量
2. 把基线结果写入 PR 或附属文档
3. 仅在基线支持的前提下，进入 `layer1_payload` 裁剪
4. 再处理 `api/stock?history=...` 的 `SELECT *`

**不要直接从字段删除开始。**
