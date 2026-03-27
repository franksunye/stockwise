import { getTeamMemberById, resolveAnalystFromModel } from '@/lib/agent-team';
import { getPredictionActionMeta } from '@/lib/layer1-ui';
import { formatModelName } from '@/lib/model-names';
import { getFirstSentence, getTacticalConflictSummary, getTacticalSummary } from '@/lib/tactical-brief-content';
import type { AIPrediction } from '@/lib/types';
import { getCurrentUser } from '@/lib/user';

export type CouncilActionKey = 'enter' | 'observe' | 'defense' | 'empty' | 'mixed';
export type CouncilCardMode = 'collab' | 'independent' | 'rule';

export interface CouncilCardData {
  key: string;
  title: string;
  role: string;
  summary: string;
  actionKey: CouncilActionKey;
  confidence?: number;
  supportPrice?: number;
  isPrimary?: boolean;
  mode: CouncilCardMode;
  avatarSeeds: string[];
}

function mapCouncilMember(pred: AIPrediction) {
  const modelLike = `${pred.display_name || ''} ${pred.model || ''}`;
  const analyst = resolveAnalystFromModel(modelLike);
  if (analyst.id === 'fallback') {
    return {
      name: formatModelName(pred.display_name || pred.model),
      role: analyst.role,
      avatarSeed: analyst.avatarSeed,
    };
  }
  return { name: analyst.name, role: analyst.role, avatarSeed: analyst.avatarSeed };
}

export function getCouncilActionKey(pred: AIPrediction): CouncilActionKey {
  switch (pred.layer1_status) {
    case 'TriggeredLong':
      return 'enter';
    case 'Watch':
      return 'observe';
    case 'RiskOff':
      return 'defense';
    case 'NoSetup':
      return 'empty';
    default:
      break;
  }

  switch (pred.signal) {
    case 'Long':
      return 'enter';
    case 'Short':
      return 'defense';
    case 'Side':
      return 'observe';
    default:
      return 'mixed';
  }
}

export function getCouncilActionKeyFromSignal(signalLike: string | undefined | null): CouncilActionKey {
  switch (signalLike) {
    case 'TriggeredLong':
    case 'Long':
      return 'enter';
    case 'Watch':
    case 'Side':
      return 'observe';
    case 'RiskOff':
    case 'Short':
      return 'defense';
    case 'NoSetup':
      return 'empty';
    default:
      return 'mixed';
  }
}

export function getCouncilActionLabel(actionKey: CouncilActionKey): string {
  switch (actionKey) {
    case 'enter':
      return '建议看多';
    case 'observe':
      return '建议观察';
    case 'defense':
      return '建议防守';
    case 'empty':
      return '暂无信号';
    default:
      return '判断分歧';
  }
}

function buildCollabSummary(pred: AIPrediction, analystName: string): string {
  const actionLabel = getCouncilActionLabel(
    getCouncilActionKeyFromSignal(pred.layer1_signal || pred.layer1_status || pred.canonical_signal || pred.signal)
  );
  const conflict = getFirstSentence(getTacticalConflictSummary(pred.llm_reasoning || pred.ai_reasoning));
  if (conflict) return conflict;

  const summary = getFirstSentence(getTacticalSummary(pred.llm_reasoning || pred.ai_reasoning));
  if (summary) {
    return `当前结论为${actionLabel}，${analystName}复核后认为：${summary}`;
  }
  return `${analystName}复核后，当前结论维持${actionLabel}。`;
}

function buildRuleSummary(pred: AIPrediction): string {
  const summary = getFirstSentence(getTacticalSummary(pred.llm_reasoning || pred.ai_reasoning));
  if (summary) return summary;
  const actionLabel = getCouncilActionLabel(
    getCouncilActionKeyFromSignal(pred.layer1_signal || pred.layer1_status || pred.canonical_signal || pred.signal)
  );
  return `规则侧当前判断为${actionLabel}。`;
}

export function getCouncilActionMeta(actionKey: CouncilActionKey) {
  switch (actionKey) {
    case 'enter':
      return getPredictionActionMeta({ signal: 'Long', layer1_status: 'TriggeredLong' });
    case 'observe':
      return getPredictionActionMeta({ signal: 'Side', layer1_status: 'Watch' });
    case 'defense':
      return getPredictionActionMeta({ signal: 'Short', layer1_status: 'RiskOff' });
    case 'empty':
      return getPredictionActionMeta({ signal: 'Side', layer1_status: 'NoSetup' });
    default:
      return getPredictionActionMeta(null);
  }
}

export function getActionChipClass(actionKey: CouncilActionKey): string {
  return getCouncilActionMeta(actionKey).bgClass
    .replace('border-rose-500/20', '')
    .replace('border-emerald-500/20', '')
    .replace('border-amber-500/20', '')
    .replace('border-slate-500/20', '')
    .trim();
}

export function getCouncilHeadlineAction(predictions: AIPrediction[]): CouncilActionKey {
  const primaryPrediction = predictions.find((pred) => pred.is_primary === true || pred.is_primary === 1);
  const primaryAction = primaryPrediction ? getCouncilActionKey(primaryPrediction) : 'mixed';
  if (primaryAction !== 'mixed') return primaryAction;

  const counts = new Map<CouncilActionKey, number>();
  for (const pred of predictions) {
    const actionKey = getCouncilActionKey(pred);
    counts.set(actionKey, (counts.get(actionKey) || 0) + 1);
  }

  const ranked = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  if (ranked.length === 0) return 'mixed';
  if (ranked.length === 1) return ranked[0][0];
  if (ranked[0][1] === ranked[1][1]) return 'mixed';
  return ranked[0][0];
}

export function buildCouncilCards(predictions: AIPrediction[]): CouncilCardData[] {
  const shenCe = getTeamMemberById('shen_ce');
  const guShen = getTeamMemberById('gu_shen');
  const linXu = getTeamMemberById('lin_xu');
  const chengJu = getTeamMemberById('cheng_ju');

  const deepseekPred = predictions.find((pred) => resolveAnalystFromModel(`${pred.display_name || ''} ${pred.model || ''}`).id === 'gu_shen');
  const linxuPred = predictions.find((pred) => resolveAnalystFromModel(`${pred.display_name || ''} ${pred.model || ''}`).id === 'lin_xu');
  const rulePred = predictions.find((pred) => resolveAnalystFromModel(`${pred.display_name || ''} ${pred.model || ''}`).id === 'cheng_ju');

  const cards: CouncilCardData[] = [];

  if (deepseekPred) {
    const collabAction = getCouncilActionKeyFromSignal(
      deepseekPred.layer1_signal || deepseekPred.layer1_status || deepseekPred.canonical_signal || deepseekPred.signal
    );
    cards.push({
      key: 'shen-ce-gu-shen-collab',
      title: `${shenCe.name} × ${guShen.name}`,
      role: '主结论复核',
      summary: buildCollabSummary(deepseekPred, guShen.name),
      actionKey: collabAction,
      confidence: deepseekPred.confidence,
      supportPrice: deepseekPred.support_price,
      isPrimary: true,
      mode: 'collab',
      avatarSeeds: [shenCe.avatarSeed, guShen.avatarSeed],
    });
    cards.push({
      key: 'gu-shen-independent',
      title: guShen.name,
      role: '独立视角',
      summary: getTacticalSummary(deepseekPred.llm_reasoning || deepseekPred.ai_reasoning),
      actionKey: getCouncilActionKeyFromSignal(deepseekPred.llm_signal || deepseekPred.signal),
      confidence: deepseekPred.confidence,
      supportPrice: deepseekPred.support_price,
      mode: 'independent',
      avatarSeeds: [guShen.avatarSeed],
    });
  }

  if (linxuPred) {
    cards.push({
      key: 'lin-xu-independent',
      title: linXu.name,
      role: '独立视角',
      summary: getTacticalSummary(linxuPred.llm_reasoning || linxuPred.ai_reasoning),
      actionKey: getCouncilActionKeyFromSignal(linxuPred.llm_signal || linxuPred.signal),
      confidence: linxuPred.confidence,
      supportPrice: linxuPred.support_price,
      mode: 'independent',
      avatarSeeds: [linXu.avatarSeed],
    });
  }

  if (rulePred) {
    const ruleAction = getCouncilActionKeyFromSignal(
      rulePred.layer1_signal || rulePred.layer1_status || rulePred.canonical_signal || rulePred.signal
    );
    cards.push({
      key: 'shen-ce-cheng-ju-rule',
      title: `${shenCe.name} × ${chengJu.name}`,
      role: '规则视角',
      summary: buildRuleSummary(rulePred),
      actionKey: ruleAction,
      confidence: rulePred.confidence,
      supportPrice: rulePred.support_price,
      mode: 'rule',
      avatarSeeds: [shenCe.avatarSeed, chengJu.avatarSeed],
    });
  }

  if (cards.length > 0) return cards;

  return predictions.map((pred, idx) => {
    const member = mapCouncilMember(pred);
    return {
      key: `fallback-${idx}`,
      title: member.name,
      role: member.role,
      summary: getTacticalSummary(pred.ai_reasoning),
      actionKey: getCouncilActionKey(pred),
      confidence: pred.confidence,
      supportPrice: pred.support_price,
      mode: 'independent',
      avatarSeeds: [member.avatarSeed],
    };
  });
}

export interface CouncilCachePayload {
  data: AIPrediction[];
  fetchedAt: number;
}

const SNAPSHOT_TTL = 1000 * 60 * 60 * 24;
const SNAPSHOT_VERSION = 'v2';
const MAX_CACHE_SIZE = 50;
const councilSnapshotCache = new Map<string, CouncilCachePayload>();

export function getAICouncilSWRKey(symbol: string, targetDate: string) {
  return ['ai-council', symbol, targetDate] as const;
}

export function getCouncilMemorySnapshot(key: string): CouncilCachePayload | undefined {
  const cached = councilSnapshotCache.get(key);
  if (!cached) return undefined;

  councilSnapshotCache.delete(key);
  councilSnapshotCache.set(key, cached);
  return cached;
}

export function setCouncilMemorySnapshot(key: string, payload: CouncilCachePayload): void {
  if (councilSnapshotCache.has(key)) {
    councilSnapshotCache.delete(key);
  }
  councilSnapshotCache.set(key, payload);

  if (councilSnapshotCache.size > MAX_CACHE_SIZE) {
    const oldestKey = councilSnapshotCache.keys().next().value;
    if (oldestKey) councilSnapshotCache.delete(oldestKey);
  }
}

function buildSessionSnapshotKey(symbol: string, targetDate: string): string {
  return `ziso:ai-council:${SNAPSHOT_VERSION}:${symbol}:${targetDate}`;
}

function pruneStaleSnapshots(): void {
  if (typeof window === 'undefined') return;
  try {
    const today = new Date().toISOString().split('T')[0];
    const storage = window.localStorage;
    const keysToRemove: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (!key || !key.startsWith('ziso:ai-council:')) continue;
      const datePart = key.split(':').pop();
      if (datePart && datePart < today) keysToRemove.push(key);
    }
    for (const key of keysToRemove) storage.removeItem(key);
  } catch {
    // best-effort
  }
}

let didPruneSnapshots = false;

export function readCouncilSessionSnapshot(symbol: string, targetDate: string): CouncilCachePayload | null {
  if (typeof window === 'undefined') return null;
  if (!didPruneSnapshots) {
    didPruneSnapshots = true;
    pruneStaleSnapshots();
  }
  try {
    const raw = window.localStorage.getItem(buildSessionSnapshotKey(symbol, targetDate));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CouncilCachePayload>;
    if (!parsed || !Array.isArray(parsed.data) || typeof parsed.fetchedAt !== 'number') {
      return null;
    }
    if (Date.now() - parsed.fetchedAt > SNAPSHOT_TTL) {
      return null;
    }
    return parsed as CouncilCachePayload;
  } catch {
    return null;
  }
}

export function writeCouncilSessionSnapshot(symbol: string, targetDate: string, payload: CouncilCachePayload): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(buildSessionSnapshotKey(symbol, targetDate), JSON.stringify(payload));
  } catch {
    // best-effort
  }
}

export async function fetchAICouncilData(symbol: string, targetDate: string): Promise<CouncilCachePayload> {
  let res = await fetch(`/api/predictions?symbol=${symbol}&limit=10&mode=full&targetDate=${targetDate}`);
  if (res.status === 401) {
    await getCurrentUser();
    res = await fetch(`/api/predictions?symbol=${symbol}&limit=10&mode=full&targetDate=${targetDate}`);
  }
  if (!res.ok) {
    const error = new Error('Failed to fetch council data') as Error & { status?: number };
    error.status = res.status;
    throw error;
  }

  const data = await res.json();
  const allPreds = data.predictions as AIPrediction[];
  const relevantPreds = allPreds.filter((pred) => pred.target_date === targetDate);
  return {
    data: relevantPreds,
    fetchedAt: Date.now(),
  };
}
