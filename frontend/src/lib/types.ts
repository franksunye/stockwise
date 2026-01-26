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
    signal: 'Long' | 'Short' | 'Side';
    confidence: number;
    support_price: number;
    ai_reasoning: string;
    validation_status: 'Pending' | 'Correct' | 'Incorrect' | 'Neutral';
    actual_change: number | null;
    model?: string; // model_id (legacy or identifier)
    display_name?: string; // Display name from DB
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
    reason: string;
}

// 推理链步骤（用于三层体验的"分析过程"展示）
export interface ReasoningStep {
    step: 'trend' | 'momentum' | 'volume' | 'history' | 'decision';
    data: string;       // 关键数据点（≤20字）
    conclusion: string; // 判断结论（≤15字）
}

// 战术数据包 (AI Reasoning 的解析格式)
export interface TacticalData {
    summary: string;
    news_analysis?: string[]; // AI 抓取的关键新闻摘要
    reasoning_trace: ReasoningStep[]; // 5步推理链，替代原 analysis
    tactics: {
        holding: Tactic[];
        empty: Tactic[];
        general?: Tactic[];
    };
    key_levels?: {
        support: number;
        resistance: number;
        stop_loss: number;
    };
    conflict_resolution: string;
    tomorrow_focus?: string;
    is_llm?: boolean;
    model?: string;
}

// Dashboard 页面聚合数据
export interface StockData {
    symbol: string;
    name: string;
    price: DailyPrice | null;
    prediction: AIPrediction | null;
    previousPrediction: AIPrediction | null;
    history: AIPrediction[];
    lastUpdated: string;
    rule: UserRule | null;
    loading: boolean;
    justUpdated?: boolean; // 标记刚刚更新，用于触发UI动画
    loadingMore?: boolean;
    hasMoreHistory?: boolean;
}
