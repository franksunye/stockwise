import type { AnySignalState, LegacySignalState, SignalState } from '@/lib/semantic-registry';

// 股票价格数据类型
export interface DailyPrice {
    symbol: string;
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    change_percent: number;
    ma5: number;
    ma10: number;
    ma20: number;
    ma60: number;
    macd: number;
    macd_signal: number;
    macd_hist: number;
    boll_upper: number;
    boll_mid: number;
    boll_lower: number;
    rsi: number;
    kdj_k: number;
    kdj_d: number;
    kdj_j: number;
    ai_summary: string | null;
}

// 用户规则类型
export interface UserRule {
    support_price: number | null;
    pressure_price: number | null;
    min_volume: number | null;
    position: 'holding' | 'empty' | 'none';
    last_updated: number;
}
// AI 预测数据类型
export interface AIPrediction {
    symbol: string;
    date: string;
    target_date: string;
    updated_at?: string;
    signal: LegacySignalState; // compatibility field; may include mode overlay
    canonical_signal?: AnySignalState; // base stored final signal before mode overlay
    llm_signal?: string; // AI-side conclusion extracted from ai_reasoning
    confidence: number;
    support_price: number;
    ai_reasoning: string; // existing reasoning payload stored in ai_predictions_v2
    llm_reasoning?: string; // alias for AI-side reasoning view; currently equals ai_reasoning
    validation_status: 'Pending' | 'Correct' | 'Incorrect' | 'Neutral' | 'Verifying';
    actual_change: number | null;
    validation_data?: {
        window: number;
        days_evaluated: number;
        trajectory: Array<{ date: string, change: number, cum_change: number, close?: number }>;
        t1_change?: number;
        cum_change?: number;
        max_cum_change?: number;
        min_cum_change?: number;
        max_perf?: number;
        signal_family?: 'canonical' | 'legacy';
        normalized_signal?: string;
        effective_signal?: string;
        market?: string;
        semantic_verdict?: 'Validated' | 'WeakValidated' | 'Invalidated' | 'PendingWindow';
        outcome_verdict?: 'Strong' | 'Neutral' | 'Weak' | 'Adverse' | 'PendingWindow';
        reason_code?: string;
    } | string;
    max_perf_in_window?: number;
    layer1_status?: SignalState; // compatibility field; may include mode overlay
    layer1_signal?: SignalState; // base stored Layer-1 conclusion
    layer1_score?: number;
    layer1_trigger_hit?: number;
    layer1_risk_off_hit?: number;
    layer1_strategy_version?: string;
    layer1_payload?: string;
    model?: string; // model_id (legacy or identifier)
    display_name?: string; // Display name from DB
    /** Language of stored ai_reasoning / prompt (`cn` | `en`), from ai_predictions_v2.content_locale */
    content_locale?: 'cn' | 'en';
    is_primary?: number | boolean; // Whether it is the primary prediction
    close_price?: number;
    // 技术指标快照 (可选)
    rsi?: number;
    kdj_k?: number;
    kdj_d?: number;
    kdj_j?: number;
    macd?: number;
    macd_signal?: number;
    macd_hist?: number;
    boll_upper?: number;
    boll_lower?: number;
    boll_mid?: number;
}

// 战术建议明细
export interface Tactic {
    priority: "P1" | "P2" | "P3";
    action: string;
    trigger: string;
    target_price?: number | string | number[];
    stop_advance_price?: number | string | number[];
    stop_loss_price?: number | string | number[];
    buy_zone_price?: number | string | number[];
    reason: string;
}

// 推理链步骤（用于三层体验的"分析过程"展示）
export interface ReasoningStep {
    step: string;
    data: string;       // 关键数据点（≤20字）
    conclusion: string; // 判断结论（≤15字）
}

// 视觉叙事数据类型 (Silent Math)
export interface VisualStory {
    token: string;
    almanac: string;
    visual_state: string;
    wisdom?: string;
    aesthetic: {
        hue: string;
        mood: string;
        dynamic_clues: string[];
    };
    meta_version: string;
}

// 战术数据包 (AI Reasoning 的解析格式)
export interface TacticalData {
    summary: string;
    news_analysis?: string[] | string; // AI 抓取的关键新闻摘要
    reasoning_trace: ReasoningStep[]; // 5步推理链，替代原 analysis
    tactics: {
        holding_profit: Tactic[];
        holding_loss: Tactic[];
        empty: Tactic[];
        holding?: Tactic[]; // Legacy
        general?: Tactic[];
    };
    key_levels?: {
        // 新型粒度字段
        immediate_support?: number[];
        immediate_resistance?: number[];
        strong_support?: number | string;
        strong_resistance?: number | string;
        breakout_confirmation_level?: number | string;
        stop_loss_reference?: number | string;

        // 兼容字段
        support: number;
        resistance: number;
        stop_loss: number;
    };
    conflict_resolution: string;
    tomorrow_focus?: string;
    counter_argument?: string;
    is_llm?: boolean;
    model?: string;
    visual_story?: VisualStory;
}

export interface MarketAlmanacData {
    target_date: string;
    mood_tag: string;
    action_strategy: string;
    meteorology: string;
    degraded?: boolean;
    market_entropy: {
        score: number;
        label: string;
        breadth: string;
        volume_status: string;
    };
    sector_currents: {
        main: Array<{ name: string; flow: string }>;
        inverse: Array<{ name: string; flow: string }>;
    };
    ai_insight: string;
    created_at?: string;
}

// Dashboard 页面聚合数据
export interface ShortMetrics {
    symbol: string;
    trade_date?: string | null;
    short_volume?: number | null;
    short_turnover?: number | null;
    short_volume_ratio?: number | null;
    short_turnover_ratio?: number | null;
    daily_quality_flag?: string | null;
    report_week?: string | null;
    short_interest_shares?: number | null;
    short_interest_market_value?: number | null;
    weekly_quality_flag?: string | null;
    is_eligible?: number | boolean | null;
    snapshot_date?: string | null;
}

export interface StockData {
    symbol: string;
    name: string;
    price: DailyPrice | null;
    prediction: AIPrediction | null;
    previousPrediction: AIPrediction | null;
    history: AIPrediction[];
    shortMetrics?: ShortMetrics | null;
    lastUpdated: string;
    rule: UserRule | null;
    loading: boolean;
    justUpdated?: boolean; // 标记刚刚更新，用于触发UI动画
    loadingMore?: boolean;
    hasMoreHistory?: boolean;
}
