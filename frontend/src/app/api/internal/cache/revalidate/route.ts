import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    const authHeader = request.headers.get('Authorization');
    const secret = process.env.INTERNAL_API_SECRET;

    if (!secret || authHeader !== `Bearer ${secret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json().catch(() => ({}));
        const rawTags = Array.isArray(body?.tags) ? body.tags : [];
        const tags = rawTags
            .filter((tag): tag is string => typeof tag === 'string')
            .map((tag) => tag.trim())
            .filter(Boolean);

        if (tags.length === 0) {
            return NextResponse.json({ error: 'Missing tags' }, { status: 400 });
        }

        for (const tag of tags) {
            revalidateTag(tag);
        }

        const response = NextResponse.json({
            success: true,
            revalidated: tags,
            revalidatedAt: new Date().toISOString(),
        });
        response.headers.set('Cache-Control', 'no-cache, no-store, max-age=0, must-revalidate');
        return response;
    } catch (error) {
        console.error('[API/Internal/Cache/Revalidate] Error:', error);
        return NextResponse.json({ error: 'Failed to revalidate cache' }, { status: 500 });
    }
}
