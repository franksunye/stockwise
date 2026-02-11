import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    // 根本原因优化：更稳健的域名检测
    // 在 Vercel/Cloudflare 等层级中，x-forwarding-host 是最可信的
    const forwardedHost = request.headers.get('x-forwarded-host');
    let hostname = forwardedHost ? forwardedHost.split(':')[0] : request.nextUrl.hostname;

    // 备选方案：host header
    const hostHeader = request.headers.get('host');
    if (!forwardedHost && hostHeader) {
        hostname = hostHeader.split(':')[0];
    }

    const url = request.nextUrl;
    const pathname = url.pathname;

    // 防止循环重定向的关键：检查是否已经是重写后的请求
    // Next.js 在 rewrite 后有时会重新触发 middleware
    const isRewritten = request.headers.has('x-ziso-rewrite');

    // 针对不同的域名实施不同的路由策略
    const isAppDomain = hostname === 'app.ziso.cc' || hostname.startsWith('app.');
    const isMainDomain = hostname === 'ziso.cc' || hostname === 'www.ziso.cc';

    // 1. App 子域名策略 (app.ziso.cc)
    if (isAppDomain) {
        // 当访问根路径 '/' 时，重写到 '/dashboard'
        if (pathname === '/') {
            const response = NextResponse.rewrite(new URL('/dashboard', request.url));
            // 标记这是一个重写，防止下方逻辑误判为直接访问 /dashboard 导致循环
            response.headers.set('x-ziso-rewrite', 'true');
            return response;
        }

        // 核心：URL 洗白逻辑
        // 只有当用户直接在地址栏输入 /dashboard 且不是内部重写时，才重定向到根路径
        if (pathname === '/dashboard' && !isRewritten) {
            const cleanUrl = url.clone();
            cleanUrl.pathname = '/';
            return NextResponse.redirect(cleanUrl);
        }
    }

    // 2. 官网主域名策略 (ziso.cc)
    if (isMainDomain) {
        if (pathname.startsWith('/dashboard')) {
            const appUrl = new URL(`https://app.ziso.cc`, request.url);
            appUrl.pathname = pathname.replace('/dashboard', '');
            if (appUrl.pathname === '') appUrl.pathname = '/';
            appUrl.search = url.search;
            return NextResponse.redirect(appUrl);
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        /*
         * 匹配所有路径，除了以下开头的路径：
         * - api (API 路由)
         * - _next/static (静态文件)
         * - _next/image (图片优化文件)
         * - favicon.ico (浏览器图标)
         * - public 目录下的常见静态资源后缀 (svg, png, jpg, jpeg, gif, webp)
         */
        '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};
