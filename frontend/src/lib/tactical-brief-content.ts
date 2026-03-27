import type { AIPrediction, TacticalData, Tactic, VisualStory } from './types';

interface PosterSurfaceOptions {
    prediction: AIPrediction;
    userPos?: 'holding' | 'empty' | 'none';
}

export interface PosterSurface {
    tacticalData: TacticalData | null;
    story: VisualStory | null;
    intelligence: string;
    tacticText: string;
    resistanceText: string;
    supportText: string;
}

function normalizeLegacyTerms(text: string): string {
    if (!text) return text;
    return text
        .replace(/建议进场/g, '建议看多')
        .replace(/可进攻/g, '可交易')
        .replace(/触发进攻条件/g, '触发交易条件')
        .replace(/进攻候选/g, '看多候选')
        .replace(/进攻/g, '交易');
}

export function parseTacticalData(reasoning: string | undefined): TacticalData | null {
    if (!reasoning) return null;
    try {
        return JSON.parse(reasoning) as TacticalData;
    } catch {
        return null;
    }
}

export function getFirstSentence(text: string | null | undefined): string | null {
    if (!text) return null;
    const normalized = text.trim();
    if (!normalized) return null;
    const match = normalized.match(/^.+?[。！？!?]/);
    return match ? match[0] : normalized;
}

export function getTacticalSummary(reasoning: string | undefined): string {
    const parsed = parseTacticalData(reasoning);
    if (!parsed) return reasoning || '';
    const content = String(parsed.summary || (parsed as unknown as Record<string, unknown>).analysis || reasoning || '');
    return normalizeLegacyTerms(content);
}

export function getTacticalConflictSummary(reasoning: string | undefined): string | null {
    const parsed = parseTacticalData(reasoning);
    if (!parsed) return null;
    const conflict = parsed.conflict_resolution;
    return typeof conflict === 'string' && conflict.trim() ? normalizeLegacyTerms(conflict.trim()) : null;
}

export function getNormalizedNewsItems(data: TacticalData | null | undefined): string[] {
    if (!data?.news_analysis) return [];
    if (Array.isArray(data.news_analysis)) {
        return data.news_analysis
            .map((item) => normalizeLegacyTerms(String(item || '').trim()))
            .filter(Boolean);
    }
    const single = normalizeLegacyTerms(String(data.news_analysis).trim());
    return single ? [single] : [];
}

function pickTopTactic(data: TacticalData | null, userPos?: 'holding' | 'empty' | 'none'): Tactic | null {
    if (!data?.tactics) return null;
    if (userPos === 'holding') {
        return data.tactics.holding_profit?.[0] || data.tactics.holding_loss?.[0] || null;
    }
    return data.tactics.empty?.[0] || data.tactics.general?.[0] || data.tactics.holding_profit?.[0] || null;
}

export function getPosterSurface({ prediction, userPos = 'none' }: PosterSurfaceOptions): PosterSurface {
    const tacticalData = parseTacticalData(prediction.ai_reasoning);
    const story = tacticalData?.visual_story || null;
    const keyLevels = tacticalData?.key_levels;

    let intelligence = '';
    if (tacticalData?.summary) {
        intelligence = normalizeLegacyTerms(tacticalData.summary);
    } else if (tacticalData?.reasoning_trace?.length) {
        intelligence = normalizeLegacyTerms(tacticalData.reasoning_trace[0].data);
    }
    if (intelligence.length > 70) {
        intelligence = `${intelligence.substring(0, 69)}...`;
    }

    const topTactic = pickTopTactic(tacticalData, userPos);

    return {
        tacticalData,
        story,
        intelligence,
        tacticText: normalizeLegacyTerms(topTactic?.action || ''),
        resistanceText: String(keyLevels?.strong_resistance || keyLevels?.resistance || ''),
        supportText: String(keyLevels?.stop_loss_reference || keyLevels?.strong_support || keyLevels?.support || ''),
    };
}
