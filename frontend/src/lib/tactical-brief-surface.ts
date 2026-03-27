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
}

export interface ShortPressureState {
    shortRatio: number | null;
    label: string;
    color: string;
    interpretation: string;
}

const PRIORITY_ORDER: Record<string, number> = { P1: 1, P2: 2, P3: 3 };

const createPlaceholderTactic = (kind: ScenarioKind, idx: number): ScenarioTactic => {
    const templates: Record<ScenarioKind, ScenarioTactic[]> = {
        holding_profit: [
            {
                priority: 'P1',
                action: '执行观察',
                trigger: '不跌破一防位',
                reason: '趋势未被破坏，先守纪律。',
                target_price: undefined,
                stop_advance_price: undefined,
                __placeholder: true,
            },
            {
                priority: 'P2',
                action: '执行落袋',
                trigger: '接近一攻位且动能放缓',
                reason: '锁定波段利润，避免冲高回落。',
                target_price: undefined,
                stop_advance_price: undefined,
                __placeholder: true,
            },
        ],
        holding_loss: [
            {
                priority: 'P1',
                action: '执行防守',
                trigger: '有效跌破一防位',
                reason: '优先控制回撤，避免亏损扩大。',
                stop_loss_price: undefined,
                __placeholder: true,
            },
            {
                priority: 'P2',
                action: '执行防守',
                trigger: '反抽压力位但未能突破',
                reason: '弱势反弹先降风险敞口。',
                stop_loss_price: undefined,
                __placeholder: true,
            },
        ],
        empty: [
            {
                priority: 'P1',
                action: '执行观察',
                trigger: '回踩一防位企稳后再评估',
                reason: '先等右侧信号，再考虑入场。',
                buy_zone_price: undefined,
                __placeholder: true,
            },
            {
                priority: 'P2',
                action: '执行交易',
                trigger: '放量突破一攻位并站稳',
                reason: '确认后再交易，避免假突破。',
                buy_zone_price: undefined,
                __placeholder: true,
            },
        ],
    };

    return templates[kind][idx] ?? templates[kind][1];
};

export function normalizeActionLabel(action: string | undefined): string {
    if (!action) return '建议观察';
    if (action.includes('观察')) return '建议观察';
    if (action.includes('止损') || action.includes('减仓') || action.includes('防守')) return '建议防守';
    if (action.includes('加仓') || action.includes('跟随') || action.includes('买')) return '建议看多';
    if (action.includes('落袋') || action.includes('止盈') || action.includes('离场')) return '建议落袋';
    return action;
}

export function normalizeLegacyTerms(text: string): string {
    if (!text) return text;
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
        label: string,
        kind: PriceLevelNode['kind'],
        description: string,
        action: string,
    ) => {
        const list = Array.isArray(raw) ? raw : [raw];
        const parsed = list
            .map((value) => (typeof value === 'number' ? value : Number(value)))
            .filter((value) => Number.isFinite(value));
        const prices = Array.from(new Map(parsed.map((value) => [value.toFixed(4), value])).values());

        prices.forEach((price, idx) => {
            const cnOrd = ['第一', '第二', '第三'];
            nodes.push({
                id: `${kind}-${idx}-${price}`,
                price,
                label: prices.length > 1 ? `${cnOrd[idx]}${label}` : label,
                kind,
                description,
                action,
            });
        });
    };

    if (data?.key_levels?.strong_resistance) {
        add(data.key_levels.strong_resistance, '强压力区', 'resistance', '核心供给区，多空博弈终点', '执行落袋');
    }
    if (data?.key_levels?.resistance || data?.key_levels?.immediate_resistance) {
        add(data.key_levels.immediate_resistance || data.key_levels.resistance, '挑战位', 'target', '局部阶段目标，注意动能释放', '执行落袋');
    }
    if (data?.key_levels?.breakout_confirmation_level) {
        add(data.key_levels.breakout_confirmation_level, '突破确认', 'breakout', '反转结构成立的关键锚点', '执行交易');
    }
    if (currentPrice) {
        nodes.push({
            id: 'current',
            price: currentPrice,
            label: '当前价',
            kind: 'current',
            description: '目前市场成交活跃点',
            action: '执行观察',
        });
    }
    if (data?.key_levels?.support || data?.key_levels?.immediate_support) {
        add(data.key_levels.immediate_support || data.key_levels.support, '防守位', 'support', '多头防线，不破即维持强势', '执行防守');
    }
    if (data?.key_levels?.strong_support) {
        add(data.key_levels.strong_support, '强支撑区', 'support', '底部核心支撑，中长期成本位', '执行交易');
    }
    if (data?.key_levels?.stop_loss_reference || data?.key_levels?.stop_loss) {
        add(data.key_levels.stop_loss_reference || data.key_levels.stop_loss, '止损参考', 'stoploss', '结构崩溃底线', '执行防守');
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
        return { shortRatio, label: '--', color: 'text-slate-500', interpretation: '仅港股显示' };
    }
    if (shortRatio === null) {
        return { shortRatio, label: '待同步', color: 'text-slate-500', interpretation: '港交所日度数据收盘后更新' };
    }
    if (shortRatio > 0.25) {
        return { shortRatio, label: '极高', color: 'text-rose-500', interpretation: '空头压力极高，优先风险控制' };
    }
    if (shortRatio > 0.15) {
        return { shortRatio, label: '高', color: 'text-rose-400', interpretation: '空头压力偏高，注意反弹质量' };
    }
    if (shortRatio >= 0.05) {
        return { shortRatio, label: '中', color: 'text-amber-400', interpretation: '空头压力中性，保持观察' };
    }
    return { shortRatio, label: '低', color: 'text-emerald-400', interpretation: '空头压力偏低，抛压有限' };
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
