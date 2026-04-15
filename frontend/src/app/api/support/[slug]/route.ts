import { NextRequest, NextResponse } from "next/server";
import { getSupportArticleBySlug } from "@/lib/support-content";
import { DEFAULT_PUBLIC_LOCALE, isSupportedPublicLocale } from "@/lib/public-i18n";
import { isSupportSlugAllowedForLocale } from "@/lib/support-v1";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const localeParam = request.nextUrl.searchParams.get("locale");
    const locale = isSupportedPublicLocale(localeParam) ? localeParam : DEFAULT_PUBLIC_LOCALE;
    if (!isSupportSlugAllowedForLocale(locale, slug)) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }
    const article = getSupportArticleBySlug(slug, { locale, fallbackToDefault: false });

    if (!article) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    return NextResponse.json(article);
  } catch (error) {
    console.error("Failed to load support article:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
