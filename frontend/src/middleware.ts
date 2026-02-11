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

    // 针对不同的域名实施不同的路由策略
    const isAppDomain = hostname === 'app.ziso.cc' || hostname.startsWith('app.');
    const isMainDomain = hostname === 'ziso.cc' || hostname === 'www.ziso.cc';

    // 1. App 子域名策略 (app.ziso.cc)
    if (isAppDomain) {
        // 防止循环的关键：检测是否已经是针对 /dashboard 的内部处理
        // 在 Next.js 中，如果直接访问 / 且我们 rewrite 到 /dashboard，
        // 我们不需要再针对这个结果进行 redirect。

        if (pathname === '/') {
            // 直接由服务器执行内部重写，地址栏保持为 /
            return NextResponse.rewrite(new URL('/dashboard', request.url));
        }

        // 仅当用户从外部显式访问 /dashboard 路径时，才净化 URL 跳转到 /
        // 我们通过检查是否设置了重写标记来避让（或者简单判断 pathname 即可）
        if (pathname === '/dashboard') {
            const cleanUrl = url.clone();
            cleanUrl.pathname = '/';
            // 使用 307 临时重定向，避免 Safari 激进缓存 308 导致的死循环
            return NextResponse.redirect(cleanUrl, 307);
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
