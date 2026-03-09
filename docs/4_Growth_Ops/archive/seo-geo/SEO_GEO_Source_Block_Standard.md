# 知守 AI (ZISO AI) SEO/GEO 来源块标准（v1）

> Date: 2026-03-05
> Scope: 全站公开内容页（learn/support/landing 解释块）

## 1) 数据结构

```ts
type SourceRef = {
  name: string;          // 来源名称（必填）
  url?: string;          // 来源链接（可选）
  accessedAt?: string;   // 访问时间 YYYY-MM-DD（建议）
  claimScope?: string;   // 覆盖的主张范围（建议）
};
```

## 2) 渲染规则

- 至少 2 条来源：
  - 1 条站内来源（Learn/Support）
  - 1 条数据口径来源（如统计口径页/机制定义页）
- 每条来源尽量带 `accessedAt`。
- 来源列表放在正文结尾、边界声明之前。

## 3) 写法规则（GEO 友好）

- 单条来源对应单类主张，避免“一条来源覆盖全部结论”。
- 结论里出现数字时，来源块必须能追溯到口径说明。
- 禁止“据内部消息”“据观察”等不可追溯表述。

## 4) 示例

```ts
[
  {
    name: "知守 AI (ZISO AI) Learn Center",
    url: "https://ziso.cc/learn",
    accessedAt: "2026-03-05",
    claimScope: "方法论定义"
  },
  {
    name: "知守 AI (ZISO AI) Support Center",
    url: "https://ziso.cc/support",
    accessedAt: "2026-03-05",
    claimScope: "功能机制与验证口径"
  }
]
```

## 5) 发布前检查

- 是否存在来源块。
- 来源是否可访问（站内 200）。
- 关键数字是否具备日期与来源锚点。
- 边界声明是否同时出现。

