import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import url from 'url';
import yaml from 'yaml';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');

const GROWTH_DIR = path.join(ROOT_DIR, 'docs/4_Growth_Ops/content');
const SUPPORT_DIR = path.join(ROOT_DIR, 'docs/5_Support_Ops/content');
const STRATEGY_DIR = path.join(ROOT_DIR, 'docs/0_Strategy');
const INTELLIGENCE_DIR = path.join(ROOT_DIR, 'docs/2_Intelligence');
const ENGINEERING_DIR = path.join(ROOT_DIR, 'docs/1_Engineering');
const PRODUCT_DIR = path.join(ROOT_DIR, 'docs/3_Product');

const OUTPUT_FILE = path.join(ROOT_DIR, 'docs/4_Growth_Ops/44_Content_Traceability_Matrix.md');
const EXCLUDED_EXTERNAL_FILES = new Set([
  'CONTENT_ASSET_TEMPLATE.md',
  'ZISO_101_SYLLABUS.md'
]);

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
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  try {
    return yaml.parse(match[1]) || {};
  } catch (_error) {
    return {};
  }
}

function findMdFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(file => file.endsWith('.md') && file !== 'README.md' && !EXCLUDED_EXTERNAL_FILES.has(file))
    .map(file => path.join(dir, file));
}

function findMdFilesRecursive(dir, files = []) {
  if (!fs.existsSync(dir)) return files;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === 'archive') continue;
      findMdFilesRecursive(fullPath, files);
      continue;
    }

    if (entry.name.endsWith('.md') && entry.name !== 'README.md') {
      files.push(fullPath);
    }
  }

  return files;
}

async function runAudit() {
  console.log('🔍 Starting Content Traceability Audit...');

  const externalFiles = [
    ...findMdFiles(GROWTH_DIR),
    ...findMdFiles(SUPPORT_DIR)
  ];

  const coreDirs = [STRATEGY_DIR, INTELLIGENCE_DIR, ENGINEERING_DIR, PRODUCT_DIR];
  const coreFiles = new Set();
  
  coreDirs.forEach(dir => {
    findMdFilesRecursive(dir).forEach(file => {
      coreFiles.add(path.relative(ROOT_DIR, file));
    });
  });

  const matrix = {
    orphaned: [],
    outdated: [],
    deprecatedSources: [],
    sourceMetadataMissing: [],
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
      const sourceMeta = parseFrontmatter(fs.readFileSync(sourceAbs, 'utf8'));
      const sourceStatus = sourceMeta.doc_status || sourceMeta.status || 'active';
      const missingFields = ['doc_id', 'doc_domain', 'doc_status'].filter((field) => !sourceMeta[field]);

      if (missingFields.length > 0) {
        matrix.sourceMetadataMissing.push({
          file: relPath,
          source,
          missingFields
        });
      }

      if (['deprecated', 'archived'].includes(sourceStatus)) {
        matrix.deprecatedSources.push({ file: relPath, source, status: sourceStatus });
      }

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

  ms += `\n## 🧭 预警区：引用了已废弃源文档 (Deprecated Sources)\n\n`;
  ms += `如果某篇内容仍然依赖已标记为 \`deprecated\` 或 \`archived\` 的上游文档，说明它的事实基础可能已不是现行版本。\n\n`;
  if (matrix.deprecatedSources.length === 0) ms += `- *当前无内容引用已废弃源文档*\n`;
  matrix.deprecatedSources.forEach(item => {
    ms += `- 🟣 [\`${item.file}\`](../../${item.file}) -> 引用了 \`${item.status}\` 源文档 \`${item.source}\`\n`;
  });

  ms += `\n## 🧱 预警区：引用了未补规范元数据的源文档 (Source Metadata Missing)\n\n`;
  ms += `如果某篇内容引用的上游文档还没有补齐 \`doc_id / doc_domain / doc_status\`，系统虽可追踪路径，但还不能稳定判断它是否属于现行事实源。\n\n`;
  if (matrix.sourceMetadataMissing.length === 0) {
    ms += `- *当前被引用的源文档都已具备最小元数据*\n`;
  } else {
    const groupedMissing = new Map();

    matrix.sourceMetadataMissing.forEach(item => {
      const existing = groupedMissing.get(item.source) || {
        missingFields: item.missingFields,
        files: []
      };
      existing.files.push(item.file);
      groupedMissing.set(item.source, existing);
    });

    [...groupedMissing.entries()]
      .sort((a, b) => b[1].files.length - a[1].files.length || a[0].localeCompare(b[0], 'zh-CN'))
      .forEach(([source, info]) => {
        const examples = info.files.slice(0, 3).map((file) => `\`${file}\``).join('、');
        ms += `- 🟡 \`${source}\` 缺少 ${info.missingFields.map((field) => `\`${field}\``).join(', ')}；当前影响 ${info.files.length} 篇内容`;
        if (examples) {
          ms += `（例如：${examples}）`;
        }
        ms += `\n`;
      });
  }

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
