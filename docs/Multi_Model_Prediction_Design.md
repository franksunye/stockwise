# StockWise 多模型 AI 预测架构设计 (v1.0)

> **目标**: 打破当前 “一票一模型” 的限制，支持多模型竞技（Rule vs LLM）、环境自适应（Local vs Cloud）及 A/B 测试。

## 1. 核心痛点与价值

| 当前痛点 (AS-IS)                                                           | 升级价值 (TO-BE)                                                                  |
| :------------------------------------------------------------------------- | :-------------------------------------------------------------------------------- |
| **单点依赖**: 仅支持一个 AI 结果，不仅覆盖了规则引擎结果，也无法横向对比。 | **赛马机制**: 同一股票可由 DeepSeek V3、Local Llama、规则引擎同时预测，择优展示。 |
| **环境僵化**: 开发环境不敢跑 AI (费钱)，生产环境无法跑本地模型。           | **环境自适应**: 开发环境自动切 `local-mock`，生产环境切 `deepseek-cloud`。        |
| **黑盒优化**: 无法量化 Prompt 的改进效果。                                 | **A/B 测试**: 新旧 Prompt 并行运行，通过胜率数据驱动优化。                        |

---

## 2. 数据库设计 (Schema Evolution)

### 2.1 新增：模型注册表 (`prediction_models`)
管理所有可用的预测引擎及其配置。

```sql
CREATE TABLE prediction_models (
    model_id TEXT PRIMARY KEY,       -- 例如: 'deepseek-v3', 'rule-engine', 'local-llama-3'
    display_name TEXT NOT NULL,      -- 前端展示名: "DeepSeek V3 深度分析"
    provider TEXT NOT NULL,          -- 核心类型: 'adapter-openai', 'adapter-local', 'rule-engine'
    endpoint TEXT,                   -- API 地址或本地路径
    is_active BOOLEAN DEFAULT 1,     -- 全局启用开关
    priority INTEGER DEFAULT 0,      -- 默认展示优先级 (数字越大越优先)
    config_json TEXT,                -- 模型特定配置 (JSON string)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 初始化数据示例
INSERT INTO prediction_models (model_id, display_name, provider, priority) VALUES 
('deepseek-v3', 'DeepSeek V3 (Cloud)', 'adapter-openai', 100),
('rule-engine', '量化规则引擎 (Base)', 'rule-engine', 50),
('mock-dev', '开发测试 Mock', 'mock', 0);
```

### 2.2 升级：预测结果表 (`ai_predictions`)
**核心变更**: 主键由 `(symbol, date)` 升级为 `(symbol, date, model_id)`。

```sql
-- 建议创建 v2 表进行迁移，或直接修改原表结构
CREATE TABLE ai_predictions_v2 (
    symbol TEXT NOT NULL,
    date TEXT NOT NULL,
    model_id TEXT NOT NULL,          -- 🔑 新增主键维度
    
    target_date TEXT NOT NULL,
    signal TEXT,                     -- Long/Side/Short
    confidence REAL,
    support_price REAL,
    ai_reasoning TEXT,               -- JSON 结构化分析
    
    validation_status TEXT DEFAULT 'Pending',
    actual_change REAL,
    
    is_primary BOOLEAN DEFAULT 0,    -- 🌟 标记是否为当日“主推”预测 (用于首页展示)
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (symbol, date, model_id),
    FOREIGN KEY (model_id) REFERENCES prediction_models(model_id)
);
```

---

## 3. 后端架构升级

### 3.1 抽象模型适配器 (Model Adapters)

代码结构调整，引入策略模式：

```
backend/
├── engine/
│   ├── models/
│   │   ├── base.py          # 抽象基类
│   │   ├── openai.py        # 兼容 DeepSeek/Gemini/OpenAI
│   │   ├── ollama.py        # 本地 LLM
│   │   └── rule_based.py    # 纯规则引擎
│   └── factory.py           # 根据 model_id 返回实例
```

### 3.2 预测流程变更 (`analysis/runner.py`)

**旧逻辑**:
1. 获取数据 -> 2. 调 AI -> 3. 写入 (覆盖)

**新逻辑**:
1. 获取数据
2. 读取 `prediction_models` 获取所有 `is_active=1` 的模型
3. **并行执行** (或根据配置串行) 所有模型预测
4. **结果聚合与选优**:
   - 默认将 `priority` 最高的模型标记为 `is_primary=1`
   - (进阶) 如果规则引擎和 AI 信号冲突，优先保守策略
5. 批量写入 `ai_predictions`

---

## 4. 前端展示升级 (UX)

### 4.1 首页 / 列表页
- **逻辑**: 仅查询 `is_primary=1` 的记录。
- **展示**: 也就是用户看到的是系统认为“最值得参考”的那个结果，界面保持清爽，无感知。

### 4.2 详情页 (Stock Detail)
- **多视角切换**: 增加 "分析模型" 下拉框或 Tabs。
  - `DeepSeek V3` (默认)
  - `规则引擎` (作为基准参考)
- **一致性提示**:
  - 如果多个模型信号一致 (如都是 Long)，显示 "🔥 强力共振" 标签。
  - 如果冲突 (AI 看多，规则看空)，显示 "⚠️ 信号分歧，请谨慎" 标签。

---

## 5. 迁移计划 (Migration Roadmap)

### Phase 1: 数据库准备 (Current)
- [ ] 创建 `prediction_models` 表
- [ ] 创建 `ai_predictions_v2` 表
- [ ] 编写数据迁移脚本: 将旧表数据导入 v2，默认赋予 `model_id='legacy-ai'`, `is_primary=1`

### Phase 2: 后端重构
- [ ] 实现 `ModelFactory` 和适配器模式
- [ ] 改造 `runner.py` 支持多模型循环
- [ ] 更新 `backfill.py` 以支持指定 model_id 回填

### Phase 3: 前端适配
- [ ] API `/api/stock` 升级，支持返回多模型列表
- [ ] 详情页 UI 增加模型切换器

### Phase 4: A/B 测试运营
- [ ] 上线新 Prompt 作为 `deepseek-v3-beta`
- [ ] 运行一周，对比 `validation_status` 胜率
- [ ] 胜出者晋升为 `priority=100` 的主模型
