import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
    getPublicLocaleFromPathname,
    getLocaleHrefLang,
    hasPublicLocalePrefix,
    isExcludedAppPath,
    stripPublicLocalePrefix,
    PUBLIC_ROUTE_ALLOWLIST,
} from '@/lib/public-i18n';

function normalizeHosts(raw: string | null | undefined): string[] {
    if (!raw) return [];
    return raw
        .split(',')
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean)
        .map((item) => item.split(':')[0] || '')
        .filter(Boolean);
}

function collectHostCandidates(request: NextRequest): string[] {
    const candidates = [
        ...normalizeHosts(request.headers.get('x-forwarded-host')),
        ...normalizeHosts(request.headers.get('host')),
        ...normalizeHosts(request.nextUrl.hostname),
    ];

    return Array.from(new Set(candidates));
}

export function middleware(request: NextRequest) {
    // Host detection must be resilient to proxy header format changes.
    const hostCandidates = collectHostCandidates(request);

    const url = request.nextUrl;
    const pathname = url.pathname;
    const debugEnabled = url.searchParams.get('__mwdebug') === '1';

    const isAppDomain = hostCandidates.some(
        (host) => host === 'app.ziso.cc' || host.startsWith('app.')
    );
    /** 官网生产域名：/dashboard、/v/* 等需进 App 子域 */
    const isZisoMarketingHost = hostCandidates.some(
        (host) => host === 'ziso.cc' || host === 'www.ziso.cc',
    );
    /** 本地开发：与官网共用部分 i18n 行为，但不得 307 到 app.ziso.cc */
    const isLocalDevHost = hostCandidates.some(
        (host) => host === '127.0.0.1' || host === 'localhost',
    );
    const isMainDomain = isZisoMarketingHost || isLocalDevHost;

    const locale = getPublicLocaleFromPathname(pathname);
    const isLocalePrefixed = hasPublicLocalePrefix(pathname);
    const strippedPathname = stripPublicLocalePrefix(pathname);
    const isExcludedAfterLocaleStrip = isExcludedAppPath(strippedPathname);
    const inheritedBranch = request.headers.get('x-ziso-mw-rewrite-branch');

    const withDebugHeaders = (res: NextResponse, branch: string): NextResponse => {
        res.headers.set('x-ziso-mw-branch', inheritedBranch || branch);
        if (!debugEnabled) return res;

        res.headers.set('x-ziso-mw-path', pathname);
        res.headers.set('x-ziso-mw-host-candidates', hostCandidates.join('|') || 'none');
        res.headers.set('x-ziso-mw-x-forwarded-host', request.headers.get('x-forwarded-host') || 'none');
        res.headers.set('x-ziso-mw-host', request.headers.get('host') || 'none');
        res.headers.set('x-ziso-mw-next-hostname', request.nextUrl.hostname || 'none');
        res.headers.set('x-ziso-mw-is-app-domain', String(isAppDomain));
        res.headers.set('x-ziso-mw-is-main-domain', String(isMainDomain));
        res.headers.set('x-ziso-mw-is-ziso-marketing-host', String(isZisoMarketingHost));
        res.headers.set('x-ziso-mw-is-local-dev-host', String(isLocalDevHost));
        res.headers.set('cache-control', 'no-store');
        return res;
    };

    const setLocaleCookie = (res: NextResponse, val: string) => {
        const domain = hostCandidates.some(h => h.endsWith('.ziso.cc') || h === 'ziso.cc') 
            ? '.ziso.cc' 
            : undefined;
            
        res.cookies.set('ziso_locale', val, {
            path: '/',
            domain,
            maxAge: 60 * 60 * 24 * 365, // 1 year
            sameSite: 'lax',
        });
        return res;
    };

    const withLocaleRequestHeader = (branch: string): NextResponse => {
        const headers = new Headers(request.headers);
        headers.set('x-ziso-locale', locale);
        headers.set('x-ziso-locale-prefix', isLocalePrefixed ? '1' : '0');
        const response = NextResponse.next({
            request: {
                headers,
            },
        });
        response.headers.set('content-language', getLocaleHrefLang(locale));
        
        // High-Risk Audit Fix: Only sync the cookie if we have an EXPLICIT locale prefix
        // This prevents ziso.cc/ (no prefix, defaults to en) from overwriting 
        // a user's manual choice (e.g. cn) made in the App.
        if (isLocalePrefixed) {
            setLocaleCookie(response, locale);
        }
        
        return withDebugHeaders(response, branch);
    };

    // 1. App 子域名策略 (app.ziso.cc) - Highest Priority
    // Must handle App subdomain rules (e.g. prefix stripping) before any global SEO redirects
    if (isAppDomain) {
        if (isLocalePrefixed) {
            const cleanUrl = url.clone();
            cleanUrl.pathname = strippedPathname === '/dashboard' ? '/' : strippedPathname;
            const res = NextResponse.redirect(cleanUrl, 307);
            setLocaleCookie(res, locale);
            return withDebugHeaders(res, 'app-strip-locale-prefix');
        }

        if (pathname === '/') {
            const headers = new Headers(request.headers);
            headers.set('x-ziso-locale', locale);
            headers.set('x-ziso-locale-prefix', isLocalePrefixed ? '1' : '0');
            headers.set('x-ziso-mw-rewrite-branch', 'app-root-rewrite-dashboard');
            return withDebugHeaders(
                NextResponse.rewrite(new URL('/dashboard', request.url), {
                    request: {
                        headers,
                    },
                }),
                'app-root-rewrite-dashboard'
            );
        }

        if (pathname === '/dashboard') {
            const cleanUrl = url.clone();
            cleanUrl.pathname = '/';
            return withDebugHeaders(
                NextResponse.redirect(cleanUrl, 307),
                'app-dashboard-redirect-root'
            );
        }
    }

    // 0. SEO 重定向：由于 'en' 变为默认语言（无前缀），强制将旧 of '/en' 前缀重定向到根 
    // 限制在主域名场景以满足审计要求，同时保证 app 域名不受 301 影响
    if (isLocalePrefixed && locale === 'en' && !isAppDomain) {
        const isSafePublicPage = (PUBLIC_ROUTE_ALLOWLIST as readonly string[]).includes(strippedPathname);
        
        if (isSafePublicPage) {
            const cleanUrl = url.clone();
            cleanUrl.pathname = strippedPathname;
            const res = NextResponse.redirect(cleanUrl, 301);
            setLocaleCookie(res, 'en');
            return withDebugHeaders(res, 'main-redirect-en-to-root');
        }
    }

    // 2. 官网主域名策略 (ziso.cc)
    if (isMainDomain) {
        if (isLocalePrefixed && isExcludedAfterLocaleStrip) {
            const cleanUrl = url.clone();
            cleanUrl.pathname = strippedPathname;
            const res = NextResponse.redirect(cleanUrl, 307);
            setLocaleCookie(res, locale);
            return withDebugHeaders(res, 'main-strip-locale-excluded-path');
        }

        // 仅官网生产域名外链到 App；localhost 开发留在本机，避免误跳 app.ziso.cc
        if (isZisoMarketingHost) {
            // [优化] 处理 /v/[code] 极速跳转
            // 直接 307 重定向到 App 域名并带上参数，DashboardLayout 会接手别名解析
            if (pathname.startsWith('/v/')) {
                const code = pathname.split('/v/')[1];
                if (code) {
                    const appUrl = new URL(`https://app.ziso.cc`, request.url);
                    appUrl.searchParams.set('invite', code);
                    appUrl.searchParams.set('locale', 'en');
                    const res = NextResponse.redirect(appUrl, 307);
                    setLocaleCookie(res, 'en');
                    return withDebugHeaders(res, 'main-v-code-redirect-app');
                }
            }

            if (pathname.startsWith('/dashboard')) {
                const appUrl = new URL(`https://app.ziso.cc`, request.url);
                appUrl.pathname = pathname.replace('/dashboard', '');
                if (appUrl.pathname === '') appUrl.pathname = '/';
                appUrl.search = url.search;
                return withDebugHeaders(
                    NextResponse.redirect(appUrl, 307),
                    'main-dashboard-redirect-app'
                );
            }
        }

        return withLocaleRequestHeader(isLocalePrefixed ? 'main-public-locale' : 'main-public-default-locale');
    }

    return withLocaleRequestHeader('pass-through-locale');
}

export const config = {
    matcher: [
        '/((?!api|_next/static|_next/image|favicon.ico|manifest.json|sw.js|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|xml|json|woff|woff2|ttf)$).*)',
    ],
};
