'use client';

import { UserRule } from './types';

const RULES_KEY = 'stock_rules';
const WATCHLIST_KEY = 'stock_watchlist';
const DEFAULT_WATCHLIST: string[] = []; // 初始关注列表为空，由用户在引导流程或手动添加

export function getRule(symbol: string): UserRule | null {
    if (typeof window === 'undefined') return null;
    const stored = localStorage.getItem(RULES_KEY);
    if (!stored) return null;
    try {
        const rules = JSON.parse(stored);
        return rules[symbol] || null;
    } catch {
        return null;
    }
}

export function saveRule(symbol: string, rule: Partial<UserRule>): void {
    const stored = localStorage.getItem(RULES_KEY);
    const rules = stored ? JSON.parse(stored) : {};
    rules[symbol] = {
        support_price: rule.support_price ?? null,
        pressure_price: rule.pressure_price ?? null,
        min_volume: rule.min_volume ?? null,
        position: rule.position ?? 'none',
        last_updated: Date.now(),
    };
    localStorage.setItem(RULES_KEY, JSON.stringify(rules));
}

export function getWatchlist(): string[] {
    if (typeof window === 'undefined') return DEFAULT_WATCHLIST;
    const stored = localStorage.getItem(WATCHLIST_KEY);
    if (!stored) {
        localStorage.setItem(WATCHLIST_KEY, JSON.stringify(DEFAULT_WATCHLIST));
        return DEFAULT_WATCHLIST;
    }
    try {
        return JSON.parse(stored);
    } catch {
        return DEFAULT_WATCHLIST;
    }
}

export function addToWatchlist(symbol: string): void {
    const current = getWatchlist();
    if (!current.includes(symbol)) {
        const next = [...current, symbol];
        localStorage.setItem(WATCHLIST_KEY, JSON.stringify(next));
    }
}

export function removeFromWatchlist(symbol: string): void {
    const current = getWatchlist();
    const next = current.filter(s => s !== symbol);
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify(next));
}
