# StockWise Documentation

> **为纪律而生的交易 HUD**

欢迎来到 StockWise 项目文档库。这是一个旨在帮助个人投资者克服情绪波动、坚守交易纪律的 AI 原生应用。

---

## 🗺️ 文档概览

1. **[产品规格 (PRD)](./Product_Spec.md)**：
   - 包含产品愿景、Aha Moment、核心功能及 MVP 策略。
2. **[技术设计 (Design)](./Technical_Design.md)**：
   - 包含系统架构、数据库设计及数据采集管道。
3. **[待办清单 (Backlog)](./Backlog.md)**：
   - 详细的任务拆解与迭代计划。

---

## 🚀 快速启动

### 2分钟本地开发
```bash
# 前端启动
cd frontend
npm install
npm run dev

# 后端 ETL 测试 (需要环境变量)
cd backend
python sync_meta.py
```

---

## 📅 项目路线图 (Backlog)

### ✅ 已完成
- 核心 UI 框架 (Next.js + Tailwind)
- 数据采集管道原型 (Akshare + Python)
- 基础红绿灯信号算法

### 🚧 正在进行 (Sprint 6/7)
- **AI 预测验证系统**：集成 Gemini 预测与自动验证逻辑。
- **盈亏比量化统计**：在 History 页面展示胜率曲线。
- **50 只精选股票池**：优化数据覆盖范围。

### 🔮 未来规划
- 移动端 PWA 深度优化。
- 多策略 AI 对比系统。
- 微信/邮件信号预警推送。

---

## 📁 目录结构
```text
stockwise/
├── docs/                 # 项目文档 (PRD & Design)
├── backend/              # Python ETL 数据管道 & AI 分析
├── frontend/             # Next.js 14 应用
│   ├── src/app/          # 路由与页面
│   └── src/components/   # 精美 UI 组件
└── .github/workflows/    # 自动化任务
```
