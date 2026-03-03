
const fs = require('fs');
const path = require('path');

// 1. 读取 support-content.ts 文件内容
const SUPPORT_CONTENT_PATH = path.join(__dirname, '../../frontend/src/lib/support-content.ts');
const OUTPUT_DIR = path.join(__dirname, '../../docs/wechat-drafts');

// 确保输出目录存在
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// 2. 简单的正则解析器 (避免引入复杂依赖)
// 目标是直接从源码字符串中提取出文章对象
const content = fs.readFileSync(SUPPORT_CONTENT_PATH, 'utf-8');

// 正则匹配每一个文章对象块
// 结构: 'slug': { ... content: `...` }
const articleRegex = /'([^']+)'\s*:\s*\{[^}]*slug:\s*'([^']+)'[^}]*title:\s*'([^']+)'[^}]*category:\s*'([^']+)'[^}]*lastUpdated:\s*'([^']+)'[^}]*content:\s*`([\s\S]*?)`\s*\}/g;

let match;
let count = 0;

console.log(`🚀 开始提取 Support 文章到 ${OUTPUT_DIR}...`);

while ((match = articleRegex.exec(content)) !== null) {
    const [_, key, slug, title, category, lastUpdated, bodyContent] = match;
    
    // 3. 构建 Markdown 内容
    const mdContent = `---
title: "${title}"
date: "${lastUpdated}"
category: "${category}"
---

# ${title}

${bodyContent.trim()}

---
*本文档归档于 StockWise Support Center (${category})*
`;

    // 4. 写入文件
    const filename = `support-${slug}.md`;
    const filePath = path.join(OUTPUT_DIR, filename);
    
    fs.writeFileSync(filePath, mdContent, 'utf-8');
    console.log(`✅ 生成: ${filename}`);
    count++;
}

console.log(`\n🎉 完成! 共生成 ${count} 篇 Markdown 草稿。`);
console.log(`👉 请在 cursor 中打开 'docs/wechat-drafts' 目录查看并复制到 MDNice。`);
