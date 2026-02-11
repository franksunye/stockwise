import { NextResponse } from 'next/server';
import { getAllArticles } from '@/lib/learn-content';

export async function GET() {
    try {
        const articles = await getAllArticles();
        // Only return 101-* articles, exclude internal docs
        const filtered = articles.filter(a => a.slug.startsWith('101-'));
        return NextResponse.json(filtered);
    } catch {
        return NextResponse.json([], { status: 500 });
    }
}
