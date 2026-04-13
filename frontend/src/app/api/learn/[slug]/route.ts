import { NextResponse } from 'next/server';
import { getArticleBySlug } from '@/lib/learn-content';
import { DEFAULT_PUBLIC_LOCALE, isSupportedPublicLocale } from '@/lib/public-i18n';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ slug: string }> }
) {
    const { slug } = await params;
    try {
        const { searchParams } = new URL(request.url);
        const localeParam = searchParams.get('locale');
        const locale = isSupportedPublicLocale(localeParam) ? localeParam : DEFAULT_PUBLIC_LOCALE;
        const fallbackToDefault = locale !== DEFAULT_PUBLIC_LOCALE;
        const article = await getArticleBySlug(slug, { locale, fallbackToDefault });
        if (!article) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }
        return NextResponse.json(article);
    } catch {
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
