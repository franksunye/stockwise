# StockWise GitHub Workflows 设计文档

## 📋 现状分析

### 当前 Workflows 清单

| 文件                     | 触发方式         | 功能            | 问题                    |
| ------------------------ | ---------------- | --------------- | ----------------------- |
| `daily_sync.yml`         | 手动             | 全量同步+AI分析 | ⚠️ 已废弃，与 CN/HK 重复 |
| `daily_sync_cn.yml`      | 定时 (UTC 8:00)  | A股数据+AI分析  | 🔴 数据同步和AI分析耦合  |
| `daily_sync_hk.yml`      | 定时 (UTC 8:30)  | 港股数据+AI分析 | 🔴 数据同步和AI分析耦合  |
| `realtime-sync.yml`      | 手动/Worker      | 盘中实时同步    | ✅ 职责单一              |
| `metadata_sync.yml`      | 定时 (UTC 22:00) | 元数据同步      | ✅ 职责单一              |
| `on-demand-sync.yml`     | 手动             | 单股票同步      | ✅ 职责单一              |
| `admin_manage_codes.yml` | 手动             | 邀请码管理      | ✅ 职责单一              |

### 主要问题

1. **耦合问题**: `daily_sync_cn/hk.yml` 将数据同步和 AI 分析绑定在一起
   - 如果数据同步成功但 AI 分析失败，需要重跑整个流程
   - 无法单独触发 AI 分析（比如补跑、重新分析）
   - 环境变量配置庞大且重复

2. **命名不一致**: 
   - `daily_sync.yml` vs `daily_sync_cn.yml` 命名混乱
   - `realtime-sync.yml` 使用连字符，其他使用下划线

3. **废弃代码**: `daily_sync.yml` 注释说已废弃但仍保留

---

## 🎯 优化方案

### 设计原则

1. **单一职责**: 每个 Workflow 只做一件事
2. **可组合**: 通过 `workflow_call` 实现复用
3. **可独立运行**: 方便调试和补跑
4. **命名规范**: 统一使用下划线，按功能分类

### 新架构

```
.github/workflows/
├── _shared/                    # 可复用的 Composite Actions
│   └── setup_python.yml        # Python 环境配置 (可选，后续实现)
│
├── 📊 数据层 (Data Layer)
│   ├── data_sync_cn.yml        # A股数据同步 (仅同步，不分析)
│   ├── data_sync_hk.yml        # 港股数据同步 (仅同步，不分析)
│   ├── data_sync_realtime.yml  # 盘中实时同步
│   └── data_sync_single.yml    # 单股票按需同步
│
├── 🧠 分析层 (Analysis Layer)
│   ├── ai_analyze_cn.yml       # A股 AI 分析 (独立于数据同步)
│   ├── ai_analyze_hk.yml       # 港股 AI 分析 (独立于数据同步)
│   └── ai_backfill.yml         # AI 分析回填 (历史补充)
│
├── ⚙️ 维护层 (Maintenance Layer)
│   ├── meta_sync.yml           # 股票元数据同步
│   └── admin_codes.yml         # 邀请码管理
│
└── 🔗 编排层 (Orchestration Layer)
    ├── daily_pipeline_cn.yml   # A股每日完整流水线 (调用 data_sync + ai_analyze)
    └── daily_pipeline_hk.yml   # 港股每日完整流水线 (调用 data_sync + ai_analyze)
```

### 各层职责

#### 数据层 (Data Layer)
- 从数据源拉取行情数据
- 计算技术指标
- 写入数据库
- **不做 AI 分析**

#### 分析层 (Analysis Layer)  
- 读取数据库中的最新数据
- 调用 AI/规则引擎生成预测
- 发送推送通知
- **不做数据同步**

#### 维护层 (Maintenance Layer)
- 低频运行的维护任务
- 元数据更新、邀请码管理等

#### 编排层 (Orchestration Layer)
- 组合多个 Workflow 形成完整流水线
- 使用 `workflow_call` 或 `workflow_run` 实现

---

## 📅 调度时间表

### 每日定时任务

| 时间 (北京) | 时间 (UTC)  | Workflow                | 说明                 |
| ----------- | ----------- | ----------------------- | -------------------- |
| 06:00       | 22:00 (D-1) | `meta_sync.yml`         | 同步股票元数据       |
| 16:00       | 08:00       | `daily_pipeline_cn.yml` | A股收盘后完整流水线  |
| 16:30       | 08:30       | `daily_pipeline_hk.yml` | 港股收盘后完整流水线 |

### 盘中实时 (由 Cloudflare Worker 触发)

| 时间 (北京) | 频率     | Workflow                 | 说明         |
| ----------- | -------- | ------------------------ | ------------ |
| 09:30-15:00 | 每10分钟 | `data_sync_realtime.yml` | A股盘中同步  |
| 09:30-16:00 | 每10分钟 | `data_sync_realtime.yml` | 港股盘中同步 |

### 手动触发

| Workflow               | 使用场景             |
| ---------------------- | -------------------- |
| `data_sync_single.yml` | 新增股票、单股补数据 |
| `ai_backfill.yml`      | 补跑历史 AI 分析     |
| `ai_analyze_cn/hk.yml` | 重新运行当日分析     |
| `admin_codes.yml`      | 邀请码管理           |

---

## 🔄 迁移计划

### Phase 1: 拆分 (解耦数据同步与AI分析)

1. 创建 `data_sync_cn.yml` - 仅数据同步
2. 创建 `ai_analyze_cn.yml` - 仅 AI 分析
3. 创建 `daily_pipeline_cn.yml` - 编排层
4. 对港股做相同处理

### Phase 2: 清理

1. 删除旧的 `daily_sync.yml`
2. 重命名 `realtime-sync.yml` → `data_sync_realtime.yml`
3. 统一命名规范

### Phase 3: 增强

1. 添加 `ai_backfill.yml` 支持历史补跑
2. 考虑添加 Composite Actions 减少重复代码
3. 添加 Slack/企微通知步骤

---

## 💡 最佳实践

### 1. 使用 `workflow_call` 实现复用

```yaml
# daily_pipeline_cn.yml
jobs:
  sync:
    uses: ./.github/workflows/data_sync_cn.yml
    secrets: inherit
  
  analyze:
    needs: sync
    if: success()
    uses: ./.github/workflows/ai_analyze_cn.yml
    secrets: inherit
```

### 2. 使用 Concurrency 避免重复运行

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

### 3. 使用 Matrix 减少重复

```yaml
strategy:
  matrix:
    market: [CN, HK]
```

### 4. 环境变量分组

```yaml
env:
  # 数据库配置
  TURSO_DB_URL: ${{ secrets.TURSO_DB_URL }}
  TURSO_AUTH_TOKEN: ${{ secrets.TURSO_AUTH_TOKEN }}
  
  # AI 配置 (仅分析任务需要)
  LLM_API_KEY: ${{ secrets.LLM_API_KEY }}
```

---

## 📝 待办事项

- [ ] Phase 1: 拆分 daily_sync_cn/hk.yml
- [ ] Phase 2: 清理废弃文件和统一命名
- [ ] Phase 3: 添加 ai_backfill.yml
- [ ] 文档: 更新本 README 反映实际状态

---

*最后更新: 2026-01-03*
