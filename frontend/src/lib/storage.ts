'use client';

import { UserRule } from './types';

const STORAGE_KEY = 'stock_rules';

export function getRule(symbol: string): UserRule | null {
    if (typeof window === 'undefined') return null;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    try {
        const rules = JSON.parse(stored);
        return rules[symbol] || null;
    } catch {
        return null;
    }
}

export function saveRule(symbol: string, rule: Partial<UserRule>): void {
    const stored = localStorage.getItem(STORAGE_KEY);
    const rules = stored ? JSON.parse(stored) : {};
    rules[symbol] = {
        support_price: rule.support_price ?? null,
        pressure_price: rule.pressure_price ?? null,
        min_volume: rule.min_volume ?? null,
        last_updated: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
}
