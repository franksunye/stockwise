import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

function normalizeHost(raw: string | null | undefined): string | null {
    if (!raw) return null;
    const first = raw.split(',')[0]?.trim().toLowerCase();
    if (!first) return null;
    return first.split(':')[0] || null;
}

function collectHostCandidates(request: NextRequest): string[] {
    const candidates = [
        normalizeHost(request.headers.get('x-forwarded-host')),
        normalizeHost(request.headers.get('host')),
        normalizeHost(request.nextUrl.hostname),
    ].filter((v): v is string => Boolean(v));

    return Array.from(new Set(candidates));
}

export function middleware(request: NextRequest) {
    // Host detection must be resilient to proxy header format changes.
    const hostCandidates = collectHostCandidates(request);

    const url = request.nextUrl;
    const pathname = url.pathname;

    const isAppDomain = hostCandidates.some(
        (host) => host === 'app.ziso.cc' || host.startsWith('app.')
    );
    const isMainDomain = hostCandidates.some(
        (host) => host === 'ziso.cc' || host === 'www.ziso.cc'
    );

    // 1. App 子域名策略 (app.ziso.cc)
    if (isAppDomain) {
        if (pathname === '/') {
            return NextResponse.rewrite(new URL('/dashboard', request.url));
        }

        if (pathname === '/dashboard') {
            const cleanUrl = url.clone();
            cleanUrl.pathname = '/';
            return NextResponse.redirect(cleanUrl, 307);
        }
    }

    // 2. 官网主域名策略 (ziso.cc)
    if (isMainDomain) {
        // [优化] 处理 /v/[code] 极速跳转
        // 直接 307 重定向到 App 域名并带上参数，DashboardLayout 会接手别名解析
        if (pathname.startsWith('/v/')) {
            const code = pathname.split('/v/')[1];
            if (code) {
                const appUrl = new URL(`https://app.ziso.cc`, request.url);
                appUrl.searchParams.set('invite', code);
                return NextResponse.redirect(appUrl, 307);
            }
        }

        if (pathname.startsWith('/dashboard')) {
            const appUrl = new URL(`https://app.ziso.cc`, request.url);
            appUrl.pathname = pathname.replace('/dashboard', '');
            if (appUrl.pathname === '') appUrl.pathname = '/';
            appUrl.search = url.search;
            return NextResponse.redirect(appUrl, 307);
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        '/((?!api|_next/static|_next/image|favicon.ico|manifest.json|sw.js|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|xml|json|woff|woff2|ttf)$).*)',
    ],
};
