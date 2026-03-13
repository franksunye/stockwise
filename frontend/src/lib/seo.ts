import type { Metadata } from "next";
import {
  DEFAULT_PUBLIC_LOCALE,
  getLocaleHrefLang,
  isIndexablePublicLocale,
  localizePublicPath,
  type PublicLocale,
} from "@/lib/public-i18n";

export interface SeoInput {
  title: string;
  description: string;
  path: string;
  keywords?: string[];
  type?: "website" | "article";
  locale?: PublicLocale;
  canonicalPath?: string;
  canonicalLocale?: PublicLocale;
  alternateLocales?: PublicLocale[];
  index?: boolean;
  follow?: boolean;
}

function normalizePath(path: string): string {
  if (!path.startsWith("/")) return `/${path}`;
  return path;
}

export function buildCanonicalUrl(baseUrl: string, path: string): string {
  const normalized = normalizePath(path);
  return `${baseUrl.replace(/\/$/, "")}${normalized}`;
}

export function buildPageMetadata(baseUrl: string, input: SeoInput): Metadata {
  const locale = input.locale || DEFAULT_PUBLIC_LOCALE;
  const canonicalLocale = input.canonicalLocale || locale;
  const currentPath = localizePublicPath(input.path, locale);
  const canonicalPath = localizePublicPath(input.canonicalPath || input.path, canonicalLocale);
  const canonical = buildCanonicalUrl(baseUrl, canonicalPath);
  const ogType = input.type || "website";
  const alternateLocales = input.alternateLocales || [DEFAULT_PUBLIC_LOCALE, "en"];
  const languages = Object.fromEntries(
    alternateLocales.map((altLocale) => [
      getLocaleHrefLang(altLocale),
      buildCanonicalUrl(baseUrl, localizePublicPath(input.path, altLocale)),
    ])
  );
  languages["x-default"] = buildCanonicalUrl(baseUrl, localizePublicPath(input.path, DEFAULT_PUBLIC_LOCALE));
  const index = input.index ?? isIndexablePublicLocale(locale);
  const follow = input.follow ?? true;

  return {
    title: input.title,
    description: input.description,
    keywords: input.keywords,
    alternates: {
      canonical,
      languages,
    },
    robots: {
      index,
      follow,
    },
    openGraph: {
      title: input.title,
      description: input.description,
      url: buildCanonicalUrl(baseUrl, currentPath),
      type: ogType,
      locale: getLocaleHrefLang(locale).replace("-", "_"),
    },
    twitter: {
      card: "summary_large_image",
      title: input.title,
      description: input.description,
    },
  };
}
