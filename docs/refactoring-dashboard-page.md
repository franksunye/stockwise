# Dashboard 页面重构优化方案

> 文档创建时间：2025-12-26  
> 目标文件：`frontend/src/app/page.tsx`  
> 当前状态：约 700 行代码，功能完整但结构臃肿

---

## 一、现状分析

### 1.1 当前文件职责（过重）

`page.tsx` 承担了以下所有职责：

| 职责类型     | 具体内容                                 |
| ------------ | ---------------------------------------- |
| **状态管理** | 股票列表、当前索引、弹窗开关、滚动位置等 |
| **数据获取** | 并行请求多只股票数据、自动刷新逻辑       |
| **导航逻辑** | URL 参数解析、股票定位、TikTok 式滚动    |
| **UI 组件**  | 6+ 个子组件直接定义在文件内              |
| **类型定义** | `StockData`, `TacticalData` 等接口       |
| **全局样式** | CSS-in-JS 动画关键帧                     |

### 1.2 存在的问题

1. **可维护性差**：700 行代码难以快速定位问题
2. **复用性低**：子组件无法在其他页面使用
3. **首屏性能**：所有组件一次性加载，包括不常用的弹窗
4. **协作困难**：多人开发时容易产生 Git 冲突

---

## 二、优化策略

### 2.1 组件原子化拆分 (Component Extraction)

**目标**：将页面内定义的子组件提取为独立文件

#### 待拆分组件清单

| 组件名                | 当前行数 | 建议路径                                           |
| --------------------- | -------- | -------------------------------------------------- |
| `TacticalBriefDrawer` | ~75 行   | `src/components/dashboard/TacticalBriefDrawer.tsx` |
| `StockDashboardCard`  | ~120 行  | `src/components/dashboard/StockDashboardCard.tsx`  |
| `HistoricalCard`      | ~50 行   | `src/components/dashboard/HistoricalCard.tsx`      |
| `VerticalIndicator`   | ~50 行   | `src/components/dashboard/VerticalIndicator.tsx`   |
| `StockVerticalFeed`   | ~30 行   | `src/components/dashboard/StockVerticalFeed.tsx`   |
| `StockProfile`        | ~100 行  | `src/components/dashboard/StockProfile.tsx`        |

#### 建议的目录结构

```
src/components/
├── dashboard/
│   ├── index.ts                  # 统一导出
│   ├── TacticalBriefDrawer.tsx
│   ├── StockDashboardCard.tsx
│   ├── HistoricalCard.tsx
│   ├── VerticalIndicator.tsx
│   ├── StockVerticalFeed.tsx
│   └── StockProfile.tsx
└── SettingsModal.tsx             # 已存在
```

---

### 2.2 逻辑抽象：自定义 Hooks

**目标**：将业务逻辑从视图层剥离

#### Hook 1: `useDashboardData`

**职责**：
- 获取用户监控列表
- 并行请求所有股票数据
- 管理自动刷新（10 分钟间隔）
- 处理加载和错误状态

```typescript
// src/hooks/useDashboardData.ts
export function useDashboardData() {
  const [stocks, setStocks] = useState<StockData[]>([]);
  const [loading, setLoading] = useState(true);
  
  const refresh = useCallback(async () => { /* ... */ }, []);
  
  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [refresh]);
  
  return { stocks, loading, refresh };
}
```

#### Hook 2: `useTikTokScroll`

**职责**：
- 管理水平滚动索引
- 处理 URL 参数定位
- 管理垂直滚动位置
- 提供"回到今天"功能

```typescript
// src/hooks/useTikTokScroll.ts
export function useTikTokScroll(stockCount: number) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [yScrollPosition, setYScrollPosition] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // URL 参数定位逻辑
  // 滚动事件处理
  // 回到顶部功能
  
  return { currentIndex, yScrollPosition, scrollRef, scrollToStock };
}
```

---

### 2.3 类型与样式集中化

#### 类型定义迁移

将以下接口移动到 `src/lib/types.ts`：

```typescript
// 待迁移
interface Tactic { p: string; a: string; c: string; r: string; }
interface TacticalData {
  summary: string;
  tactics: { holding: Tactic[]; empty: Tactic[]; };
  conflict: string;
}
```

#### 样式抽离

将 `<style jsx global>` 中的关键帧动画移入全局 CSS：

```css
/* src/app/globals.css */
@keyframes warning-pulse {
  0%, 100% { border-color: rgba(255, 255, 255, 0.05); }
  50% { border-color: rgba(244, 63, 94, 0.3); background: rgba(244, 63, 94, 0.02); }
}
.warning-pulse { animation: warning-pulse 2s infinite; }
```

---

### 2.4 性能优化：动态导入

**目标**：减少首屏 JavaScript 包体积

```typescript
// 弹窗类组件使用动态导入
import dynamic from 'next/dynamic';

const SettingsModal = dynamic(() => import('@/components/SettingsModal'), {
  loading: () => null,
  ssr: false
});

const TacticalBriefDrawer = dynamic(
  () => import('@/components/dashboard/TacticalBriefDrawer'),
  { ssr: false }
);

const StockProfile = dynamic(
  () => import('@/components/dashboard/StockProfile'),
  { ssr: false }
);
```

**预期收益**：
- 首屏 JS 体积减少约 30-40%
- 弹窗代码仅在用户点击时按需加载

---

## 三、重构后的理想结构

```typescript
// src/app/page.tsx (重构后约 100-150 行)

'use client';

import { Suspense } from 'react';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useTikTokScroll } from '@/hooks/useTikTokScroll';
import { StockVerticalFeed } from '@/components/dashboard';
import dynamic from 'next/dynamic';

const SettingsModal = dynamic(() => import('@/components/SettingsModal'));
const TacticalBriefDrawer = dynamic(() => import('@/components/dashboard/TacticalBriefDrawer'));
const StockProfile = dynamic(() => import('@/components/dashboard/StockProfile'));

function DashboardPageContent() {
  const { stocks, loading, refresh } = useDashboardData();
  const { currentIndex, scrollRef, yScrollPosition } = useTikTokScroll(stocks.length);
  
  // 仅保留状态编排和渲染逻辑
  // ...
}

export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <DashboardPageContent />
    </Suspense>
  );
}
```

---

## 四、执行计划

### 阶段一：低风险抽离（建议优先执行）

| 步骤 | 内容                            | 预计耗时 | 风险等级 |
| ---- | ------------------------------- | -------- | -------- |
| 1    | 迁移类型定义到 `types.ts`       | 5 分钟   | ⚪ 极低   |
| 2    | 迁移 CSS 关键帧到 `globals.css` | 5 分钟   | ⚪ 极低   |
| 3    | 抽离 `VerticalIndicator` 组件   | 10 分钟  | ⚪ 极低   |
| 4    | 抽离 `HistoricalCard` 组件      | 10 分钟  | ⚪ 极低   |

### 阶段二：核心组件拆分

| 步骤 | 内容                       | 预计耗时 | 风险等级 |
| ---- | -------------------------- | -------- | -------- |
| 5    | 抽离 `StockDashboardCard`  | 15 分钟  | 🟡 低     |
| 6    | 抽离 `TacticalBriefDrawer` | 15 分钟  | 🟡 低     |
| 7    | 抽离 `StockProfile`        | 15 分钟  | 🟡 低     |

### 阶段三：逻辑层重构

| 步骤 | 内容                         | 预计耗时 | 风险等级 |
| ---- | ---------------------------- | -------- | -------- |
| 8    | 创建 `useDashboardData` Hook | 20 分钟  | 🟠 中     |
| 9    | 创建 `useTikTokScroll` Hook  | 20 分钟  | 🟠 中     |
| 10   | 添加动态导入                 | 10 分钟  | 🟡 低     |

---

## 五、验收标准

重构完成后，应满足以下条件：

1. **功能完整性**：所有现有功能正常运行，无回归问题
2. **代码行数**：`page.tsx` 缩减至 150 行以内
3. **类型安全**：TypeScript 编译无错误
4. **性能提升**：首屏加载时间减少 20% 以上（可选）
5. **测试通过**：手动测试所有交互路径

---

## 六、注意事项

1. **逐步推进**：每完成一个组件抽离，立即进行功能验证
2. **Git 小步提交**：每个步骤单独提交，便于问题回滚
3. **保持 Props 简洁**：避免过度解构导致的"Props 地狱"
4. **暂不引入状态管理库**：当前规模不需要 Redux/Zustand

---

*文档作者：AI Agent (Antigravity)*  
*最后更新：2025-12-26*
