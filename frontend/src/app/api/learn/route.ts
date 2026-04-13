import { NextResponse } from 'next/server';
import { getAllArticles } from '@/lib/learn-content';
import { DEFAULT_PUBLIC_LOCALE, isSupportedPublicLocale } from '@/lib/public-i18n';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const localeParam = searchParams.get('locale');
        const locale = isSupportedPublicLocale(localeParam) ? localeParam : DEFAULT_PUBLIC_LOCALE;
        const fallbackToDefault = locale !== DEFAULT_PUBLIC_LOCALE;
        const articles = await getAllArticles({ locale, fallbackToDefault });
        // Only return 101-* articles, exclude internal docs
        const filtered = articles.filter(a => a.slug.startsWith('101-'));
        return NextResponse.json(filtered);
    } catch {
        return NextResponse.json([], { status: 500 });
    }
}
