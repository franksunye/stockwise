import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 根目录与内容目录配置
const PROJECT_ROOT = path.resolve(__dirname, '..');
const CONTENT_DIRS = [
  path.join(PROJECT_ROOT, 'docs', '4_Growth_Ops', 'content'),
  path.join(PROJECT_ROOT, 'docs', '5_Support_Ops', 'content')
];
const DASHBOARD_FILE = path.join(PROJECT_ROOT, 'docs', '4_Growth_Ops', 'content', 'README.md');

// 支持追踪的平台列表。后续想增加平台，只需在这里添加 key 和展示名称即可。
const PLATFORMS = {
  wechat: '公众号',
  xhs: '小红书',
  twitter: 'Twitter',
  toutiao: '头条号'
};

// 状态对应的 Emoji 展示
const STATUS_EMOJI = {
  published: '✅ 已发布',
  scheduled: '⏳ 待发布',
  draft: '📝 草稿',
  none: '➖ 不发布',
  old: '📦 历史归档'
};

function parseFrontmatter(fileContent) {
  const match = fileContent.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;
  
  try {
    return yaml.parse(match[1]);
  } catch (e) {
    console.error(`Error parsing YAML: ${e.message}`);
    return null;
  }
}

function getAllMarkdownFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);

  files.forEach(function(file) {
    // 忽略目录和特定的非内容文件
    if (['archive', 'wechat-drafts', 'marketing', 'Mar_2026_Blitz'].includes(file) || file === 'README.md' || file === 'ZISO_101_SYLLABUS.md' || !file.endsWith('.md')) {
        // 如果是目录进入递归，前提是它不在忽略列表中且真的是个目录
        const fullPath = path.join(dirPath, file);
        if (fs.statSync(fullPath).isDirectory() && !['archive', 'wechat-drafts', 'marketing', 'Mar_2026_Blitz'].includes(file)) {
             arrayOfFiles = getAllMarkdownFiles(fullPath, arrayOfFiles);
        }
        return;
    }
    
    arrayOfFiles.push(path.join(dirPath, file));
  });

  return arrayOfFiles;
}

function formatPlatformStatus(platformData) {
    if (!platformData) return STATUS_EMOJI['none'];
    
    const status = STATUS_EMOJI[platformData.status] || STATUS_EMOJI['draft'];
    if (platformData.status === 'published' && platformData.url) {
        return `[${status}](${platformData.url})`;
    }
    return status;
}

function generateDashboard() {
  console.log('🔍 Scanning content directory...');
  let mdFiles = [];
  CONTENT_DIRS.forEach(dir => {
    mdFiles = mdFiles.concat(getAllMarkdownFiles(dir));
  });
  
  const contents = [];

  mdFiles.forEach(filePath => {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const frontmatter = parseFrontmatter(fileContent);
    const relativePath = path.relative(path.dirname(DASHBOARD_FILE), filePath);
    
    // 基础信息
    const title = frontmatter?.title || path.basename(filePath, '.md');
    const category = frontmatter?.category || 'Uncategorized';
    const funnel = frontmatter?.funnel_stage || 'Unknown';
    const date = frontmatter?.date || 'N/A';
    
    // 提取发布状态，如果没写前缀则默认为全 none
    const publish = frontmatter?.publish || {};
    
    const platformStatusText = Object.keys(PLATFORMS).map(platformKey => {
         return formatPlatformStatus(publish[platformKey]);
    });

    contents.push({
      title,
      link: relativePath,
      category,
      funnel,
      date,
      platformStatusText
    });
  });

  // 按日期降序排序 (最近的在前面)
  contents.sort((a, b) => b.date.localeCompare(a.date));

  let markdownOutput = `# 📊 CMO 内容发布全局看板 (Docs-as-Code)\n\n`;
  markdownOutput += `> 自动生成时间：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}\n`;
  markdownOutput += `> 💡 **提示**: 本看板由 \`scripts/cmo_sync.mjs\` 自动从各 Markdown 文件的头信息 (Frontmatter) 提取并重新渲染。\n\n`;

  // 生成表头
  const tableHeaders = ['文章标题', '分类 (Category)', '漏斗层级', '日期', ...Object.values(PLATFORMS)];
  markdownOutput += `| ${tableHeaders.join(' | ')} |\n`;
  markdownOutput += `| ${tableHeaders.map(() => '---').join(' | ')} |\n`;

  // 生成表格内容
  contents.forEach(item => {
    const row = [
      `[${item.title}](${item.link})`,
      item.category,
      item.funnel,
      item.date,
      ...item.platformStatusText
    ];
    markdownOutput += `| ${row.join(' | ')} |\n`;
  });

  fs.writeFileSync(DASHBOARD_FILE, markdownOutput, 'utf8');
  console.log(`✅ Dashboard successfully updated at: ${DASHBOARD_FILE}`);
}

generateDashboard();
