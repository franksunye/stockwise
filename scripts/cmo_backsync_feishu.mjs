import fs from 'fs';
import path from 'path';
import yaml from 'yaml';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const ENV_FILE = path.join(PROJECT_ROOT, '.env');
const FEISHU_API = 'https://open.feishu.cn/open-apis';

const FIELD_ALIASES = {
  content_id: ['content_id', '内容ID'],
  path: ['path', '路径'],
  wechat_url: ['wechat_url', '公众号地址', '发布地址', '微信发布地址'],
  wechat_status: ['wechat_status', '公众号状态'],
  wechat_published_at: ['wechat_published_at', '公众号发布时间'],
  data_status: ['data_status', '数据状态'],
  external_note: ['external_note', '外部备注', '运营备注']
};

const WECHAT_STATUS_ZH_TO_INTERNAL = {
  不发布: 'none',
  草稿: 'draft',
  就绪: 'ready',
  已入后台: 'staged',
  已排期: 'scheduled',
  已发布: 'published'
};

const DATA_STATUS_ZH_TO_INTERNAL = {
  待处理: 'pending',
  处理中: 'in_progress',
  已处理: 'completed',
  已完成: 'completed'
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

function getRecordValue(fields, key) {
  const aliases = FIELD_ALIASES[key] || [key];
  for (const alias of aliases) {
    if (fields[alias] !== undefined && fields[alias] !== null) return fields[alias];
  }
  return '';
}

function normalizeDateOnly(value) {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'number') return new Date(value).toISOString().slice(0, 10);
  const raw = String(value).trim();
  if (!raw) return '';
  if (/^\d+$/.test(raw)) return new Date(Number(raw)).toISOString().slice(0, 10);
  return raw.slice(0, 10);
}

function normalizeWechatStatus(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (WECHAT_STATUS_ZH_TO_INTERNAL[raw]) return WECHAT_STATUS_ZH_TO_INTERNAL[raw];
  return raw;
}

function normalizeDataStatus(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (DATA_STATUS_ZH_TO_INTERNAL[raw]) return DATA_STATUS_ZH_TO_INTERNAL[raw];
  return raw;
}

function parseFrontmatterBlock(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;
  const data = yaml.parse(match[1]) || {};
  return { data, raw: match[0] };
}

function ensureObject(parent, key) {
  if (!parent[key] || typeof parent[key] !== 'object') parent[key] = {};
  return parent[key];
}

function setIfChanged(obj, key, next, changed) {
  if (next === '') return;
  if (obj[key] === next) return;
  obj[key] = next;
  changed.push(key);
}

function applyRecordToMeta(meta, recordFields) {
  const changed = [];

  const distribution = ensureObject(meta, 'distribution');
  const wechat = ensureObject(distribution, 'wechat');
  const maintenance = ensureObject(meta, 'maintenance');

  const wechatUrl = String(getRecordValue(recordFields, 'wechat_url') || '').trim();
  const wechatStatus = normalizeWechatStatus(getRecordValue(recordFields, 'wechat_status'));
  const wechatPublishedAt = normalizeDateOnly(getRecordValue(recordFields, 'wechat_published_at'));
  const dataStatus = normalizeDataStatus(getRecordValue(recordFields, 'data_status'));
  const externalNote = String(getRecordValue(recordFields, 'external_note') || '').trim();

  if (wechatUrl) setIfChanged(wechat, 'url', wechatUrl, changed);
  if (wechatStatus) setIfChanged(wechat, 'status', wechatStatus, changed);
  if (wechatPublishedAt) setIfChanged(wechat, 'published_at', wechatPublishedAt, changed);
  if (dataStatus) setIfChanged(maintenance, 'external_status', dataStatus, changed);
  if (externalNote) setIfChanged(maintenance, 'external_note', externalNote, changed);

  return changed;
}

function renderFrontmatter(meta) {
  return `---\n${yaml.stringify(meta).trimEnd()}\n---`;
}

async function main() {
  loadDotEnv();
  const dryRun = !process.argv.includes('--apply');
  const appId = process.env.LARK_APP_ID || '';
  const appSecret = process.env.LARK_APP_SECRET || '';
  const appToken = process.env.LARK_BASE_APP_TOKEN || '';
  const tableId = process.env.LARK_TABLE_ID || '';

  if (!appId || !appSecret || !appToken || !tableId) {
    throw new Error('Missing env vars. Required: LARK_APP_ID, LARK_APP_SECRET, LARK_BASE_APP_TOKEN, LARK_TABLE_ID');
  }

  const token = await getTenantAccessToken(appId, appSecret);
  const records = await listRecords(token, appToken, tableId);

  let scanned = 0;
  let candidates = 0;
  let changedFiles = 0;

  for (const record of records) {
    scanned += 1;
    const fields = record?.fields || {};
    const relativePath = String(getRecordValue(fields, 'path') || '').trim();
    if (!relativePath) continue;
    const absPath = path.join(PROJECT_ROOT, relativePath);
    if (!fs.existsSync(absPath)) continue;

    const original = fs.readFileSync(absPath, 'utf8');
    const parsed = parseFrontmatterBlock(original);
    if (!parsed) continue;
    candidates += 1;

    const changedKeys = applyRecordToMeta(parsed.data, fields);
    if (changedKeys.length === 0) continue;

    const nextFrontmatter = renderFrontmatter(parsed.data);
    const nextContent = original.replace(parsed.raw, nextFrontmatter);
    if (nextContent === original) continue;
    changedFiles += 1;

    if (!dryRun) {
      fs.writeFileSync(absPath, nextContent, 'utf8');
    }
  }

  console.log(
    `Feishu backsync ${dryRun ? 'preview' : 'applied'}: scanned=${scanned}, candidates=${candidates}, changed=${changedFiles}, dryRun=${dryRun}`
  );
}

main().catch((error) => {
  console.error(`Feishu backsync failed: ${error.message}`);
  process.exit(1);
});
