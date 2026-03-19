import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import url from 'url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');

const GROWTH_DIR = path.join(ROOT_DIR, 'docs/4_Growth_Ops/content');
const SUPPORT_DIR = path.join(ROOT_DIR, 'docs/5_Support_Ops/content');
const STRATEGY_DIR = path.join(ROOT_DIR, 'docs/0_Strategy');
const INTELLIGENCE_DIR = path.join(ROOT_DIR, 'docs/2_Intelligence');
const ENGINEERING_DIR = path.join(ROOT_DIR, 'docs/1_Engineering');
const PRODUCT_DIR = path.join(ROOT_DIR, 'docs/3_Product');

const OUTPUT_FILE = path.join(ROOT_DIR, 'docs/4_Growth_Ops/54_Content_Traceability_Matrix.md');

// Helper to get git modified time
function getGitModTime(filepath) {
  try {
    const relativePath = path.relative(ROOT_DIR, filepath);
    const output = execSync(`cd "${ROOT_DIR}" && git log -1 --format="%ct" -- "${relativePath}"`, { encoding: 'utf8' }).trim();
    if (output) return parseInt(output, 10);
    // Fallback to file system stat if untracked
    return Math.floor(fs.statSync(filepath).mtimeMs / 1000);
  } catch (e) {
    return 0;
  }
}

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const meta = {};
  const lines = match[1].split('\n');
  let currentKey = '';
  for (const line of lines) {
    if (line.startsWith('  - ')) {
      if (currentKey && Array.isArray(meta[currentKey])) {
        meta[currentKey].push(line.replace('  - ', '').trim());
      }
    } else if (line.includes(':')) {
      const parts = line.split(':');
      currentKey = parts[0].trim();
      const val = parts.slice(1).join(':').trim();
      if (val) {
        meta[currentKey] = val;
      } else {
        // likely an array coming next
        meta[currentKey] = [];
      }
    }
  }
  return meta;
}

function findMdFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(file => file.endsWith('.md') && file !== 'README.md')
    .map(file => path.join(dir, file));
}

async function runAudit() {
  console.log('🔍 Starting Content Traceability Audit...');

  const externalFiles = [
    ...findMdFiles(GROWTH_DIR),
    ...findMdFiles(SUPPORT_DIR)
  ];

  const coreDirs = [STRATEGY_DIR, INTELLIGENCE_DIR, ENGINEERING_DIR, PRODUCT_DIR];
  const coreFiles = new Set();
  
  // Collect all core documents recursively (simplified 1 level here)
  coreDirs.forEach(dir => {
    if (fs.existsSync(dir)) {
      fs.readdirSync(dir).forEach(file => {
        if (file.endsWith('.md') && !file.includes('README')) {
           // Basic mapping. Realistically we might search deeply.
           coreFiles.add(path.relative(ROOT_DIR, path.join(dir, file)));
        }
      });
      // also check Specs
      const specsDir = path.join(dir, 'Specs');
      if (fs.existsSync(specsDir)) {
          fs.readdirSync(specsDir).forEach(file => {
            if (file.endsWith('.md')) coreFiles.add(path.relative(ROOT_DIR, path.join(specsDir, file)));
          });
      }
    }
  });

  const matrix = {
    orphaned: [],
    outdated: [],
    healthy: []
  };

  const coreUsage = new Map();
  coreFiles.forEach(f => coreUsage.set(f, []));

  for (const filepath of externalFiles) {
    const relPath = path.relative(ROOT_DIR, filepath);
    const content = fs.readFileSync(filepath, 'utf8');
    const meta = parseFrontmatter(content);
    
    if (!meta.source_docs || !Array.isArray(meta.source_docs) || meta.source_docs.length === 0) {
      matrix.orphaned.push(relPath);
      continue;
    }

    const articleTime = getGitModTime(filepath);
    let isOutdated = false;
    let staleReason = '';

    for (const source of meta.source_docs) {
      const sourceAbs = path.join(ROOT_DIR, source);
      if (!fs.existsSync(sourceAbs)) {
        matrix.orphaned.push(`${relPath} (Missing Source: ${source})`);
        break; // Count as orphaned if source is totally missing
      }

      // Track usage
      if (coreUsage.has(source)) {
         coreUsage.get(source).push(relPath);
      } else {
         coreUsage.set(source, [relPath]);
      }

      const sourceTime = getGitModTime(sourceAbs);
      if (sourceTime > articleTime) {
         isOutdated = true;
         staleReason = source;
      }
    }

    if (isOutdated && !matrix.orphaned.includes(relPath)) {
      matrix.outdated.push({ file: relPath, outdatedBy: staleReason });
    } else if (!matrix.orphaned.includes(relPath)) {
      matrix.healthy.push(relPath);
    }
  }

  // Under-utilized IP Check
  const unusedIP = [];
  for (const [coreFile, users] of coreUsage.entries()) {
     if (users.length === 0) {
        unusedIP.push(coreFile);
     }
  }

  // Generate Report
  const now = new Date().toISOString();
  let ms = `# Content Traceability Matrix 溯源总控表\n\n`;
  ms += `> 这是一份由 \`/content-audit\` 命令自动生成的核心物料与外部发布内容追踪表。\n`;
  ms += `> **生成时间**: ${now}\n\n`;

  ms += `## 🚨 预警区：逻辑过期风险 (Outdated)\n\n`;
  ms += `底层战略/工程文档已经更新，对应的外部内容需要复核以防止文案逻辑冲突。\n\n`;
  if (matrix.outdated.length === 0) ms += `- *当前无过期内容 / All Synced*\n`;
  matrix.outdated.forEach(item => {
    ms += `- 🔴 [\`${item.file}\`](../../${item.file}) -> 需复核底层更新 \`${item.outdatedBy}\`\n`;
  });

  ms += `\n## ⚠️ 预警区：孤儿内容 (Orphaned)\n\n`;
  ms += `缺乏底层文档支撑（没有 source_docs 字段或指向丢失）。属于纯脑洞散点营销，需绑定源头。\n\n`;
  if (matrix.orphaned.length === 0) ms += `- *无孤儿内容 / No Orphans*\n`;
  matrix.orphaned.forEach(item => {
    ms += `- 🟠 [\`${item}\`](../../${item})\n`;
  });

  ms += `\n## 💡 IP 闲置榜 (Under-utilized Internal Docs)\n\n`;
  ms += `以下高价值的内部战略或工程架构，尚未被转化为任意一篇对外 Growth 营销或客服物料。\n\n`;
  if (unusedIP.length === 0) ms += `- *资产全覆盖*\n`;
  unusedIP.forEach(item => {
    ms += `- 🔵 [\`${item}\`](../../${item})\n`;
  });

  ms += `\n## ✅ 健康溯源映射表 (Healthy Reference Map)\n\n`;
  // Group by core
  for (const [coreFile, users] of coreUsage.entries()) {
     if (users.length > 0) {
        ms += `### [\`${coreFile}\`](../../${coreFile})\n`;
        users.forEach(u => ms += `- -> \`${u}\`\n`);
        ms += `\n`;
     }
  }

  fs.writeFileSync(OUTPUT_FILE, ms, 'utf8');
  console.log(`✅ Traceability Matrix Generated at: ${OUTPUT_FILE}`);
}

runAudit();
