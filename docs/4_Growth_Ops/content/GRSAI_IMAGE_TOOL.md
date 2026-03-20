# GRSAI 图片生成工具说明

工具脚本：

- `scripts/grsai_generate_image.mjs`

适用模型：

- `nano-banana-fast`

## 1) 准备 API Key

推荐放在项目根目录 `.env.local`（已被 `.gitignore` 忽略）：

```bash
GRSAI_API_KEY=你的key
```

脚本默认会先尝试自动读取项目根目录 `.env.local`，只要文件存在且包含：

```bash
GRSAI_API_KEY=你的key
```

就可以直接运行工具。

如果你希望手动加载，也可以：

```bash
set -a; source .env.local; set +a
```

## 2) 常用命令（101-68）

生成封面（文生图）：

```bash
node scripts/grsai_generate_image.mjs --from-asset --task cover
```

生成正文图（图生图，参考 `cover`）：

```bash
node scripts/grsai_generate_image.mjs --from-asset --task body-1
node scripts/grsai_generate_image.mjs --from-asset --task body-2
```

生成传播卡图（图生图，参考 `cover`）：

```bash
node scripts/grsai_generate_image.mjs --from-asset --task card-1
node scripts/grsai_generate_image.mjs --from-asset --task card-2
```

快捷命令（仅封面）：

```bash
npm run image:101-68:cover
```

## 3) 安全默认行为

如果目标文件已存在，工具会默认跳过，避免重复生成：

```text
Skip generation: output already exists
```

这符合“图文齐备后不重复出图”的流程约束。

## 4) 单图强制重生

只重生某一张图，加 `--force` 即可。

例如只重生 `body-1`：

```bash
node scripts/grsai_generate_image.mjs --from-asset --task body-1 --force
```

## 5) 其他文章

指定文章文件：

```bash
node scripts/grsai_generate_image.mjs \
  --from-asset \
  --asset-file docs/4_Growth_Ops/content/101_academy/101-107_institutional_portfolio_l3.md \
  --task cover
```

## 6) 调试与排查

只看请求参数，不调用 API：

```bash
node scripts/grsai_generate_image.mjs --from-asset --task cover --dry-run
```

查看帮助：

```bash
node scripts/grsai_generate_image.mjs --help
```

常见问题：

- 报错 `Missing GRSAI_API_KEY`：
  项目根目录没有 `.env.local`，或其中没有 `GRSAI_API_KEY`
- 报错 `Image2image mode requires a valid reference image`：
  先生成 `cover`，或显式传 `--reference`
- 输出路径是 `/images/...`：
  工具会自动映射到 `frontend/public/images/...`
