import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    // 优先从 nextUrl 获取 hostname，这通常是最准确的
    let hostname = request.nextUrl.hostname;

    // 如果是 Vercel 部署，有时候 host header 是更原始的请求头
    const hostHeader = request.headers.get('host');
    if (hostHeader) {
        hostname = hostHeader.split(':')[0]; // 去除端口号
    }

    const url = request.nextUrl;

    // 调试日志：在 Vercel Functions Logs 中可见
    // console.log(`[Middleware] Host: ${hostname}, Path: ${url.pathname}`);

    // 针对不同的域名实施不同的路由策略
    const isAppDomain = hostname === 'app.ziso.cc' || hostname.startsWith('app.');
    const isMainDomain = hostname === 'ziso.cc';

    // 1. App 子域名策略 (app.ziso.cc)
    if (isAppDomain) {
        // 当访问根路径 '/' 时，重写到 '/dashboard'（地址栏保持根路径不变）
        if (url.pathname === '/') {
            return NextResponse.rewrite(new URL('/dashboard', request.url));
        }

        // 核心：URL 洗白逻辑
        // 如果用户尝试访问 /dashboard 或其子路径，强制重定向到根路径
        // 这是为了保持 app.ziso.cc 地址栏永远干净
        if (url.pathname === '/dashboard') {
            // 构造不带 /dashboard 的 URL，但保留查询参数（如 ?invite=...）
            const cleanUrl = request.nextUrl.clone();
            cleanUrl.pathname = '/';
            return NextResponse.redirect(cleanUrl);
        }
    }

    // 2. 官网主域名策略 (ziso.cc)
    if (isMainDomain) {
        // 如果在官网上访问应用路径，将其引导到正确的子域名
        if (url.pathname.startsWith('/dashboard')) {
            const appUrl = new URL(`https://app.ziso.cc`, request.url);
            // 将子路径透传（如果有的话）
            appUrl.pathname = url.pathname.replace('/dashboard', '');
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
