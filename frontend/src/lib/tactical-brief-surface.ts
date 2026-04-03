import type { ShortMetrics, TacticalData, Tactic } from '@/lib/types';

export type BriefSourceKind = 'llm' | 'rule';
export type ScenarioKind = 'holding_profit' | 'holding_loss' | 'empty';
export type ScenarioTactic = Tactic & { __placeholder?: boolean };

export interface PriceLevelNode {
    id: string;
    price: number;
    label: string;
    kind: 'resistance' | 'target' | 'current' | 'support' | 'stoploss' | 'breakout';
    description: string;
    action: string;
    __i18n?: {
        key: string;
        ordinal?: string;
    };
}

export interface ShortPressureState {
    shortRatio: number | null;
    label: string;
    color: string;
    interpretation: string;
}

const PRIORITY_ORDER: Record<string, number> = { P1: 1, P2: 2, P3: 3 };

/** Leaf tokens that map 1:1 to `brief.actions.*` message keys (ASCII only). */
const CANONICAL_ACTION_LEAVES = new Set(['observe', 'watch', 'defense', 'long', 'profit']);

/** Normalized slugs that exist under `brief.actions` in messages. */
export const BRIEF_ACTION_I18N_SLUGS = ['observe', 'defense', 'long', 'profit'] as const;
export type BriefActionI18nSlug = (typeof BRIEF_ACTION_I18N_SLUGS)[number];

export function isBriefActionI18nSlug(s: string): s is BriefActionI18nSlug {
    return (BRIEF_ACTION_I18N_SLUGS as readonly string[]).includes(s);
}

/** Translate tactic `action` when it maps to `brief.actions.*`; otherwise show legacy / free-text (no fake i18n keys). */
export function formatBriefActionLabel(action: string | undefined, translateAction: (slug: BriefActionI18nSlug) => string): string {
    const slug = normalizeActionLabel(action);
    if (isBriefActionI18nSlug(slug)) {
        return translateAction(slug);
    }
    return normalizeLegacyTerms(slug);
}

const createPlaceholderTactic = (kind: ScenarioKind, idx: number): ScenarioTactic => {
    const templates: Record<ScenarioKind, ScenarioTactic[]> = {
        holding_profit: [
            {
                priority: 'P1',
                action: 'observe', // actions.observe
                trigger: 'trigger.not_below_support_1',
                reason: 'reason.discipline',
                target_price: undefined,
                stop_advance_price: undefined,
                __placeholder: true,
            },
            {
                priority: 'P2',
                action: 'profit', // actions.profit
                trigger: 'trigger.near_resistance_1',
                reason: 'reason.lock_profit',
                target_price: undefined,
                stop_advance_price: undefined,
                __placeholder: true,
            },
        ],
        holding_loss: [
            {
                priority: 'P1',
                action: 'defense', // actions.defense
                trigger: 'trigger.break_support_1',
                reason: 'reason.control_drawdown',
                stop_loss_price: undefined,
                __placeholder: true,
            },
            {
                priority: 'P2',
                action: 'defense',
                trigger: 'trigger.rebound_resistance',
                reason: 'reason.reduce_exposure',
                stop_loss_price: undefined,
                __placeholder: true,
            },
        ],
        empty: [
            {
                priority: 'P1',
                action: 'observe',
                trigger: 'trigger.wait_support_stable',
                reason: 'reason.right_side_signal',
                buy_zone_price: undefined,
                __placeholder: true,
            },
            {
                priority: 'P2',
                action: 'long', // actions.long
                trigger: 'trigger.breakout_confirmation',
                reason: 'reason.confirm_before_entry',
                buy_zone_price: undefined,
                __placeholder: true,
            },
        ],
    };

    return templates[kind][idx] ?? templates[kind][1];
};

export function normalizeActionLabel(action: string | undefined): string {
    if (!action) return 'observe';
    const trimmed = action.trim();
    const a = trimmed.toLowerCase();

    // LLM sometimes echoes `brief.actions.<free text>`; only treat leaf as i18n slug if it is canonical.
    if (a.startsWith('dashboard.actions.') || a.startsWith('brief.actions.')) {
        const leaf = trimmed.split('.').pop()?.trim() ?? '';
        const leafKey = leaf.toLowerCase();
        if (leafKey && CANONICAL_ACTION_LEAVES.has(leafKey)) {
            return leafKey === 'watch' ? 'observe' : leafKey;
        }
        if (leaf) {
            return normalizeActionLabel(leaf);
        }
    }

    if (a === 'observe' || a === 'watch') return 'observe';
    if (a === 'defense') return 'defense';
    if (a === 'long') return 'long';
    if (a === 'profit') return 'profit';
    if (a.includes('观察') || a.includes('观望') || a.includes('空仓')) return 'observe';
    if (a.includes('observe') || a.includes('watch')) return 'observe';
    if (a.includes('止损') || a.includes('减仓') || a.includes('防守') || a.includes('defense')) return 'defense';
    if (a.includes('加仓') || a.includes('跟随') || a.includes('买入') || a.includes('long') || a.includes('交易')) return 'long';
    if (a.includes('落袋') || a.includes('止盈') || a.includes('离场') || a.includes('profit')) return 'profit';
    // Unmapped free text: show as-is (no fake i18n key); caller may pass through translate or legacy normalize.
    return trimmed;
}

export function normalizeLegacyTerms(text: string): string {
    if (!text) return text;
    // Note: These replacements are becoming less necessary as we move to i18n keys for LLM instructions too,
    // but we keep them for legacy data points.
    return text
        .replace(/建议进场/g, '建议看多')
        .replace(/可进攻/g, '可交易')
        .replace(/触发进攻条件/g, '触发交易条件')
        .replace(/进攻候选/g, '看多候选')
        .replace(/进攻/g, '交易');
}

export function getBriefSourceKind(data: TacticalData, model?: string): BriefSourceKind {
    return data.is_llm || (model && model !== 'rule-based') ? 'llm' : 'rule';
}

export function getPriceNodes(data: TacticalData, currentPrice?: number): PriceLevelNode[] {
    const nodes: PriceLevelNode[] = [];

    const add = (
        raw: number | string | number[] | undefined,
        key: string,
        kind: PriceLevelNode['kind'],
        action: string,
    ) => {
        const list = Array.isArray(raw) ? raw : [raw];
        const parsed = list
            .map((value) => (typeof value === 'number' ? value : Number(value)))
            .filter((value) => Number.isFinite(value));
        const prices = Array.from(new Map(parsed.map((value) => [value.toFixed(4), value])).values());

        prices.forEach((price, idx) => {
            const ordinals = ['first', 'second', 'third'];
            const ordinalKey = prices.length > 1 ? ordinals[idx] : undefined;
            
            nodes.push({
                id: `${kind}-${idx}-${price}`,
                price,
                // Label structure for i18n: { key, ordinal }
                label: ordinalKey ? `ordinals.${ordinalKey}` : `levelLabels.${key}`, 
                kind,
                description: `levelDescriptions.${key}`,
                action: normalizeActionLabel(action),
                // Extra field for complex labels
                __i18n: { 
                  key, 
                  ordinal: ordinalKey 
                }
            });
        });
    };

    if (data?.key_levels?.strong_resistance) {
        add(data.key_levels.strong_resistance, 'resistance', 'resistance', 'profit');
    }
    if (data?.key_levels?.resistance || data?.key_levels?.immediate_resistance) {
        add(data.key_levels.immediate_resistance || data.key_levels.resistance, 'target', 'target', 'profit');
    }
    if (data?.key_levels?.breakout_confirmation_level) {
        add(data.key_levels.breakout_confirmation_level, 'breakout', 'breakout', 'long');
    }
    if (currentPrice) {
        nodes.push({
            id: 'current',
            price: currentPrice,
            label: 'levelLabels.current',
            kind: 'current',
            description: 'levelDescriptions.current',
            action: 'observe',
            __i18n: { key: 'current' }
        });
    }
    if (data?.key_levels?.support || data?.key_levels?.immediate_support) {
        add(data.key_levels.immediate_support || data.key_levels.support, 'support', 'support', 'defense');
    }
    if (data?.key_levels?.strong_support) {
        add(data.key_levels.strong_support, 'strongSupport', 'support', 'long');
    }
    if (data?.key_levels?.stop_loss_reference || data?.key_levels?.stop_loss) {
        add(data.key_levels.stop_loss_reference || data.key_levels.stop_loss, 'stoploss', 'stoploss', 'defense');
    }

    return nodes
        .sort((a, b) => b.price - a.price)
        .filter((node, idx, self) => idx === 0 || Math.abs(node.price - self[idx - 1].price) > 0.001);
}

export function normalizeScenarioTactics(items: Tactic[] | undefined, kind: ScenarioKind): ScenarioTactic[] {
    const list = Array.isArray(items) ? items : [];
    const normalized = list
        .filter((item) => item && typeof item.action === 'string' && typeof item.trigger === 'string')
        .map((item) => ({
            ...item,
            priority: (String(item.priority).toUpperCase() as Tactic['priority']) || 'P3',
            __placeholder: false,
        }))
        .sort((a, b) => (PRIORITY_ORDER[a.priority] || 99) - (PRIORITY_ORDER[b.priority] || 99));

    const deduped: ScenarioTactic[] = [];
    const seen = new Set<string>();
    for (const tactic of normalized) {
        const key = `${tactic.action.trim()}|${tactic.trigger.trim()}`.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        deduped.push(tactic);
        if (deduped.length === 2) break;
    }

    while (deduped.length < 2) {
        deduped.push(createPlaceholderTactic(kind, deduped.length));
    }

    return deduped.slice(0, 2);
}

export function getShortPressureState(symbol: string, shortMetrics?: ShortMetrics | null): ShortPressureState {
    const isHK = symbol.length === 5;
    const rawRatio = shortMetrics?.short_turnover_ratio;
    const shortRatio = rawRatio === null || rawRatio === undefined
        ? null
        : Number.isFinite(Number(rawRatio))
            ? Number(rawRatio)
            : null;

    if (!isHK) {
        return { shortRatio, label: 'shortInterpretations.onlyHK', color: 'text-slate-500', interpretation: 'shortInterpretations.onlyHK' };
    }
    if (shortRatio === null) {
        return { shortRatio, label: 'staleDate', color: 'text-slate-500', interpretation: 'shortInterpretations.waitingData' };
    }
    if (shortRatio > 0.25) {
        return { shortRatio, label: 'shortLevels.extreme', color: 'text-rose-500', interpretation: 'shortInterpretations.extreme' };
    }
    if (shortRatio > 0.15) {
        return { shortRatio, label: 'shortLevels.high', color: 'text-rose-400', interpretation: 'shortInterpretations.high' };
    }
    if (shortRatio >= 0.05) {
        return { shortRatio, label: 'shortLevels.mid', color: 'text-amber-400', interpretation: 'shortInterpretations.mid' };
    }
    return { shortRatio, label: 'shortLevels.low', color: 'text-emerald-400', interpretation: 'shortInterpretations.low' };
}

export function getGeneralTactics(data: TacticalData): Tactic[] {
    const rawGeneral = data?.tactics?.general;
    return Array.isArray(rawGeneral) ? rawGeneral : rawGeneral ? [rawGeneral] : [];
}

export function getScenarioTacticGroups(data: TacticalData): {
    scenarioHoldingProfit: ScenarioTactic[];
    scenarioHoldingLoss: ScenarioTactic[];
    scenarioEmpty: ScenarioTactic[];
} {
    const profitRaw = [...(data?.tactics?.holding_profit || []), ...(data?.tactics?.holding || [])];

    return {
        scenarioHoldingProfit: normalizeScenarioTactics(profitRaw, 'holding_profit'),
        scenarioHoldingLoss: normalizeScenarioTactics(data?.tactics?.holding_loss || [], 'holding_loss'),
        scenarioEmpty: normalizeScenarioTactics(data?.tactics?.empty || [], 'empty'),
    };
}
