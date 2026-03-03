import { NextResponse } from 'next/server';
import { getArticleBySlug } from '@/lib/learn-content';

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ slug: string }> }
) {
    const { slug } = await params;
    try {
        const article = await getArticleBySlug(slug);
        if (!article) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }
        return NextResponse.json(article);
    } catch {
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
