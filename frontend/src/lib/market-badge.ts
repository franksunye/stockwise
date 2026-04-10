export type MarketBadge = {
  label: string;
  className: string;
  suffix: string;
};

export function getMarketBadge(market?: string, variant: 'compact' | 'full' = 'compact'): MarketBadge {
  switch (market) {
    case 'HK':
      return {
        label: variant === 'full' ? '港股' : '港',
        className: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
        suffix: '.HK',
      };
    case 'US':
      return {
        label: 'US',
        className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        suffix: '',
      };
    case 'CN':
    default:
      return {
        label: variant === 'full' ? 'A股' : 'A',
        className: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
        suffix: '',
      };
  }
}
