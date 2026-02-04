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

    // 检测是否是 App 域名 (app.ziso.cc 或 app.localhost)
    const isAppDomain = hostname === 'app.ziso.cc' || hostname.startsWith('app.');

    // 1. 如果是通过 App 域名访问
    if (isAppDomain) {
        // 当访问根路径 '/' 时，重写到 '/dashboard'
        if (url.pathname === '/') {
            return NextResponse.rewrite(new URL('/dashboard', request.url));
        }
    }

    // 2. (可选) 反向保护：如果是官网域名 (ziso.cc) 访问 '/dashboard'，可以重定向回 App
    // 这样用户如果在官网手输 /dashboard，也会被“赶”到 app.ziso.cc 去
    /*
    if (hostname === 'ziso.cc' && url.pathname.startsWith('/dashboard')) {
         return NextResponse.redirect(new URL(`https://app.ziso.cc${url.pathname}`, request.url));
    }
    */

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
