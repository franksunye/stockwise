import { NextResponse } from "next/server";
import { getAllSupportArticles } from "@/lib/support-content";
import { DEFAULT_PUBLIC_LOCALE, isSupportedPublicLocale } from "@/lib/public-i18n";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const localeParam = searchParams.get("locale");
    const locale = isSupportedPublicLocale(localeParam) ? localeParam : DEFAULT_PUBLIC_LOCALE;

    const localizedArticles = getAllSupportArticles({ locale });
    if (locale === "cn") {
      return NextResponse.json(localizedArticles);
    }

    // Merge locale-specific docs with CN fallback docs by slug.
    const fallbackArticles = getAllSupportArticles({ locale: "cn" });
    const bySlug = new Map(localizedArticles.map((article) => [article.slug, article]));

    for (const fallbackArticle of fallbackArticles) {
      if (bySlug.has(fallbackArticle.slug)) continue;
      bySlug.set(fallbackArticle.slug, {
        ...fallbackArticle,
        locale,
        sourceLocale: "cn",
        translationStatus: "fallback",
        isFallback: true,
      });
    }

    return NextResponse.json(Array.from(bySlug.values()));
  } catch {
    return NextResponse.json([], { status: 500 });
  }
}
