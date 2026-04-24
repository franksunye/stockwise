import fs from 'fs';
import path from 'path';
import yaml from 'yaml';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const ENV_FILE = path.join(PROJECT_ROOT, '.env');

const GROWTH_CONTENT_DIR = path.join(PROJECT_ROOT, 'docs', '4_Growth_Ops', 'content');
const SUPPORT_CONTENT_DIR = path.join(PROJECT_ROOT, 'docs', '5_Support_Ops', 'content');

const SKIP_DIRS = new Set(['archive', 'marketing', '_views']);
const EXCLUDED_FILES = new Set([
  'CONTENT_ASSET_TEMPLATE.md',
  'ZISO_101_SYLLABUS.md',
  'MASTER_SERIES_MINI_SPEC.md',
  'March_Content_Matrix_Execution_2026.md',
  'April_Content_Matrix_Engineering_2026.md'
]);

const FEISHU_API = 'https://open.feishu.cn/open-apis';
const FIELD_LABEL_ZH = {
  content_id: '内容ID',
  title: '标题',
  path: '路径',
  content_source: '内容来源',
  content_category: '内容分类',
  distribution_category: '分发分类',
  governance_lane: '治理分层',
  ops_status: '运营状态',
  funnel_stage: '漏斗阶段',
  campaign: '战役',
  workflow_stage: '流程阶段',
  review_priority: '审核优先级',
  owner: '负责人',
  reviewer: '审核人',
  target_publish_date: '目标发布日期',
  wechat_enabled: '公众号启用',
  wechat_status: '公众号状态',
  wechat_published_at: '公众号发布时间',
  visual_stage: '视觉阶段',
  last_action_at: '最后动作时间',
  sync_time: '同步时间'
};

const FIELD_ALIASES = Object.fromEntries(
  Object.entries(FIELD_LABEL_ZH).map(([k, zh]) => [k, [k, zh]])
);

const SELECT_OPTION_LABEL_ZH = {
  content_source: {
    growth: '增长内容',
    support: '支持内容'
  },
  content_category: {
    academy_101: '101学院内容',
    master_series: '大师图鉴系列',
    support_ops: '产品支持内容',
    special_column: '专题栏目内容'
  },
  distribution_category: {
    campaign_distribution: '战役分发',
    regular_distribution: '常规分发'
  },
  governance_lane: {
    evergreen_core: '常青资产',
    support_reference: '支持知识库',
    campaign_operation: '分发运营项'
  },
  ops_status: {
    backlog: '待生产',
    in_production: '生产中',
    ready_to_publish: '待发布',
    published: '已发布'
  },
  funnel_stage: {
    TOFU: '认知层(TOFU)',
    MOFU: '评估层(MOFU)',
    BOFU: '转化层(BOFU)',
    Unknown: '未知'
  },
  workflow_stage: {
    planned: '待策划',
    drafting: '生产中',
    reviewing: '待审核',
    approved: '已通过',
    scheduled: '已排期',
    published: '已发布',
    archived: '已归档'
  },
  review_priority: {
    review_first: '建议先审',
    review_next: '次优先审',
    ready_later: '基本可发'
  },
  wechat_status: {
    none: '不发布',
    draft: '草稿',
    ready: '就绪',
    staged: '已入后台',
    scheduled: '已排期',
    published: '已发布'
  },
  visual_stage: {
    not_started: '未开始',
    briefing: '已立brief',
    prompt_ready: '提示词就绪',
    generating: '出图中',
    reviewing: '视觉待审',
    approved: '视觉通过',
    delivered: '已交付'
  }
};

function loadDotEnv() {
  if (!fs.existsSync(ENV_FILE)) return;
  const raw = fs.readFileSync(ENV_FILE, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

function parseFrontmatter(fileContent) {
  const match = fileContent.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  try {
    return yaml.parse(match[1]) || {};
  } catch (error) {
    console.error(`YAML parse failed: ${error.message}`);
    return {};
  }
}

function walkMarkdownFiles(dirPath, files = []) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walkMarkdownFiles(fullPath, files);
      continue;
    }
    if (!entry.name.endsWith('.md')) continue;
    if (EXCLUDED_FILES.has(entry.name)) continue;
    files.push(fullPath);
  }
  return files;
}

function toDateOnly(value) {
  if (!value) return '';
  return String(value).slice(0, 10);
}

function toDateTime(value) {
  if (!value) return '';
  const v = String(value).trim();
  if (!v) return '';
  return v.includes('T') ? v : `${toDateOnly(v)} 00:00:00`;
}

function normalizeWechatEnabled(meta) {
  return Boolean(meta?.distribution?.wechat?.enabled);
}

function classifyContentCategory(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  if (normalized.includes('/master_series/')) return 'master_series';
  if (normalized.includes('/101_academy/')) return 'academy_101';
  if (normalized.includes('/5_Support_Ops/content/')) return 'support_ops';
  return 'special_column';
}

function classifyDistributionCategory(meta) {
  if (meta?.campaign === 'wechat_4_week_sprint_2026q2') return 'campaign_distribution';
  return 'regular_distribution';
}

function classifyGovernanceLane(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  if (normalized.includes('/5_Support_Ops/content/')) return 'support_reference';
  if (normalized.includes('/101_academy/') || normalized.includes('/master_series/')) return 'evergreen_core';
  return 'campaign_operation';
}

function classifyOpsStatus(workflowStage, wechatStatus) {
  if (wechatStatus === 'published') return 'published';
  if (['ready', 'staged', 'scheduled'].includes(wechatStatus)) return 'ready_to_publish';
  if (['drafting', 'reviewing', 'approved', 'scheduled'].includes(workflowStage)) return 'in_production';
  return 'backlog';
}

function collectAssets(scope = 'all') {
  const files = [
    ...walkMarkdownFiles(GROWTH_CONTENT_DIR),
    ...walkMarkdownFiles(SUPPORT_CONTENT_DIR)
  ];

  const items = [];
  for (const filePath of files) {
    const content = fs.readFileSync(filePath, 'utf8');
    const meta = parseFrontmatter(content);
    if (!meta || typeof meta !== 'object') continue;
    if (!meta.content_id) continue;

    const workflow = meta.workflow || {};
    const wechat = (meta.distribution || {}).wechat || {};
    const workflowStage = workflow.stage || '';
    const wechatStatus = wechat.status || '';

    if (scope === 'campaign' && meta.campaign !== 'wechat_4_week_sprint_2026q2') continue;

    items.push({
      content_id: meta.content_id,
      title: meta.title || '',
      path: path.relative(PROJECT_ROOT, filePath),
      content_source: meta.content_source || '',
      content_category: classifyContentCategory(filePath),
      distribution_category: classifyDistributionCategory(meta),
      governance_lane: classifyGovernanceLane(filePath),
      ops_status: classifyOpsStatus(workflowStage, wechatStatus),
      funnel_stage: meta.funnel_stage || '',
      campaign: meta.campaign || '',
      workflow_stage: workflowStage,
      review_priority: workflow.review_priority || '',
      target_publish_date: toDateOnly(workflow.target_publish_date || meta.date || ''),
      wechat_enabled: normalizeWechatEnabled(meta),
      wechat_status: wechatStatus,
      wechat_published_at: toDateOnly(wechat.published_at || ''),
      visual_stage: (meta.visual_workflow || {}).stage || '',
      last_action_at: toDateTime(workflow.last_action_at || ''),
      sync_time: new Date().toISOString()
    });
  }
  return items;
}

async function feishuFetch(url, options = {}) {
  const resp = await fetch(url, options);
  const text = await resp.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON from Feishu: ${text}`);
  }
  if (!resp.ok || (typeof data.code === 'number' && data.code !== 0)) {
    throw new Error(`Feishu API failed (${resp.status}): ${JSON.stringify(data)}`);
  }
  return data;
}

async function getTenantAccessToken(appId, appSecret) {
  const data = await feishuFetch(`${FEISHU_API}/auth/v3/tenant_access_token/internal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret })
  });
  return data.tenant_access_token;
}

async function listFields(token, appToken, tableId) {
  const fields = [];
  let pageToken = '';
  while (true) {
    const qs = new URLSearchParams({ page_size: '200' });
    if (pageToken) qs.set('page_token', pageToken);
    const data = await feishuFetch(`${FEISHU_API}/bitable/v1/apps/${appToken}/tables/${tableId}/fields?${qs}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const page = data.data || {};
    fields.push(...(page.items || []));
    if (!page.has_more) break;
    pageToken = page.page_token || '';
    if (!pageToken) break;
  }
  return fields;
}

async function listRecords(token, appToken, tableId) {
  const records = [];
  let pageToken = '';
  while (true) {
    const qs = new URLSearchParams({ page_size: '500' });
    if (pageToken) qs.set('page_token', pageToken);
    const data = await feishuFetch(`${FEISHU_API}/bitable/v1/apps/${appToken}/tables/${tableId}/records?${qs}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const page = data.data || {};
    records.push(...(page.items || []));
    if (!page.has_more) break;
    pageToken = page.page_token || '';
    if (!pageToken) break;
  }
  return records;
}

async function updateField(token, appToken, tableId, fieldId, payload) {
  await feishuFetch(`${FEISHU_API}/bitable/v1/apps/${appToken}/tables/${tableId}/fields/${fieldId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8'
    },
    body: JSON.stringify(payload)
  });
}

async function createField(token, appToken, tableId, payload) {
  const data = await feishuFetch(`${FEISHU_API}/bitable/v1/apps/${appToken}/tables/${tableId}/fields`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8'
    },
    body: JSON.stringify(payload)
  });
  return data?.data?.field || null;
}

async function listViews(token, appToken, tableId) {
  const views = [];
  let pageToken = '';
  while (true) {
    const qs = new URLSearchParams({ page_size: '200' });
    if (pageToken) qs.set('page_token', pageToken);
    const data = await feishuFetch(`${FEISHU_API}/bitable/v1/apps/${appToken}/tables/${tableId}/views?${qs}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const page = data.data || {};
    views.push(...(page.items || []));
    if (!page.has_more) break;
    pageToken = page.page_token || '';
    if (!pageToken) break;
  }
  return views;
}

async function createView(token, appToken, tableId, viewName) {
  const data = await feishuFetch(`${FEISHU_API}/bitable/v1/apps/${appToken}/tables/${tableId}/views`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8'
    },
    body: JSON.stringify({ view_name: viewName, view_type: 'grid' })
  });
  return data?.data?.view || null;
}

async function updateView(token, appToken, tableId, viewId, payload) {
  await feishuFetch(`${FEISHU_API}/bitable/v1/apps/${appToken}/tables/${tableId}/views/${viewId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8'
    },
    body: JSON.stringify(payload)
  });
}

const DATE_TIME_FIELD_NAMES = new Set([
  'target_publish_date',
  'wechat_published_at',
  'last_action_at',
  'sync_time'
]);

function toUnixMs(value) {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const parsed = Date.parse(raw.replace(' ', 'T'));
  if (Number.isNaN(parsed)) return null;
  return parsed;
}

function resolveFieldByCanonical(fields, canonicalName) {
  const aliases = FIELD_ALIASES[canonicalName] || [canonicalName];
  return (fields || []).find((f) => aliases.includes(f.field_name)) || null;
}

function resolveWritableFieldNameMap(fields) {
  const map = new Map();
  for (const canonical of Object.keys(FIELD_ALIASES)) {
    const field = resolveFieldByCanonical(fields, canonical);
    if (field?.field_name) map.set(canonical, field.field_name);
  }
  return map;
}

function pickWritableFields(asset, writableFieldNameMap) {
  const out = {};
  for (const [k, v] of Object.entries(asset)) {
    const targetFieldName = writableFieldNameMap.get(k);
    if (!targetFieldName) continue;
    if (DATE_TIME_FIELD_NAMES.has(k)) {
      const ts = toUnixMs(v);
      if (ts !== null) out[targetFieldName] = ts;
      continue;
    }
    if (SELECT_OPTION_LABEL_ZH[k] && typeof v === 'string' && v) {
      out[targetFieldName] = SELECT_OPTION_LABEL_ZH[k][v] || v;
      continue;
    }
    out[targetFieldName] = v;
  }
  return out;
}

async function batchCreate(token, appToken, tableId, records) {
  await feishuFetch(`${FEISHU_API}/bitable/v1/apps/${appToken}/tables/${tableId}/records/batch_create`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8'
    },
    body: JSON.stringify({ records: records.map((fields) => ({ fields })) })
  });
}

async function batchUpdate(token, appToken, tableId, records) {
  await feishuFetch(`${FEISHU_API}/bitable/v1/apps/${appToken}/tables/${tableId}/records/batch_update`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8'
    },
    body: JSON.stringify({ records })
  });
}

function chunk(array, size) {
  const out = [];
  for (let i = 0; i < array.length; i += size) out.push(array.slice(i, i + size));
  return out;
}

function valueOfSingleSelectOptionId(field, optionName, canonicalFieldName = '') {
  const options = field?.property?.options || [];
  const zhName = SELECT_OPTION_LABEL_ZH[canonicalFieldName]?.[optionName];
  const match = options.find((opt) => opt?.name === optionName || (zhName && opt?.name === zhName));
  if (!match?.id) {
    throw new Error(`Single-select option '${optionName}' not found in field '${field?.field_name || 'unknown'}'.`);
  }
  return JSON.stringify([match.id]);
}

function buildReportViewSpecs(fieldByName) {
  const required = [
    'wechat_status',
    'workflow_stage',
    'review_priority',
    'wechat_published_at',
    'governance_lane',
    'ops_status',
    'distribution_category'
  ];
  for (const field of required) {
    if (!resolveFieldByCanonical([...fieldByName.values()], field)) {
      throw new Error(`Cannot build report views: missing required field '${field}'.`);
    }
  }

  const allFields = [...fieldByName.values()];
  const wfWechatStatus = resolveFieldByCanonical(allFields, 'wechat_status');
  const wfWorkflowStage = resolveFieldByCanonical(allFields, 'workflow_stage');
  const wfReviewPriority = resolveFieldByCanonical(allFields, 'review_priority');
  const fWechatStatus = wfWechatStatus.field_id;
  const fWorkflowStage = wfWorkflowStage.field_id;
  const fReviewPriority = wfReviewPriority.field_id;
  const fWechatPublishedAt = resolveFieldByCanonical(allFields, 'wechat_published_at').field_id;
  const wfGovernanceLane = resolveFieldByCanonical(allFields, 'governance_lane');
  const wfOpsStatus = resolveFieldByCanonical(allFields, 'ops_status');
  const wfDistributionCategory = resolveFieldByCanonical(allFields, 'distribution_category');
  const fGovernanceLane = wfGovernanceLane.field_id;
  const fOpsStatus = wfOpsStatus.field_id;
  const fDistributionCategory = wfDistributionCategory.field_id;

  return [
    {
      view_name: '运营看板-公众号已发布',
      legacy_names: ['报表-公众号已发布'],
      property: {
        filter_info: {
          conjunction: 'and',
          conditions: [
            {
              field_id: fWechatStatus,
              operator: 'is',
              value: valueOfSingleSelectOptionId(wfWechatStatus, 'published', 'wechat_status')
            }
          ]
        }
      }
    },
    {
      view_name: '运营看板-待发布队列',
      legacy_names: ['报表-公众号待发布'],
      property: {
        filter_info: {
          conjunction: 'or',
          conditions: [
            {
              field_id: fWechatStatus,
              operator: 'is',
              value: valueOfSingleSelectOptionId(wfWechatStatus, 'ready', 'wechat_status')
            },
            {
              field_id: fWechatStatus,
              operator: 'is',
              value: valueOfSingleSelectOptionId(wfWechatStatus, 'staged', 'wechat_status')
            },
            {
              field_id: fWechatStatus,
              operator: 'is',
              value: valueOfSingleSelectOptionId(wfWechatStatus, 'scheduled', 'wechat_status')
            }
          ]
        }
      }
    },
    {
      view_name: '运营看板-内容生产流水线',
      legacy_names: ['报表-内容生产中'],
      property: {
        filter_info: {
          conjunction: 'or',
          conditions: [
            {
              field_id: fWorkflowStage,
              operator: 'is',
              value: valueOfSingleSelectOptionId(wfWorkflowStage, 'drafting', 'workflow_stage')
            },
            {
              field_id: fWorkflowStage,
              operator: 'is',
              value: valueOfSingleSelectOptionId(wfWorkflowStage, 'reviewing', 'workflow_stage')
            },
            {
              field_id: fWorkflowStage,
              operator: 'is',
              value: valueOfSingleSelectOptionId(wfWorkflowStage, 'approved', 'workflow_stage')
            },
            {
              field_id: fWorkflowStage,
              operator: 'is',
              value: valueOfSingleSelectOptionId(wfWorkflowStage, 'scheduled', 'workflow_stage')
            }
          ]
        }
      }
    },
    {
      view_name: '运营看板-高优先级待审核',
      legacy_names: ['报表-高优先级待审核'],
      property: {
        filter_info: {
          conjunction: 'or',
          conditions: [
            {
              field_id: fReviewPriority,
              operator: 'is',
              value: valueOfSingleSelectOptionId(wfReviewPriority, 'review_first', 'review_priority')
            },
            {
              field_id: fReviewPriority,
              operator: 'is',
              value: valueOfSingleSelectOptionId(wfReviewPriority, 'review_next', 'review_priority')
            }
          ]
        }
      }
    },
    {
      view_name: '运营看板-数据质量异常',
      legacy_names: ['报表-数据质量-已发布缺发布时间'],
      property: {
        filter_info: {
          conjunction: 'and',
          conditions: [
            {
              field_id: fWechatStatus,
              operator: 'is',
              value: valueOfSingleSelectOptionId(wfWechatStatus, 'published', 'wechat_status')
            },
            { field_id: fWechatPublishedAt, operator: 'isEmpty' }
          ]
        }
      }
    },
    {
      view_name: '资产治理-静态内容台账',
      property: {
        filter_info: {
          conjunction: 'or',
          conditions: [
            {
              field_id: fGovernanceLane,
              operator: 'is',
              value: valueOfSingleSelectOptionId(wfGovernanceLane, 'evergreen_core', 'governance_lane')
            },
            {
              field_id: fGovernanceLane,
              operator: 'is',
              value: valueOfSingleSelectOptionId(wfGovernanceLane, 'support_reference', 'governance_lane')
            }
          ]
        }
      }
    },
    {
      view_name: '运营执行-发布分发队列',
      property: {
        filter_info: {
          conjunction: 'or',
          conditions: [
            {
              field_id: fOpsStatus,
              operator: 'is',
              value: valueOfSingleSelectOptionId(wfOpsStatus, 'ready_to_publish', 'ops_status')
            },
            {
              field_id: fOpsStatus,
              operator: 'is',
              value: valueOfSingleSelectOptionId(wfOpsStatus, 'in_production', 'ops_status')
            }
          ]
        }
      }
    },
    {
      view_name: '运营执行-战役分发监控',
      property: {
        filter_info: {
          conjunction: 'and',
          conditions: [
            {
              field_id: fDistributionCategory,
              operator: 'is',
              value: valueOfSingleSelectOptionId(wfDistributionCategory, 'campaign_distribution', 'distribution_category')
            }
          ]
        }
      }
    }
  ];
}

async function ensureReportViews(token, appToken, tableId, fields) {
  const fieldByName = new Map((fields || []).map((f) => [f.field_name, f]));
  const specs = buildReportViewSpecs(fieldByName);
  const views = await listViews(token, appToken, tableId);
  const viewByName = new Map(views.map((v) => [v.view_name, v]));
  const results = [];

  for (const spec of specs) {
    let view = viewByName.get(spec.view_name);
    if (!view && Array.isArray(spec.legacy_names)) {
      for (const oldName of spec.legacy_names) {
        const legacyView = viewByName.get(oldName);
        if (legacyView) {
          view = legacyView;
          break;
        }
      }
    }
    if (!view) {
      view = await createView(token, appToken, tableId, spec.view_name);
      if (!view?.view_id) throw new Error(`Create view failed for '${spec.view_name}'`);
      viewByName.set(spec.view_name, view);
      results.push({ name: spec.view_name, action: 'created' });
    } else {
      results.push({ name: spec.view_name, action: 'updated' });
    }

    await updateView(token, appToken, tableId, view.view_id, {
      view_name: spec.view_name,
      property: spec.property
    });
  }

  return results;
}

function getRecordContentId(record) {
  const aliases = FIELD_ALIASES.content_id || ['content_id'];
  for (const key of aliases) {
    const value = record?.fields?.[key];
    if (value) return String(value);
  }
  return '';
}

async function ensureChineseFieldHeaders(token, appToken, tableId, fields) {
  const renamed = [];
  for (const [canonical, zhName] of Object.entries(FIELD_LABEL_ZH)) {
    const field = resolveFieldByCanonical(fields, canonical);
    if (!field?.field_id) continue;
    if (field.field_name === zhName) continue;
    await updateField(token, appToken, tableId, field.field_id, {
      field_name: zhName,
      type: field.type
    });
    renamed.push(`${field.field_name} -> ${zhName}`);
  }
  return renamed;
}

async function ensureRequiredFields(token, appToken, tableId, fields) {
  const missing = [];
  for (const canonical of Object.keys(FIELD_LABEL_ZH)) {
    const field = resolveFieldByCanonical(fields, canonical);
    if (!field) missing.push(canonical);
  }
  if (missing.length === 0) return [];

  const created = [];
  for (const canonical of missing) {
    if (
      canonical === 'content_category' ||
      canonical === 'distribution_category' ||
      canonical === 'governance_lane' ||
      canonical === 'ops_status'
    ) {
      const optionDict = SELECT_OPTION_LABEL_ZH[canonical];
      if (!optionDict) continue;
      const options = Object.values(optionDict).map((name, idx) => ({
        name,
        color: idx % 7
      }));
      await createField(token, appToken, tableId, {
        field_name: FIELD_LABEL_ZH[canonical],
        type: 3,
        property: { options }
      });
      created.push(FIELD_LABEL_ZH[canonical]);
    }
  }
  return created;
}

function buildLocalizedOptions(canonicalFieldName, field) {
  const dict = SELECT_OPTION_LABEL_ZH[canonicalFieldName];
  if (!dict) return null;

  const currentOptions = field?.property?.options || [];
  const byName = new Map(currentOptions.map((opt) => [opt.name, opt]));
  const localized = [];
  let changed = false;

  for (const [internalName, zhName] of Object.entries(dict)) {
    const source = byName.get(internalName) || byName.get(zhName);
    if (!source) {
      localized.push({ name: zhName, color: localized.length % 7 });
      changed = true;
      continue;
    }
    const color = typeof source.color === 'number' ? source.color : localized.length % 7;
    localized.push({ name: zhName, color });
    if (source.name !== zhName) changed = true;
  }

  if (localized.length === 0 || !changed) return null;
  return localized;
}

async function ensureChineseSelectOptionLabels(token, appToken, tableId, fields) {
  const changed = [];
  for (const canonicalFieldName of Object.keys(SELECT_OPTION_LABEL_ZH)) {
    const field = resolveFieldByCanonical(fields, canonicalFieldName);
    if (!field || field.type !== 3) continue;
    const localizedOptions = buildLocalizedOptions(canonicalFieldName, field);
    if (!localizedOptions) continue;
    await updateField(token, appToken, tableId, field.field_id, {
      field_name: field.field_name,
      type: field.type,
      property: { options: localizedOptions }
    });
    changed.push(field.field_name);
  }
  return changed;
}

async function main() {
  loadDotEnv();
  const dryRun = process.argv.includes('--dry-run');
  const ensureViews = !process.argv.includes('--skip-views');
  const localizeHeadersZh = !process.argv.includes('--skip-localize-headers');
  const scope = process.argv.includes('--scope=campaign') ? 'campaign' : 'all';
  const appId = process.env.LARK_APP_ID || '';
  const appSecret = process.env.LARK_APP_SECRET || '';
  const appToken = process.env.LARK_BASE_APP_TOKEN || '';
  const tableId = process.env.LARK_TABLE_ID || '';

  if (!appId || !appSecret || !appToken || !tableId) {
    throw new Error('Missing env vars. Required: LARK_APP_ID, LARK_APP_SECRET, LARK_BASE_APP_TOKEN, LARK_TABLE_ID');
  }

  const assets = collectAssets(scope);
  if (!assets.length) {
    console.log(`No assets found for scope=${scope}. Nothing to sync.`);
    return;
  }

  const accessToken = await getTenantAccessToken(appId, appSecret);
  let fields = await listFields(accessToken, appToken, tableId);

  const createdFields = await ensureRequiredFields(accessToken, appToken, tableId, fields);
  if (createdFields.length) {
    console.log(`Feishu fields created: ${createdFields.join(', ')}`);
    fields = await listFields(accessToken, appToken, tableId);
  }

  if (localizeHeadersZh) {
    const renamed = await ensureChineseFieldHeaders(accessToken, appToken, tableId, fields);
    if (renamed.length) {
      console.log(`Feishu headers localized: ${renamed.length}`);
      fields = await listFields(accessToken, appToken, tableId);
    }
    const selectLocalized = await ensureChineseSelectOptionLabels(accessToken, appToken, tableId, fields);
    if (selectLocalized.length) {
      console.log(`Feishu select options localized: ${selectLocalized.length}`);
      fields = await listFields(accessToken, appToken, tableId);
    }
  }
  const records = await listRecords(accessToken, appToken, tableId);

  const writableFieldNameMap = resolveWritableFieldNameMap(fields);
  if (!writableFieldNameMap.has('content_id')) {
    throw new Error('Target table must include a content_id column (or its Chinese alias 内容ID).');
  }

  const recordByContentId = new Map();
  for (const r of records) {
    const cid = getRecordContentId(r);
    if (cid) recordByContentId.set(String(cid), r.record_id);
  }

  const toCreate = [];
  const toUpdate = [];
  for (const asset of assets) {
    const fieldsPayload = pickWritableFields(asset, writableFieldNameMap);
    const recordId = recordByContentId.get(String(asset.content_id));
    if (recordId) {
      toUpdate.push({ record_id: recordId, fields: fieldsPayload });
    } else {
      toCreate.push(fieldsPayload);
    }
  }

  console.log(`Feishu sync preview: scope=${scope}, total=${assets.length}, create=${toCreate.length}, update=${toUpdate.length}, dryRun=${dryRun}`);

  if (dryRun) return;

  for (const batch of chunk(toCreate, 200)) {
    await batchCreate(accessToken, appToken, tableId, batch);
  }
  for (const batch of chunk(toUpdate, 200)) {
    await batchUpdate(accessToken, appToken, tableId, batch);
  }

  if (ensureViews) {
    const viewResults = await ensureReportViews(accessToken, appToken, tableId, fields);
    const created = viewResults.filter((r) => r.action === 'created').length;
    const updated = viewResults.filter((r) => r.action === 'updated').length;
    console.log(`Feishu views ensured: created=${created}, updated=${updated}`);
  }

  console.log('Feishu sync finished.');
}

main().catch((error) => {
  console.error(`Feishu sync failed: ${error.message}`);
  process.exit(1);
});
