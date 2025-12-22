# StockWise

> **交易者的抬头显示器 (HUD)** —— 不做预测涨跌的水晶球，做执行纪律的条件反射训练器。

---

## 🎯 这是什么？

StockWise 是一个帮助个人投资者**执行交易纪律**的 Mobile-First Web App。

它不告诉你"买什么会涨"，而是在你情绪崩溃时，冷酷地提醒你：**"这是你自己定的规则，遵守它。"**

---

## 💡 核心价值

| 市面上的 App | StockWise |
|--------------|-----------|
| 承诺"我帮你赢" | 承诺"我是你的理性锚点" |
| 制造焦虑 | 消除噪音 |
| 预测涨跌 | 执行纪律 |

---

## 🛠️ 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Next.js 14 (PWA) + TypeScript + Tailwind CSS |
| 部署 | Vercel |
| 数据库 | Turso (libSQL) |
| 数据管道 | Python + GitHub Actions |
| AI | Google Gemini |

---

## 📚 文档导航

| # | 文档 | 说明 |
|---|------|------|
| 01 | [产品故事](./01_product-story.md) | Aha Moment —— 为什么用户会爱上这个产品 |
| 02 | [产品规格](./02_product-specification.md) | MVP 功能模块与用户流程 |
| 03 | [技术规格](./03_technical-specification.md) | 前后端开发蓝图 |
| 04 | [数据字典](./04_data-dictionary.md) | 数据库表结构与字段定义 |

---

## 🚀 快速开始

```bash
# 克隆仓库
git clone https://github.com/franksunye/stockwise.git
cd stockwise

# 安装依赖 (前端)
npm install

# 运行开发服务器
npm run dev
```

---

## 📁 项目结构

```
stockwise/
├── docs/                 # 文档
├── backend/              # Python ETL 脚本
├── src/                  # Next.js 前端
│   ├── app/              # 页面路由
│   ├── components/       # UI 组件
│   └── lib/              # 工具库
├── .github/workflows/    # GitHub Actions
└── package.json
```

---

## 📄 License

MIT

---

*StockWise - 让每一次交易都遵守纪律*
