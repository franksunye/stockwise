'use client';

import type { ReactNode } from 'react';
import { Loader2, Plus, Search } from 'lucide-react';

import type { AppLocale } from '@/lib/i18n';
import { getLocalizedStockName } from '@/lib/stock-name';
import { getMarketBadge } from '@/lib/market-badge';
import type { StockSearchHit } from '@/hooks/useStockSymbolSearch';

export type StockSymbolSearchFieldProps = {
    query: string;
    onQueryChange: (value: string) => void;
    searchResults: StockSearchHit[];
    showSuggestions: boolean;
    onShowSuggestionsChange: (open: boolean) => void;
    searching: boolean;
    runSearchNow: () => void;
    locale: AppLocale;
    stockLocale: 'en' | 'cn';
    onSelect: (hit: StockSearchHit) => void;
    placeholder: string;
    noResultsText: string;
    autoFocus?: boolean;
    className?: string;
    /** Rendered between the input row and the suggestion list (e.g. limit / error copy). */
    belowInput?: ReactNode;
    /** Optional label for manual symbol entry when the API returns no rows. */
    continueAsCodeText?: string;
    onContinueAsCode?: () => void;
};

export function StockSymbolSearchField({
    query,
    onQueryChange,
    searchResults,
    showSuggestions,
    onShowSuggestionsChange,
    searching,
    runSearchNow,
    locale,
    stockLocale,
    onSelect,
    placeholder,
    noResultsText,
    autoFocus,
    className,
    belowInput,
    continueAsCodeText,
    onContinueAsCode,
}: StockSymbolSearchFieldProps) {
    return (
        <div className={className ?? 'relative'}>
            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                <input
                    autoFocus={autoFocus}
                    type="text"
                    value={query}
                    onChange={(e) => onQueryChange(e.target.value)}
                    onFocus={() => {
                        if (searchResults.length > 0) onShowSuggestionsChange(true);
                    }}
                    onKeyDown={(e) => {
                        if (e.key !== 'Enter') return;
                        e.preventDefault();
                        runSearchNow();
                    }}
                    placeholder={placeholder}
                    className="w-full bg-black/40 border border-white/5 rounded-2xl pl-11 pr-10 py-4 mono text-sm focus:outline-none focus:border-indigo-500/50 focus:bg-black/60 transition-colors placeholder:text-slate-600"
                />
                {searching ? (
                    <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-indigo-400" />
                ) : null}
            </div>
            {belowInput}
            {showSuggestions && searchResults.length > 0 ? (
                <div className="mt-4 space-y-2 max-h-60 overflow-y-auto">
                    {searchResults.map((item) => {
                        const badge = getMarketBadge(item.market, 'compact', locale);
                        return (
                            <button
                                key={item.symbol}
                                type="button"
                                onClick={() => onSelect(item)}
                                className="w-full flex items-center justify-between p-4 bg-white/5 rounded-2xl hover:bg-white/10 transition-colors"
                            >
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                    <div
                                        className={`w-10 h-10 rounded-xl flex items-center justify-center text-[10px] font-black shrink-0 ${badge.className}`}
                                    >
                                        {badge.label}
                                    </div>
                                    <div className="text-left min-w-0">
                                        <p className="text-sm font-bold truncate">
                                            {getLocalizedStockName(item, stockLocale)}
                                        </p>
                                        <p className="text-[10px] text-slate-500 mono uppercase">
                                            {item.symbol}
                                            {badge.suffix}
                                        </p>
                                    </div>
                                </div>
                                <Plus size={16} className="text-slate-500 shrink-0" />
                            </button>
                        );
                    })}
                </div>
            ) : null}
            {showSuggestions &&
            searchResults.length === 0 &&
            query.trim().length > 0 &&
            !searching ? (
                <div className="mt-4 py-8 text-center text-slate-500 text-xs">
                    <p className="mb-1">{noResultsText}</p>
                    {continueAsCodeText && onContinueAsCode ? (
                        <button
                            type="button"
                            onClick={onContinueAsCode}
                            className="mt-2 text-[10px] font-black uppercase tracking-widest text-indigo-400 hover:text-indigo-300"
                        >
                            {continueAsCodeText}
                        </button>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}
