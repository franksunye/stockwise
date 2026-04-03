/**
 * i18n Engine — Dashboard Application Locale Infrastructure
 *
 * Design: Zero-dependency, ISR-compatible, type-safe.
 * - Messages are static JSON imports (build-time assets, zero runtime fetch).
 * - Locale detection: localStorage → user profile → navigator.language → default 'cn'.
 * - Supports {param} placeholder interpolation.
 *
 * @module lib/i18n
 */

import cnMessages from '@/messages/cn.json';
import enMessages from '@/messages/en.json';

// ─── Locale Types ───────────────────────────────────────────────

export const APP_LOCALES = ['cn', 'en'] as const;
export type AppLocale = (typeof APP_LOCALES)[number];

export const DEFAULT_APP_LOCALE: AppLocale = 'cn';

const LOCALE_STORAGE_KEY = 'stockwise_locale';

// ─── Message Types ──────────────────────────────────────────────

/** Full message bundle type, inferred from the Chinese JSON (source of truth). */
export type MessageBundle = typeof cnMessages;

/** Namespace = top-level key in the JSON. */
export type MessageNamespace = keyof MessageBundle;

/**
 * Recursively flatten a nested object type into dot-separated key paths.
 * e.g. { a: { b: "x" } } → "a.b"
 */
type FlattenKeys<T, Prefix extends string = ''> = T extends string
  ? Prefix
  : {
      [K in keyof T & string]: FlattenKeys<
        T[K],
        Prefix extends '' ? K : `${Prefix}.${K}`
      >;
    }[keyof T & string];

/** All possible dot-separated translation keys within a namespace. */
export type MessageKey<NS extends MessageNamespace> = FlattenKeys<MessageBundle[NS]>;

/** All possible dot-separated translation keys across the entire bundle. */
export type FullMessageKey = FlattenKeys<MessageBundle>;

// ─── Message Registry ───────────────────────────────────────────

const MESSAGE_REGISTRY: Record<AppLocale, MessageBundle> = {
  cn: cnMessages,
  en: enMessages,
};

// ─── Locale Detection ───────────────────────────────────────────

export function isAppLocale(value: unknown): value is AppLocale {
  return typeof value === 'string' && APP_LOCALES.includes(value as AppLocale);
}

/**
 * Resolve the user's preferred locale.
 *
 * Priority:
 * 1. localStorage cache (fastest, zero-latency)
 * 2. Explicit override (from user profile API)
 * 3. navigator.language / Accept-Language
 * 4. Default: 'cn'
 */
export function resolveLocale(profileLocale?: string | null): AppLocale {
  // 1. localStorage cache
  if (typeof window !== 'undefined') {
    try {
      const cached = localStorage.getItem(LOCALE_STORAGE_KEY);
      if (isAppLocale(cached)) return cached;
    } catch {
      // SSR or storage unavailable
    }
  }

  // 2. User profile locale
  if (isAppLocale(profileLocale)) return profileLocale;

  // 3. Browser language
  if (typeof navigator !== 'undefined') {
    const browserLang = navigator.language?.toLowerCase() ?? '';
    if (browserLang.startsWith('zh')) return 'cn';
    if (browserLang.startsWith('en')) return 'en';
  }

  // 4. Default
  return DEFAULT_APP_LOCALE;
}

/**
 * Persist locale choice to localStorage.
 */
export function persistLocale(locale: AppLocale): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    } catch {
      // Storage unavailable
    }
  }
}

// ─── Translation Engine ─────────────────────────────────────────

/**
 * Get the full message bundle for a locale.
 */
export function getMessages(locale: AppLocale): MessageBundle {
  return MESSAGE_REGISTRY[locale] ?? MESSAGE_REGISTRY[DEFAULT_APP_LOCALE];
}

/**
 * Resolve a dot-separated key path against a nested object.
 * e.g. resolve(messages, 'dashboard.signal.buy') → '建议看多'
 */
function resolveKeyPath(obj: unknown, keyPath: string): string | undefined {
  const parts = keyPath.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  return typeof current === 'string' ? current : undefined;
}

/**
 * Interpolate {param} placeholders in a translated string.
 * e.g. interpolate('到期时间: {date}', { date: '2026-04-01' }) → '到期时间: 2026-04-01'
 */
function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = params[key];
    return value != null ? String(value) : `{${key}}`;
  });
}

/**
 * Create a scoped translation function for a namespace.
 *
 * Usage:
 * ```ts
 * const t = createTranslator(messages, 'dashboard');
 * t('signal.buy')           // → '建议看多'
 * t('date.closePrice', { date: '12/24' })  // → '12/24 收盘价'
 * ```
 */
export function createTranslator<NS extends MessageNamespace>(
  messages: MessageBundle,
  namespace: NS,
): (key: MessageKey<NS>, params?: Record<string, string | number>) => string {
  const nsMessages = messages[namespace];

  return (key, params?) => {
    const raw = resolveKeyPath(nsMessages, key as string);
    if (raw == null) {
      // Development warning: missing key
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[i18n] Missing key: ${namespace}.${key as string}`);
      }
      return `${namespace}.${key as string}`;
    }
    return interpolate(raw, params);
  };
}

/**
 * Global translation function (without namespace scoping).
 *
 * Usage:
 * ```ts
 * const t = createGlobalTranslator(messages);
 * t('dashboard.signal.buy')  // → '建议看多'
 * ```
 */
export function createGlobalTranslator(
  messages: MessageBundle,
): (key: FullMessageKey, params?: Record<string, string | number>) => string {
  return (key, params?) => {
    const raw = resolveKeyPath(messages, key as string);
    if (raw == null) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[i18n] Missing key: ${key as string}`);
      }
      return key as string;
    }
    return interpolate(raw, params);
  };
}
