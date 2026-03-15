---
description: 自动同步并生成全平台的 CMO 内容发布状态看板，提取前端 Frontmatter 数据，更新 `docs/4_Growth_Ops/content/README.md` 面板。
---

当你新增了一篇文章，或修改了文章的前置元数据 (Frontmatter)（比如将草稿改为了已发布并填写了链接）后，运行此工作流可以一键刷新全局看板：

// turbo-all
1. 运行同步脚本，提取并在 `docs/4_Growth_Ops/content/README.md` 中渲染表格。
```bash
node scripts/cmo_sync.mjs
```

2. (可选) 查看更新后的看板内容
```bash
cat docs/4_Growth_Ops/content/README.md
```
