export type AppStockLocale = 'cn' | 'en';

export type StockNameFields = {
    symbol: string;
    name: string;
    name_en?: string | null;
};

/**
 * Locale-aware stock label: English UI uses `name_en` from the data layer, else symbol.
 * Chinese UI uses canonical Chinese `name`.
 */
export function getLocalizedStockName(
    stock: StockNameFields,
    locale: AppStockLocale,
): string {
    if (locale === 'en') {
        const en = stock.name_en?.trim();
        if (en) return en;
        return stock.symbol;
    }
    return stock.name;
}
