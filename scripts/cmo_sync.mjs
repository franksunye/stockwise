import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import yaml from 'yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.resolve(__dirname, '..');
const GROWTH_CONTENT_DIR = path.join(PROJECT_ROOT, 'docs', '4_Growth_Ops', 'content');
const SUPPORT_CONTENT_DIR = path.join(PROJECT_ROOT, 'docs', '5_Support_Ops', 'content');
const CORE_DOC_DIRS = [
  path.join(PROJECT_ROOT, 'docs', '0_Strategy'),
  path.join(PROJECT_ROOT, 'docs', '1_Engineering'),
  path.join(PROJECT_ROOT, 'docs', '2_Intelligence'),
  path.join(PROJECT_ROOT, 'docs', '3_Product')
];

const MASTER_FILE = path.join(GROWTH_CONTENT_DIR, 'README.md');
const VIEWS_DIR = path.join(GROWTH_CONTENT_DIR, '_views');
const PIPELINE_FILE = path.join(VIEWS_DIR, 'pipeline.md');
const NEXT_RELEASE_FILE = path.join(VIEWS_DIR, 'next-release.md');
const RECENTLY_UPDATED_FILE = path.join(VIEWS_DIR, 'recently-updated.md');
const CHANGE_IMPACT_FILE = path.join(VIEWS_DIR, 'change-impact.md');
const EXTERNAL_MAINTENANCE_FILE = path.join(VIEWS_DIR, 'external-maintenance.md');

const SKIP_DIRS = new Set(['archive', 'marketing', '_views']);
const EXCLUDED_FILES = new Set([
  'CONTENT_ASSET_TEMPLATE.md',
  'ZISO_101_SYLLABUS.md',
  'March_Content_Matrix_Execution_2026.md',
  'April_Content_Matrix_Engineering_2026.md'
]);
const STAGE_ORDER = ['planned', 'drafting', 'reviewing', 'approved', 'scheduled', 'published', 'archived'];
const STAGE_LABELS = {
  planned: '🧠 待策划',
  drafting: '✍️ 生产中',
  reviewing: '👀 待审核',
  approved: '✅ 已通过',
  scheduled: '📅 已排期',
  published: '🚀 已发布',
  archived: '📦 已归档'
};
const PRIORITY_LABELS = {
  high: '高',
  medium: '中',
  low: '低'
};
const CAMPAIGN_ROLE_LABELS = {
  hook: '破圈钩子',
  bridge: '信任桥梁',
  conversion: '转化承接'
};
const REVIEW_PRIORITY_LABELS = {
  review_first: '建议先审',
  review_next: '次优先审',
  ready_later: '基本可发'
};
const CHANNEL_LABELS = {
  website: '网站',
  wechat: '公众号',
  xhs: '小红书',
  twitter: 'Twitter',
  toutiao: '头条号'
};
const STATUS_LABELS = {
  live: '✅ 上线中',
  hidden: '🙈 隐藏',
  ready: '🟢 就绪',
  published: '✅ 已发布',
  scheduled: '⏳ 待发布',
  draft: '📝 草稿',
  none: '➖ 不发布',
  old: '📦 历史归档'
};

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function parseFrontmatter(fileContent) {
  const match = fileContent.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  try {
    return yaml.parse(match[1]) || {};
  } catch (error) {
    console.error(`Error parsing YAML frontmatter: ${error.message}`);
    return null;
  }
}

function walkMarkdownFiles(dirPath, files = []) {
  if (!fs.existsSync(dirPath)) return files;

  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walkMarkdownFiles(fullPath, files);
      continue;
    }

    if (
      entry.name.endsWith('.md') &&
      entry.name !== 'README.md' &&
      !EXCLUDED_FILES.has(entry.name)
    ) {
      files.push(fullPath);
    }
  }

  return files;
}

function walkCoreDocs(dirPath, files = []) {
  if (!fs.existsSync(dirPath)) return files;

  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === 'archive') continue;
      walkCoreDocs(fullPath, files);
      continue;
    }

    if (entry.name.endsWith('.md') && entry.name !== 'README.md') {
      files.push(fullPath);
    }
  }

  return files;
}

function getRelativePath(filePath, fromPath) {
  return path.relative(path.dirname(fromPath), filePath).replace(/\\/g, '/');
}

function getGitTimestamp(filePath) {
  try {
    const relativePath = path.relative(PROJECT_ROOT, filePath);
    const output = execSync(
      `cd "${PROJECT_ROOT}" && git log -1 --format="%ct" -- "${relativePath}"`,
      { encoding: 'utf8' }
    ).trim();

    if (output) return Number.parseInt(output, 10) * 1000;
  } catch (_error) {
    // Fall through to filesystem mtime.
  }

  return fs.statSync(filePath).mtimeMs;
}

function formatDate(dateLike) {
  if (!dateLike) return '';
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return '';

  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateWithWeekday(dateLike) {
  const normalized = formatDate(dateLike);
  if (!normalized) return '';

  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return normalized;

  const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()];
  return `${normalized} ${weekday}`;
}

function formatDateTime(dateLike) {
  if (!dateLike) return '';
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleString('zh-CN', { hour12: false, timeZone: 'Asia/Shanghai' });
}

function parsePlannedDate(value) {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const asDate = new Date(trimmed);
  if (Number.isNaN(asDate.getTime())) return null;
  return asDate;
}

function normalizeStage(meta, distribution) {
  const explicitStage = meta.workflow?.stage;
  if (explicitStage) return explicitStage;

  const hasPublishedChannel = Object.values(distribution).some(
    (channel) => channel?.status === 'published'
  );
  if (hasPublishedChannel) return 'published';

  const onlyWebsiteIsLive = distribution.website?.status === 'live' &&
    ['wechat', 'xhs', 'twitter', 'toutiao'].every(
      (channel) => !distribution[channel] || distribution[channel].status === 'none'
    );
  if (onlyWebsiteIsLive) return 'published';

  const hasScheduledChannel = Object.values(distribution).some(
    (channel) => channel?.status === 'scheduled'
  );
  if (hasScheduledChannel) return 'scheduled';

  const hasDraftChannel = Object.values(distribution).some(
    (channel) => channel?.status === 'draft'
  );
  if (hasDraftChannel) return 'drafting';

  return 'planned';
}

function normalizeDistribution(meta) {
  const output = {
    website: {
      enabled: meta.website?.enabled !== false,
      status: meta.website?.status || (meta.website?.enabled === false ? 'hidden' : 'live')
    }
  };

  const rawDistribution = meta.distribution || meta.publish || {};

  for (const channel of ['wechat', 'xhs', 'twitter', 'toutiao']) {
    const raw = rawDistribution[channel];

    if (!raw) {
      output[channel] = { enabled: false, status: 'none', url: '', scheduled_at: '', published_at: '' };
      continue;
    }

    if (typeof raw === 'string') {
      output[channel] = { enabled: raw !== 'none', status: raw, url: '', scheduled_at: '', published_at: '' };
      continue;
    }

    const status = raw.status || 'draft';
    output[channel] = {
      enabled: raw.enabled !== false && status !== 'none',
      status,
      url: raw.url || '',
      scheduled_at: raw.scheduled_at || '',
      published_at: raw.published_at || raw.date || '',
      baseline: raw.baseline || ''
    };
  }

  return output;
}

function formatChannelStatus(channelData) {
  if (!channelData) return STATUS_LABELS.none;
  const label = STATUS_LABELS[channelData.status] || STATUS_LABELS.draft;

  if (channelData.status === 'published' && channelData.url) {
    return `[${label}](${channelData.url})`;
  }

  if (channelData.status === 'scheduled' && channelData.scheduled_at) {
    return `${label}<br>${channelData.scheduled_at}`;
  }

  return label;
}

function normalizeContentItem(filePath, sourceRootName) {
  const fileContent = fs.readFileSync(filePath, 'utf8');
  const meta = parseFrontmatter(fileContent);
  if (meta === null) return null;
  const distribution = normalizeDistribution(meta);
  const gitTimestamp = getGitTimestamp(filePath);
  const workflowLastActionAt = meta.workflow?.last_action_at || '';
  const lastActionAt = formatDate(workflowLastActionAt || gitTimestamp);
  const targetPublishDate = meta.workflow?.target_publish_date || meta.date || '';

  return {
    title: meta.title || path.basename(filePath, '.md'),
    filePath,
    relativeToMaster: getRelativePath(filePath, MASTER_FILE),
    relativeToPipeline: getRelativePath(filePath, PIPELINE_FILE),
    relativeToNextRelease: getRelativePath(filePath, NEXT_RELEASE_FILE),
    relativeToRecentlyUpdated: getRelativePath(filePath, RECENTLY_UPDATED_FILE),
    relativeToChangeImpact: getRelativePath(filePath, CHANGE_IMPACT_FILE),
    relativeToExternalMaintenance: getRelativePath(filePath, EXTERNAL_MAINTENANCE_FILE),
    contentId: meta.content_id || '',
    contentSource: meta.content_source || sourceRootName,
    contentType: meta.content_type || 'article',
    canonicalRole: meta.canonical_role || 'canonical',
    category: meta.category || 'Uncategorized',
    funnelStage: meta.funnel_stage || 'Unknown',
    campaignRole: meta.campaign_role || '',
    campaign: meta.campaign || '',
    sourceDocs: Array.isArray(meta.source_docs) ? meta.source_docs : [],
    traceabilityStatus: meta.traceability?.status || (Array.isArray(meta.source_docs) && meta.source_docs.length > 0 ? 'healthy' : 'missing'),
    workflowStage: normalizeStage(meta, distribution),
    reviewPriority: meta.workflow?.review_priority || '',
    owner: meta.workflow?.owner || '',
    reviewer: meta.workflow?.reviewer || '',
    priority: meta.workflow?.priority || 'medium',
    targetPublishDate,
    targetPublishDateParsed: parsePlannedDate(targetPublishDate),
    wechatPublishedAt: distribution.wechat?.published_at || '',
    wechatBaseline: distribution.wechat?.baseline || '',
    lastActionAt,
    workflowLastActionAt,
    workflowLastActionTimestamp: workflowLastActionAt ? new Date(workflowLastActionAt).getTime() : 0,
    lastActionTimestamp: gitTimestamp,
    blockedReason: meta.workflow?.blocked_reason || '',
    maintenanceStatus: meta.maintenance?.change_status || 'stable',
    maintenanceReason: meta.maintenance?.update_reason || '',
    externalAction: meta.maintenance?.external_action || '',
    externalNote: meta.maintenance?.external_note || '',
    externalStatus: meta.maintenance?.external_status || 'pending',
    contentLifecycleStatus: meta.content_lifecycle?.status || 'active',
    supersededBy: meta.content_lifecycle?.superseded_by || '',
    websiteSurface: meta.website?.surface || (sourceRootName === 'support' ? 'support' : 'learn'),
    distribution
  };
}

function formatCampaignRole(role) {
  return CAMPAIGN_ROLE_LABELS[role] || '-';
}

function formatReviewPriority(priority) {
  return REVIEW_PRIORITY_LABELS[priority] || '-';
}

function getDisplayDate(item) {
  if (item.wechatPublishedAt) return formatDateWithWeekday(item.wechatPublishedAt);
  return formatDateWithWeekday(item.targetPublishDate) || 'N/A';
}

function loadAllContentItems() {
  const growthFiles = walkMarkdownFiles(GROWTH_CONTENT_DIR);
  const supportFiles = walkMarkdownFiles(SUPPORT_CONTENT_DIR);

  return [
    ...growthFiles.map((filePath) => normalizeContentItem(filePath, 'growth')),
    ...supportFiles.map((filePath) => normalizeContentItem(filePath, 'support'))
  ].filter(Boolean);
}

function sortByTargetDateThenTitle(items) {
  return [...items].sort((a, b) => {
    const aDate = a.targetPublishDate || '9999-12-31';
    const bDate = b.targetPublishDate || '9999-12-31';

    if (aDate !== bDate) return aDate.localeCompare(bDate);
    return a.title.localeCompare(b.title, 'zh-CN');
  });
}

function sortByDisplayDateThenTitle(items) {
  return [...items].sort((a, b) => {
    const aDate = getDisplayDate(a) || '9999-12-31';
    const bDate = getDisplayDate(b) || '9999-12-31';

    if (aDate !== bDate) return aDate.localeCompare(bDate);
    return a.title.localeCompare(b.title, 'zh-CN');
  });
}

function sortByLastActionDesc(items) {
  return [...items].sort((a, b) => b.lastActionTimestamp - a.lastActionTimestamp);
}

function sortByWechatPublishedOrLastActionDesc(items) {
  return [...items].sort((a, b) => {
    const aDate = a.wechatPublishedAt || a.lastActionAt || '';
    const bDate = b.wechatPublishedAt || b.lastActionAt || '';
    return bDate.localeCompare(aDate);
  });
}

function isWechatPublished(item) {
  return item.distribution.wechat?.status === 'published' || Boolean(item.wechatPublishedAt);
}

function isWechatFrontlineBaseline(item) {
  return item.wechatBaseline === 'frontline_q1_2026';
}

function markdownTable(headers, rows) {
  const head = `| ${headers.join(' | ')} |`;
  const divider = `| ${headers.map(() => '---').join(' | ')} |`;
  const body = rows.map((row) => `| ${row.join(' | ')} |`).join('\n');
  return [head, divider, body].filter(Boolean).join('\n');
}

function itemLink(item, target = 'master') {
  const relativePathByTarget = {
    master: item.relativeToMaster,
    pipeline: item.relativeToPipeline,
    next: item.relativeToNextRelease,
    recent: item.relativeToRecentlyUpdated,
    change: item.relativeToChangeImpact,
    external: item.relativeToExternalMaintenance
  };

  return `[${item.title}](${relativePathByTarget[target] || item.relativeToMaster})`;
}

function renderMasterRegistry(items, generatedAt) {
  const rows = sortByDisplayDateThenTitle(items).map((item) => [
    itemLink(item, 'master'),
    item.contentSource === 'growth' ? 'Growth' : 'Support',
    item.contentType,
    item.funnelStage,
    formatCampaignRole(item.campaignRole),
    STAGE_LABELS[item.workflowStage] || item.workflowStage,
    getDisplayDate(item),
    formatChannelStatus(item.distribution.website),
    formatChannelStatus(item.distribution.wechat),
    item.lastActionAt || 'N/A'
  ]);

  let output = '# 内容运营主索引 (Content Operations Registry)\n\n';
  output += `> 自动生成时间：${generatedAt}\n`;
  output += '> 说明：本索引由 `scripts/cmo_sync.mjs` 统一扫描 `4_Growth_Ops/content` 与 `5_Support_Ops/content` 生成。\n';
  output += '> 日期规则：已发布内容优先显示公众号真实发布日期；未发布内容显示目标发布日期。\n';
  output += '> 视图：';
  output += `[_Pipeline_](${getRelativePath(PIPELINE_FILE, MASTER_FILE)}) · `;
  output += `[_Next Release_](${getRelativePath(NEXT_RELEASE_FILE, MASTER_FILE)}) · `;
  output += `[_Recently Updated_](${getRelativePath(RECENTLY_UPDATED_FILE, MASTER_FILE)}) · `;
  output += `[_Change Impact_](${getRelativePath(CHANGE_IMPACT_FILE, MASTER_FILE)}) · `;
  output += `[_External Maintenance_](${getRelativePath(EXTERNAL_MAINTENANCE_FILE, MASTER_FILE)})\n\n`;
  output += markdownTable(
    ['标题', '来源', '类型', '漏斗', '战役角色', '主流程', '关键日期', '网站', '公众号', '最近动作'],
    rows
  );
  output += '\n';
  return output;
}

function renderPipelineBoard(items, generatedAt) {
  let output = '# 内容生产流程看板 (Pipeline Board)\n\n';
  output += `> 自动生成时间：${generatedAt}\n`;
  output += '> 说明：本看板优先服务活跃工作流，只展开需要推进的阶段；已发布内容只保留最近概览，避免看板膨胀。\n\n';

  for (const stage of ['planned', 'drafting', 'reviewing', 'approved', 'scheduled']) {
    const stageItems = sortByTargetDateThenTitle(
      items.filter((item) => item.workflowStage === stage)
    );
    output += `## ${STAGE_LABELS[stage] || stage}\n\n`;

    if (stageItems.length === 0) {
      output += '- 暂无内容\n\n';
      continue;
    }

    output += markdownTable(
      ['标题', '来源', '漏斗', '战役角色', '审核优先级', '优先级', 'Owner', 'Reviewer', '目标日期', '公众号', '阻塞原因'],
      stageItems.map((item) => [
        itemLink(item, 'pipeline'),
        item.contentSource === 'growth' ? 'Growth' : 'Support',
        item.funnelStage,
        formatCampaignRole(item.campaignRole),
        formatReviewPriority(item.reviewPriority),
        PRIORITY_LABELS[item.priority] || item.priority,
        item.owner || '-',
        item.reviewer || '-',
        formatDateWithWeekday(item.targetPublishDate) || 'N/A',
        formatChannelStatus(item.distribution.wechat),
        item.blockedReason || '-'
      ])
    );
    output += '\n\n';
  }

  const publishedItems = items.filter((item) => item.workflowStage === 'published');
  const wechatPublishedItems = sortByWechatPublishedOrLastActionDesc(
    publishedItems.filter((item) => isWechatPublished(item))
  );
  const frontlineBaselineItems = wechatPublishedItems.filter((item) => isWechatFrontlineBaseline(item));
  const otherPublishedItems = sortByWechatPublishedOrLastActionDesc(
    publishedItems.filter((item) => !isWechatPublished(item))
  );
  const recentlyPublished = [...wechatPublishedItems, ...otherPublishedItems].slice(0, 20);

  output += `## ${STAGE_LABELS.published}\n\n`;
  output += `- 已发布资产总数：${items.filter((item) => item.workflowStage === 'published').length}\n`;
  output += `- 系统识别公众号已发布：${wechatPublishedItems.length} 篇\n`;
  output += `- 已确认公众号前线基线：${frontlineBaselineItems.length} 篇\n`;
  output += '- 看板优先展示公众号已发布内容，其次补充仅网站上线的内容；完整清单请看主索引。\n\n';

  if (recentlyPublished.length === 0) {
    output += '- 暂无内容\n\n';
  } else {
    output += markdownTable(
      ['标题', '来源', '最后动作', '网站', '公众号'],
      recentlyPublished.map((item) => [
        itemLink(item, 'pipeline'),
        item.contentSource === 'growth' ? 'Growth' : 'Support',
        formatDateWithWeekday(item.wechatPublishedAt || item.lastActionAt) || 'N/A',
        formatChannelStatus(item.distribution.website),
        formatChannelStatus(item.distribution.wechat)
      ])
    );
    output += '\n\n';
  }

  output += `## ${STAGE_LABELS.archived}\n\n`;
  output += `- 已归档资产总数：${items.filter((item) => item.workflowStage === 'archived').length}\n\n`;

  return output;
}

function getNextFourWeekRange() {
  const now = new Date();
  const day = now.getDay();
  const daysUntilNextMonday = day === 0 ? 1 : 8 - day;

  const start = new Date(now);
  start.setDate(now.getDate() + daysUntilNextMonday);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + (4 * 7) - 1);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

function isWithinRange(date, start, end) {
  if (!date) return false;
  return date >= start && date <= end;
}

function renderNextReleaseBoard(items, generatedAt) {
  const { start, end } = getNextFourWeekRange();
  const campaignItems = sortByTargetDateThenTitle(
    items.filter(
      (item) =>
        item.campaign === 'wechat_4_week_sprint_2026q2' &&
        item.distribution.wechat?.enabled &&
        isWithinRange(item.targetPublishDateParsed, start, end)
    )
  );

  const readyForWechat = sortByTargetDateThenTitle(
    items.filter((item) => {
      const wechat = item.distribution.wechat;
      return (
        ['approved', 'scheduled'].includes(item.workflowStage) &&
        wechat.enabled &&
        wechat.status === 'ready' &&
        isWithinRange(item.targetPublishDateParsed, start, end)
      );
    })
  );

  const scheduledForWechat = sortByTargetDateThenTitle(
    items.filter((item) => {
      const wechat = item.distribution.wechat;
      return (
        ['approved', 'scheduled', 'published'].includes(item.workflowStage) &&
        wechat.enabled &&
        ['scheduled', 'published'].includes(wechat.status) &&
        isWithinRange(item.targetPublishDateParsed, start, end)
      );
    })
  );

  let output = '# 未来 4 周发布队列 (Next 4-Week Release Queue)\n\n';
  output += `> 自动生成时间：${generatedAt}\n`;
  output += `> 规划窗口：${formatDateWithWeekday(start)} 至 ${formatDateWithWeekday(end)}\n`;
  output += '> 说明：本视图分成两层。第一层展示未来 4 周公众号战役排期；第二层展示窗口内已经达到执行条件的操作清单。\n\n';

  output += '## 未来 4 周公众号战役排期\n\n';
  if (campaignItems.length === 0) {
    output += '- 当前无已编入战役的公众号内容\n\n';
  } else {
    output += markdownTable(
      ['目标日期', '标题', '来源', '漏斗', '战役角色', '审核优先级', '主流程', 'Owner', 'Reviewer', '公众号状态'],
      campaignItems.map((item) => [
        formatDateWithWeekday(item.targetPublishDate) || 'N/A',
        itemLink(item, 'next'),
        item.contentSource === 'growth' ? 'Growth' : 'Support',
        item.funnelStage,
        formatCampaignRole(item.campaignRole),
        formatReviewPriority(item.reviewPriority),
        STAGE_LABELS[item.workflowStage] || item.workflowStage,
        item.owner || '-',
        item.reviewer || '-',
        formatChannelStatus(item.distribution.wechat)
      ])
    );
    output += '\n\n';
  }

  output += '## 公众号待排期但已就绪\n\n';
  if (readyForWechat.length === 0) {
    output += '- 当前无符合条件的内容\n\n';
  } else {
    output += markdownTable(
      ['标题', '来源', '漏斗', '战役角色', '审核优先级', '主流程', '目标日期', 'Owner', 'Reviewer', '公众号状态'],
      readyForWechat.map((item) => [
        itemLink(item, 'next'),
        item.contentSource === 'growth' ? 'Growth' : 'Support',
        item.funnelStage,
        formatCampaignRole(item.campaignRole),
        formatReviewPriority(item.reviewPriority),
        STAGE_LABELS[item.workflowStage] || item.workflowStage,
        formatDateWithWeekday(item.targetPublishDate) || 'N/A',
        item.owner || '-',
        item.reviewer || '-',
        formatChannelStatus(item.distribution.wechat)
      ])
    );
    output += '\n\n';
  }

  output += '## 公众号已排期/已发布\n\n';
  if (scheduledForWechat.length === 0) {
    output += '- 当前无符合条件的内容\n\n';
  } else {
    output += markdownTable(
      ['标题', '来源', '漏斗', '战役角色', '审核优先级', '主流程', '目标日期', '公众号状态'],
      scheduledForWechat.map((item) => [
        itemLink(item, 'next'),
        item.contentSource === 'growth' ? 'Growth' : 'Support',
        item.funnelStage,
        formatCampaignRole(item.campaignRole),
        formatReviewPriority(item.reviewPriority),
        STAGE_LABELS[item.workflowStage] || item.workflowStage,
        formatDateWithWeekday(item.targetPublishDate) || 'N/A',
        formatChannelStatus(item.distribution.wechat)
      ])
    );
    output += '\n\n';
  }

  return output;
}

function renderRecentlyUpdatedBoard(items, generatedAt) {
  const recentItems = sortByLastActionDesc(items).slice(0, 30);

  let output = '# 最近修订内容 (Recently Updated)\n\n';
  output += `> 自动生成时间：${generatedAt}\n`;
  output += '> 说明：按最近 Git 变更时间排序，帮助团队快速识别近期被修改或维护的内容资产。\n\n';

  output += markdownTable(
    ['标题', '来源', '漏斗', '最后动作', '维护状态', '修订原因', '主流程', '溯源'],
    recentItems.map((item) => [
      itemLink(item, 'recent'),
      item.contentSource === 'growth' ? 'Growth' : 'Support',
      item.funnelStage,
      item.lastActionAt || 'N/A',
      item.maintenanceStatus,
      item.maintenanceReason || '-',
      STAGE_LABELS[item.workflowStage] || item.workflowStage,
      item.traceabilityStatus
    ])
  );
  output += '\n';

  return output;
}

function buildChangeImpact(items) {
  const affected = [];
  const usedCoreDocs = new Map();
  const coreDocs = CORE_DOC_DIRS.flatMap((dirPath) => walkCoreDocs(dirPath));

  for (const coreDocPath of coreDocs) {
    usedCoreDocs.set(path.relative(PROJECT_ROOT, coreDocPath).replace(/\\/g, '/'), []);
  }

  for (const item of items) {
    let newestSourceDoc = null;
    let newestSourceTimestamp = 0;

    for (const sourceDoc of item.sourceDocs) {
      const sourceDocPath = path.join(PROJECT_ROOT, sourceDoc);
      if (!fs.existsSync(sourceDocPath)) continue;

      const sourceTimestamp = getGitTimestamp(sourceDocPath);
      if (sourceTimestamp > newestSourceTimestamp) {
        newestSourceTimestamp = sourceTimestamp;
        newestSourceDoc = sourceDoc;
      }

      if (usedCoreDocs.has(sourceDoc)) {
        usedCoreDocs.get(sourceDoc).push(item);
      } else {
        usedCoreDocs.set(sourceDoc, [item]);
      }
    }

    if (newestSourceDoc && newestSourceTimestamp > item.lastActionTimestamp) {
      affected.push({
        item,
        sourceDoc: newestSourceDoc,
        sourceDocTimestamp: newestSourceTimestamp
      });
    }
  }

  const unusedCoreDocs = [...usedCoreDocs.entries()]
    .filter(([, linkedItems]) => linkedItems.length === 0)
    .map(([docPath]) => docPath)
    .sort((a, b) => a.localeCompare(b, 'zh-CN'))
    .slice(0, 30);

  return {
    affected: affected.sort((a, b) => b.sourceDocTimestamp - a.sourceDocTimestamp),
    unusedCoreDocs
  };
}

function getExternalPublishedChannels(item) {
  return ['wechat', 'xhs', 'twitter', 'toutiao'].filter((channel) => {
    const channelData = item.distribution[channel];
    return channelData && (channelData.status === 'published' || Boolean(channelData.published_at));
  });
}

function getLatestExternalPublishedAt(item) {
  const publishedAtCandidates = getExternalPublishedChannels(item)
    .map((channel) => item.distribution[channel]?.published_at)
    .filter(Boolean)
    .map((dateString) => new Date(dateString))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((a, b) => b.getTime() - a.getTime());

  return publishedAtCandidates[0] || null;
}

function renderSupersededBy(item) {
  if (!item.supersededBy) return '-';
  return `\`${item.supersededBy}\``;
}

function inferExternalAction(item) {
  if (item.externalAction) return item.externalAction;
  if (item.contentLifecycleStatus === 'superseded') return 'publish_replacement';
  if (item.maintenanceReason === 'product_change') return 'publish_replacement';
  if (item.maintenanceStatus === 'review_needed') return 'refresh_existing';
  return 'verify_sync';
}

function externalActionLabel(action) {
  const labels = {
    verify_sync: '核对同步',
    refresh_existing: '刷新旧文',
    publish_replacement: '发布替代文',
    archive_only: '仅归档'
  };
  return labels[action] || action;
}

function externalStatusLabel(status) {
  const labels = {
    pending: '待处理',
    in_progress: '处理中',
    completed: '已处理'
  };
  return labels[status] || status;
}

function buildExternalMaintenance(items) {
  const { affected } = buildChangeImpact(items);
  const affectedBySourceDoc = new Map(
    affected.map(({ item, sourceDoc }) => [item.filePath, sourceDoc])
  );

  const queue = [];

  for (const item of items) {
    const externalChannels = getExternalPublishedChannels(item);
    if (externalChannels.length === 0) continue;

    const latestPublishedAt = getLatestExternalPublishedAt(item);
    const reasons = [];

    if (affectedBySourceDoc.has(item.filePath)) {
      reasons.push(`底层文档已更新：\`${affectedBySourceDoc.get(item.filePath)}\``);
    }

    if (
      latestPublishedAt &&
      item.workflowLastActionTimestamp &&
      item.workflowLastActionTimestamp > latestPublishedAt.getTime()
    ) {
      reasons.push('站内内容晚于外部发布日期，需检查外部口径是否已过时');
    }

    if (item.maintenanceStatus === 'review_needed') {
      reasons.push(`已显式标记待复核${item.maintenanceReason ? `：${item.maintenanceReason}` : ''}`);
    }

    if (item.contentLifecycleStatus === 'superseded') {
      reasons.push('内容已被新口径替代');
    }

    if (reasons.length === 0 && item.externalStatus !== 'completed') continue;

    queue.push({
      item,
      externalChannels,
      latestPublishedAt,
      reasons
    });
  }

  return queue.sort((a, b) => {
    const aTime = a.latestPublishedAt?.getTime() || 0;
    const bTime = b.latestPublishedAt?.getTime() || 0;
    if (aTime !== bTime) return aTime - bTime;
    return a.item.title.localeCompare(b.item.title, 'zh-CN');
  });
}

function renderChangeImpactBoard(items, generatedAt) {
  const { affected, unusedCoreDocs } = buildChangeImpact(items);

  let output = '# 产品变更影响视图 (Change Impact Board)\n\n';
  output += `> 自动生成时间：${generatedAt}\n`;
  output += '> 说明：该视图用于回答“产品/工程文档变化后，哪些内容应该复核或补充”。\n\n';

  output += '## 受底层文档变更影响，需优先复核的内容\n\n';
  if (affected.length === 0) {
    output += '- 当前无检测到受影响内容\n\n';
  } else {
    output += markdownTable(
      ['内容资产', '来源', '主流程', '受影响源文档'],
      affected.slice(0, 50).map(({ item, sourceDoc }) => [
        itemLink(item, 'change'),
        item.contentSource === 'growth' ? 'Growth' : 'Support',
        STAGE_LABELS[item.workflowStage] || item.workflowStage,
        `\`${sourceDoc}\``
      ])
    );
    output += '\n\n';
  }

  output += '## 尚未被转化成内容资产的内部文档机会\n\n';
  if (unusedCoreDocs.length === 0) {
    output += '- 当前无闲置内部文档\n\n';
  } else {
    for (const docPath of unusedCoreDocs) {
      output += `- \`${docPath}\`\n`;
    }
    output += '\n';
  }

  output += '## 配套参考\n\n';
  output += `- [Content Traceability Matrix](../../44_Content_Traceability_Matrix.md)\n`;
  output += `- [Content Operations Master Guide](../../46_Content_Operations_System_Blueprint.md)\n`;
  output += `- [External Maintenance](./external-maintenance.md)\n`;

  return output;
}

function renderExternalMaintenanceBoard(items, generatedAt) {
  const queue = buildExternalMaintenance(items);
  const actionCounts = new Map();
  const statusCounts = new Map();

  const activeQueue = queue.filter(({ item }) => item.externalStatus !== 'completed');
  const completedQueue = queue.filter(({ item }) => item.externalStatus === 'completed');

  activeQueue.forEach(({ item }) => {
    const action = inferExternalAction(item);
    actionCounts.set(action, (actionCounts.get(action) || 0) + 1);
    statusCounts.set(item.externalStatus, (statusCounts.get(item.externalStatus) || 0) + 1);
  });

  let output = '# 外部内容维护队列 (External Maintenance Queue)\n\n';
  output += `> 自动生成时间：${generatedAt}\n`;
  output += '> 说明：这张视图专门提醒“站内内容已更新，但站外已发布内容可能已过时”的维修任务。\n';
  output += '> 发现机制：底层 `source_docs` 变更、站内内容晚于外部发布日期、以及人工显式标记 `maintenance.review_needed`。\n\n';

  output += '## 维护动作概览\n\n';
  if (activeQueue.length === 0) {
    output += '- 当前无待维护任务\n\n';
  } else {
    for (const [action, count] of [...actionCounts.entries()].sort((a, b) => b[1] - a[1])) {
      output += `- ${externalActionLabel(action)}：${count} 篇\n`;
    }
    for (const [status, count] of [...statusCounts.entries()].sort((a, b) => b[1] - a[1])) {
      output += `- ${externalStatusLabel(status)}：${count} 篇\n`;
    }
    output += '\n';
  }

  output += '## 待复核的已发布外部内容\n\n';
  if (activeQueue.length === 0) {
    output += '- 当前无待维护的外部内容\n\n';
  } else {
    output += markdownTable(
      ['内容资产', '来源', '外部渠道', '最近外发', '处理状态', '建议动作', '触发原因', '替代关系'],
      activeQueue.map(({ item, externalChannels, latestPublishedAt, reasons }) => [
        itemLink(item, 'external'),
        item.contentSource === 'growth' ? 'Growth' : 'Support',
        externalChannels.map((channel) => CHANNEL_LABELS[channel] || channel).join(' / '),
        formatDateWithWeekday(latestPublishedAt) || 'N/A',
        `${externalStatusLabel(item.externalStatus)} / ${item.maintenanceStatus}`,
        item.externalNote
          ? `${externalActionLabel(inferExternalAction(item))}<br>${item.externalNote}`
          : externalActionLabel(inferExternalAction(item)),
        reasons.join('<br>'),
        renderSupersededBy(item)
      ])
    );
    output += '\n\n';
  }

  output += '## 已处理归档\n\n';
  if (completedQueue.length === 0) {
    output += '- 当前无已处理项目\n\n';
  } else {
    output += markdownTable(
      ['内容资产', '来源', '外部渠道', '最近外发', '处理状态', '建议动作', '替代关系'],
      completedQueue.map(({ item, externalChannels, latestPublishedAt }) => [
        itemLink(item, 'external'),
        item.contentSource === 'growth' ? 'Growth' : 'Support',
        externalChannels.map((channel) => CHANNEL_LABELS[channel] || channel).join(' / '),
        formatDateWithWeekday(latestPublishedAt) || 'N/A',
        `${externalStatusLabel(item.externalStatus)} / ${item.maintenanceStatus}`,
        externalActionLabel(inferExternalAction(item)),
        renderSupersededBy(item)
      ])
    );
    output += '\n\n';
  }

  output += '## 如何使用这张视图\n\n';
  output += '1. 先看“触发原因”，判断是底层文档变更、站内先更新，还是人工判定的语义变化。\n';
  output += '2. 决定动作：更新原外部文章、发新版替代文，或把旧文标记为历史版本。\n';
  output += '3. 开始处理时回写 `maintenance.external_status = in_progress`。\n';
  output += '4. 完成处理后，回写 `maintenance.external_status = completed`，并补齐新的外部渠道状态。\n';
  output += '5. 如果旧文已被新口径替代，再补 `content_lifecycle.superseded_by`。\n';

  return output;
}

function writeFile(filePath, contents) {
  fs.writeFileSync(filePath, contents, 'utf8');
  console.log(`✅ Wrote ${path.relative(PROJECT_ROOT, filePath)}`);
}

function main() {
  console.log('🔍 Building unified content operations views...');
  ensureDir(VIEWS_DIR);

  const items = loadAllContentItems();
  const generatedAt = formatDateTime(new Date());

  writeFile(MASTER_FILE, renderMasterRegistry(items, generatedAt));
  writeFile(PIPELINE_FILE, renderPipelineBoard(items, generatedAt));
  writeFile(NEXT_RELEASE_FILE, renderNextReleaseBoard(items, generatedAt));
  writeFile(RECENTLY_UPDATED_FILE, renderRecentlyUpdatedBoard(items, generatedAt));
  writeFile(CHANGE_IMPACT_FILE, renderChangeImpactBoard(items, generatedAt));
  writeFile(EXTERNAL_MAINTENANCE_FILE, renderExternalMaintenanceBoard(items, generatedAt));

  console.log(`✅ Unified content registry built for ${items.length} assets.`);
}

main();
