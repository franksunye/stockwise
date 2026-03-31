import tradeManagementStates from '@/shared/trade-management-states.json';
import tradeManagementPolicies from '@/shared/trade-management-policies.json';

export interface TradeManagementPosition {
  position_id: string;
  user_id: string;
  symbol: string;
  stock_name: string | null;
  market: string | null;
  entry_date: string;
  entry_price: number;
  position_size: number;
  remaining_size: number;
  status: string;
  note: string | null;
  latest_event_date: string | null;
  latest_event_type: string | null;
  latest_event_price: number | null;
  latest_event_quantity: number | null;
}

export interface TradeManagementAdvice {
  advice_id: string;
  position_id: string;
  latest_trade_date: string;
  next_trade_date: string | null;
  state_id: TradeManagementStateId | null;
  signal_state: string | null;
  recommended_policy: string | null;
  action_summary: string | null;
  card_markdown: string | null;
  updated_at: string | null;
}

export interface TradeManagementRecentEvent {
  event_id: string;
  position_id: string;
  user_id: string;
  symbol: string;
  market: string | null;
  event_date: string;
  event_type: string;
  quantity: number;
  price: number | null;
  note: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface TradeManagementPayload {
  position: TradeManagementPosition | null;
  advice: TradeManagementAdvice | null;
  recent_events: TradeManagementRecentEvent[];
  can_create_position: boolean;
}

export interface TradeManagementSnapshot {
  fetchedAt: number;
  data: TradeManagementPayload;
}

export interface TradeManagementCardSection {
  title: string;
  lines: string[];
}

export type TradeManagementStateId =
  | 'EntryTriggered'
  | 'BreakoutPending'
  | 'TrendHolding'
  | 'ProfitProtection'
  | 'FailureRisk'
  | 'ExitCompleted';

const MEMORY_CACHE = new Map<string, TradeManagementSnapshot>();
const SESSION_KEY_PREFIX = 'trade_management_surface';

interface TradeManagementStateDefinition {
  id: TradeManagementStateId;
  label_zh: string;
  description_zh: string;
  sort_order: number;
}

interface TradeManagementPolicyDefinition {
  id: string;
  label_zh: string;
  description_zh: string;
  sort_order: number;
}

export function getTradeManagementSWRKey(symbol: string): readonly [string, string] {
  return ['trade-management', symbol] as const;
}

function getSnapshotKey(symbol: string): string {
  return symbol.trim().toUpperCase();
}

export function getTradeManagementMemorySnapshot(symbol: string): TradeManagementSnapshot | null {
  return MEMORY_CACHE.get(getSnapshotKey(symbol)) || null;
}

export function setTradeManagementMemorySnapshot(symbol: string, snapshot: TradeManagementSnapshot): void {
  MEMORY_CACHE.set(getSnapshotKey(symbol), snapshot);
}

export function readTradeManagementSessionSnapshot(symbol: string): TradeManagementSnapshot | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.sessionStorage.getItem(`${SESSION_KEY_PREFIX}:${getSnapshotKey(symbol)}`);
    if (!raw) return null;
    return JSON.parse(raw) as TradeManagementSnapshot;
  } catch {
    return null;
  }
}

export function writeTradeManagementSessionSnapshot(symbol: string, snapshot: TradeManagementSnapshot): void {
  if (typeof window === 'undefined') return;

  try {
    window.sessionStorage.setItem(
      `${SESSION_KEY_PREFIX}:${getSnapshotKey(symbol)}`,
      JSON.stringify(snapshot),
    );
  } catch {
    // Ignore sessionStorage quota or serialization errors for a soft cache.
  }
}

export async function fetchTradeManagementData(symbol: string): Promise<TradeManagementSnapshot> {
  const response = await fetch(`/api/user/trade-management/stock?symbol=${encodeURIComponent(symbol)}`, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Failed to load trade management surface (${response.status})`);
  }

  const data = (await response.json()) as TradeManagementPayload;
  return {
    fetchedAt: Date.now(),
    data,
  };
}

export function formatTradeDateLabel(value: string | null | undefined): string {
  if (!value) return '--';
  const safe = value.trim();
  if (!safe) return '--';
  return safe.length >= 10 ? safe.slice(0, 10) : safe;
}

export function formatTradeDateTimeLabel(value: string | null | undefined): string {
  if (!value) return '--';
  const safe = value.trim().replace('T', ' ');
  if (!safe) return '--';
  return safe.length >= 16 ? safe.slice(0, 16) : safe;
}

export function formatQuantity(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '--';
  return Number(value).toLocaleString('zh-CN');
}

export function formatPrice(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '--';
  return Number(value).toFixed(2).replace(/\.?0+$/, '');
}

const MANAGEMENT_STATE_LABELS = Object.fromEntries(
  (tradeManagementStates as TradeManagementStateDefinition[]).map((item) => [item.id, item.label_zh]),
) as Record<TradeManagementStateId, string>;

const MANAGEMENT_POLICY_DESCRIPTIONS = Object.fromEntries(
  (tradeManagementPolicies as TradeManagementPolicyDefinition[]).map((item) => [item.id.toLowerCase(), item.description_zh]),
) as Record<string, string>;

export function getManagementStateLabel(advice: TradeManagementAdvice | null): string {
  const stateId = advice?.state_id;
  if (!stateId) return '等待建立';
  return MANAGEMENT_STATE_LABELS[stateId] || '管理中';
}

export function getManagementActionLabel(advice: TradeManagementAdvice | null): string {
  if (advice?.action_summary?.trim()) return advice.action_summary.trim();
  if (advice?.recommended_policy?.trim()) return advice.recommended_policy.trim();
  return '暂无交易建议';
}

function normalizeCardMarkdown(input: string): string {
  return input.replace(/\\n/g, '\n');
}

export function getNormalizedManagementCardMarkdown(advice: TradeManagementAdvice | null): string {
  if (!advice?.card_markdown) return '';
  return normalizeCardMarkdown(advice.card_markdown);
}

export function getManagementDetailLines(advice: TradeManagementAdvice | null): string[] {
  const normalized = getNormalizedManagementCardMarkdown(advice);
  if (!normalized) return [];

  return normalized
    .split('\n')
    .map((line) => line.replace(/^[-*#\s]+/, '').trim())
    .filter(Boolean)
    .slice(0, 5);
}

export function getManagementFactLines(advice: TradeManagementAdvice | null): string[] {
  const normalized = getNormalizedManagementCardMarkdown(advice);
  if (!normalized) return [];

  return normalized
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('>'))
    .map((line) => line.replace(/^>\s*/, '').replace(/\*\*/g, '').trim())
    .filter(Boolean)
    .slice(0, 4);
}

export function getManagementCardSections(advice: TradeManagementAdvice | null): TradeManagementCardSection[] {
  const normalized = getNormalizedManagementCardMarkdown(advice);
  if (!normalized) return [];

  const sections: TradeManagementCardSection[] = [];
  let currentTitle = '';
  let currentLines: string[] = [];

  const flush = () => {
    if (!currentTitle || currentLines.length === 0) return;
    sections.push({
      title: currentTitle,
      lines: currentLines,
    });
  };

  normalized.split('\n').forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) return;

    if (line.startsWith('#### ')) {
      flush();
      currentTitle = line.replace(/^####\s+/, '').trim();
      currentLines = [];
      return;
    }

    if (!currentTitle) return;

    const cleaned = line
      .replace(/^[-*]\s*/, '')
      .replace(/^>\s*/, '')
      .replace(/\*\*/g, '')
      .trim();

    if (cleaned) currentLines.push(cleaned);
  });

  flush();
  return sections;
}

export function getTradeEventLabel(value: string | null | undefined): string {
  const normalized = String(value || '').trim().toUpperCase();
  if (normalized === 'BUY') return '买入';
  if (normalized === 'SELL') return '卖出';
  return normalized || '初始建仓';
}

export function getManagementPolicyLabel(advice: TradeManagementAdvice | null): string {
  const normalized = String(advice?.recommended_policy || '').trim().toLowerCase();

  if (normalized && MANAGEMENT_POLICY_DESCRIPTIONS[normalized]) {
    return MANAGEMENT_POLICY_DESCRIPTIONS[normalized];
  }

  return advice?.recommended_policy || advice?.signal_state || '系统已接管此仓位，定量的执行交易纪律将在下个计算周期生成。';
}
