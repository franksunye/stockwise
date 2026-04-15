import { NextResponse } from "next/server";
import { getAllSupportArticles } from "@/lib/support-content";
import { DEFAULT_PUBLIC_LOCALE, isSupportedPublicLocale } from "@/lib/public-i18n";
import { getV1SupportAllowlist } from "@/lib/support-v1";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const localeParam = searchParams.get("locale");
    const locale = isSupportedPublicLocale(localeParam) ? localeParam : DEFAULT_PUBLIC_LOCALE;
    // Strict locale mode: only return articles available in requested locale.
    const localizedArticles = getAllSupportArticles({ locale, fallbackToDefault: false });
    const allowlist = getV1SupportAllowlist(locale);
    const filtered = allowlist
      ? localizedArticles.filter((article) => allowlist.includes(article.slug))
      : localizedArticles;
    return NextResponse.json(filtered);
  } catch {
    return NextResponse.json([], { status: 500 });
  }
}
