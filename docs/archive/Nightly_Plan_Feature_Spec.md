# Nightly Plan & Morning Push - Full Feature Spec

## Goal
Transform the current "Nightly Plan" from a technical signal reporter into a **News-Driven Financial Assistant**. The system prioritizes "What happened?" (News) to explain "What is the data saying?" (Price), creating a cohesive narrative.

---

## Current State
- **Technical Engine (`runner.py`)**: Strong. Generates Signals, Confidence, Support/Pressure.
- **Brief Generator (`brief_generator.py`)**: Weak. News is "bolted on" instead of woven into narrative.

---

## UX Design

### 1. Two-Layer Content Model
| Layer         | Component                 | Focus                        | User Mindset                  |
| ------------- | ------------------------- | ---------------------------- | ----------------------------- |
| 1: Narrative  | `BriefDrawer.tsx`         | "The Story" (News + Trend)   | "Why is market moving?"       |
| 2: Microscope | `TacticalBriefDrawer.tsx` | "The Data" (Signals, Levels) | "What are the exact numbers?" |

### 2. Two Consumption Moments (Same Content)
| Time              | Name     | Trigger           | Greeting                     | User Goal       |
| ----------------- | -------- | ----------------- | ---------------------------- | --------------- |
| Evening (~9PM)    | 晚间复盘 | Active App Open   | "晚上好，这是您的明日计划。" | Research & Prep |
| Morning (~8:30AM) | 晨间推送 | Push Notification | "早安，请重温您的交易纪律。" | Execution Mode  |

### 3. History Access (Trust Builder)
- **Problem**: Users want to verify "Was AI right yesterday?"
- **Solution**: Date Navigation (`< Prev Day` | `Next Day >`) in `BriefDrawer` header.
- **Value**: "Audit" the AI, building long-term trust.

---

## Feature Backlog (Prioritized)

### MVP (V1.0) - Current Sprint
| Feature                 | Description                            | Owner    |
| ----------------------- | -------------------------------------- | -------- |
| ✅ News-Driven Narrative | Smart Querying based on price action   | Backend  |
| ✅ Dynamic Greeting      | Contextual header based on time of day | Frontend |
| ✅ Date Navigation       | Browse historical briefs               | Frontend |

### V1.1 - Trust & Engagement
| Feature               | Description                      | Value   | Effort |
| --------------------- | -------------------------------- | ------- | ------ |
| AI Accuracy Display   | "AI 对腾讯过去 30 天准确率: 68%" | 信任+++ | Medium |
| Read Status Badge     | Dashboard 红点提示未读日报       | 留存+   | Low    |
| Multi-Day Aggregation | "您有 5 份未读日报" -> 归档入口  | 体验+   | Low    |

### V1.2 - Intelligence & Discipline
| Feature                | Description                                   | Value   | Effort |
| ---------------------- | --------------------------------------------- | ------- | ------ |
| Key Event Calendar     | "明天腾讯发布财报" (需数据源)                 | 情报+++ | High   |
| Plan vs Actual Tracker | 用户录入实际操作，AI 点评偏离度               | 纪律++  | High   |
| Personalized Summary   | "您持仓 3 只股票今日表现: +1.5%, -0.3%, 平盘" | 组合++  | Medium |

### V2.0 - Wow Factor
| Feature           | Description                                        | Value   |
| ----------------- | -------------------------------------------------- | ------- |
| 安睡指数          | 可视化情绪指标: "今晚持仓风险: 低。可以安心入睡 😴" | Delight |
| Push 时区本地化   | 非中国用户按当地时间推送                           | 国际化  |
| PWA Offline Cache | 地铁信号差时可离线阅读日报                         | 体验+   |

---

## Technical Implementation (MVP)

### 1. Backend: Smart News Fetching (`backend/engine/brief_generator.py`)
- Generate dynamic Tavily queries based on price change:
  - Stock down 5% → Query: "Why did {stock} drop today?"
  - Stock up 3% → Query: "{stock} positive news catalyst"
- Prioritize reputable financial news sources.

### 2. Backend: Narrative Prompt Refinement
- **Structure**: Headline → Story → Plan
- **Tone**: Financial Columnist (professional, narrative-driven)
- **Rules**: No raw indicator values, translate to qualitative language.

### 3. Frontend: `BriefDrawer.tsx` Enhancements
- [ ] Dynamic Greeting (based on current hour)
- [ ] Date Navigation (`< Prev` | `Next >`)
- [ ] Premium Newsletter styling

### 4. Verification
- Manual run of `brief_generator.py` on 00700, 09988.
- Review: "Does it read like a newsletter or a data dump?"

---

## Technical Stack
- **Search**: Tavily API
- **LLM**: Gemini-3-Flash / Hunyuan Lite 
- **Storage**: `stock_briefs`, `daily_briefs` tables
