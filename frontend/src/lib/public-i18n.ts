export const DEFAULT_PUBLIC_LOCALE = 'zh' as const;
export const SUPPORTED_PUBLIC_LOCALES = ['zh', 'en'] as const;
export const INDEXABLE_PUBLIC_LOCALES = ['zh'] as const;
export const PUBLIC_ROUTE_ALLOWLIST = ['/', '/about', '/pricing', '/privacy', '/terms', '/refund', '/learn', '/support'] as const;

export type PublicLocale = (typeof SUPPORTED_PUBLIC_LOCALES)[number];

const APP_EXCLUDED_PREFIXES = ['/dashboard', '/admin', '/status', '/api'] as const;

export function isSupportedPublicLocale(value: string | null | undefined): value is PublicLocale {
  if (!value) return false;
  return SUPPORTED_PUBLIC_LOCALES.includes(value as PublicLocale);
}

export function getPublicLocaleFromPathname(pathname: string): PublicLocale {
  const [, maybeLocale] = pathname.split('/');
  if (isSupportedPublicLocale(maybeLocale)) {
    return maybeLocale;
  }
  return DEFAULT_PUBLIC_LOCALE;
}

export function stripPublicLocalePrefix(pathname: string): string {
  const [, maybeLocale, ...rest] = pathname.split('/');
  if (!isSupportedPublicLocale(maybeLocale)) {
    return pathname || '/';
  }

  const nextPath = `/${rest.join('/')}`.replace(/\/+/g, '/');
  return nextPath === '/' ? '/' : nextPath.replace(/\/$/, '') || '/';
}

export function hasPublicLocalePrefix(pathname: string): boolean {
  const [, maybeLocale] = pathname.split('/');
  return isSupportedPublicLocale(maybeLocale);
}

export function localizePublicPath(path: string, locale: PublicLocale): string {
  const normalized = normalizePublicPath(path);
  if (locale === DEFAULT_PUBLIC_LOCALE) return normalized;
  if (normalized === '/') return `/${locale}`;
  return `/${locale}${normalized}`;
}

export function normalizePublicPath(path: string): string {
  if (!path.startsWith('/')) return `/${path}`;
  if (path.length > 1 && path.endsWith('/')) return path.slice(0, -1);
  return path;
}

export function isIndexablePublicLocale(locale: PublicLocale): boolean {
  return (INDEXABLE_PUBLIC_LOCALES as readonly PublicLocale[]).includes(locale);
}

export function isExcludedAppPath(pathname: string): boolean {
  return APP_EXCLUDED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function getLocaleHrefLang(locale: PublicLocale): string {
  return locale === 'zh' ? 'zh-CN' : 'en';
}

export function getHtmlLang(locale: PublicLocale): string {
  return locale === 'zh' ? 'zh-CN' : 'en';
}
