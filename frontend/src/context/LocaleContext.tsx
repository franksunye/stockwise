'use client';

/**
 * LocaleProvider — Dashboard Application i18n Context
 *
 * Provides locale state + translation functions to all Dashboard components.
 * Placed inside DashboardShell, after UserProfileProvider (so it can read profile locale).
 *
 * Exports:
 * - LocaleProvider — Context provider
 * - useLocale()   — Returns { locale, setLocale }
 * - useT(ns)      — Returns scoped t() function for a namespace
 * - useGlobalT()  — Returns global t() function (no namespace)
 *
 * @module context/LocaleContext
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import {
  type AppLocale,
  type MessageBundle,
  type MessageNamespace,
  type MessageKey,
  type FullMessageKey,
  resolveLocale,
  persistLocale,
  getMessages,
  createTranslator,
  createGlobalTranslator,
} from '@/lib/i18n';

// ─── Context Types ──────────────────────────────────────────────

interface LocaleContextValue {
  /** Current active locale. */
  locale: AppLocale;

  /** Switch locale. Persists to localStorage automatically. */
  setLocale: (locale: AppLocale) => void;

  /** Current message bundle (for advanced usage). */
  messages: MessageBundle;
}

const LocaleContext = createContext<LocaleContextValue | undefined>(undefined);

// ─── Provider ───────────────────────────────────────────────────

interface LocaleProviderProps {
  children: ReactNode;
  /** Optional locale hint from user profile (async, may arrive after mount). */
  profileLocale?: string | null;
}

export function LocaleProvider({ children, profileLocale }: LocaleProviderProps) {
  const [locale, setLocaleState] = useState<AppLocale>(() =>
    resolveLocale(profileLocale),
  );

  // When profile locale arrives asynchronously, sync if no explicit user choice
  useEffect(() => {
    if (profileLocale) {
      const hasExplicitChoice =
        typeof window !== 'undefined' &&
        localStorage.getItem('stockwise_locale') != null;

      if (!hasExplicitChoice) {
        const resolved = resolveLocale(profileLocale);
        setLocaleState(resolved);
      }
    }
  }, [profileLocale]);

  const setLocale = useCallback((newLocale: AppLocale) => {
    setLocaleState(newLocale);
    persistLocale(newLocale);
  }, []);

  const messages = useMemo(() => getMessages(locale), [locale]);

  const value = useMemo<LocaleContextValue>(
    () => ({ locale, setLocale, messages }),
    [locale, setLocale, messages],
  );

  return (
    <LocaleContext.Provider value={value}>
      {children}
    </LocaleContext.Provider>
  );
}

// ─── Hooks ──────────────────────────────────────────────────────

/**
 * Access locale state.
 *
 * @example
 * ```tsx
 * const { locale, setLocale } = useLocale();
 * ```
 */
export function useLocale(): { locale: AppLocale; setLocale: (l: AppLocale) => void } {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error('useLocale must be used within <LocaleProvider>');
  }
  return { locale: ctx.locale, setLocale: ctx.setLocale };
}

/**
 * Get a namespace-scoped translation function.
 * 
 * Keys are type-checked at compile time — misspelled keys produce TS errors.
 *
 * @example
 * ```tsx
 * const t = useT('dashboard');
 * return <span>{t('signal.buy')}</span>;       // → '建议看多'
 * return <span>{t('date.closePrice', { date: '12/24' })}</span>; // → '12/24 收盘价'
 * ```
 */
export function useT<NS extends MessageNamespace>(
  namespace: NS,
): (key: MessageKey<NS>, params?: Record<string, string | number | boolean>) => string {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error('useT must be used within <LocaleProvider>');
  }

  return useMemo(
    () => createTranslator(ctx.messages, namespace),
    [ctx.messages, namespace],
  );
}

/**
 * Get a global (un-namespaced) translation function.
 *
 * @example
 * ```tsx
 * const t = useGlobalT();
 * return <span>{t('dashboard.signal.buy')}</span>;
 * ```
 */
export function useGlobalT(): (
  key: FullMessageKey,
  params?: Record<string, string | number | boolean>,
) => string {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error('useGlobalT must be used within <LocaleProvider>');
  }

  return useMemo(
    () => createGlobalTranslator(ctx.messages),
    [ctx.messages],
  );
}
