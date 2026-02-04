import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    const hostname = request.headers.get('host') || '';
    const url = request.nextUrl;

    // 检测是否是 App 域名 (app.ziso.cc 或本地测试时的 app.localhost)
    // 这样既支持线上环境，也方便您本地测试 (需要在 hosts 文件配置)
    const isAppDomain = hostname.startsWith('app.');

    // 如果是通过 App 域名访问
    if (isAppDomain) {
        // 1. 访问根路径 '/' 时，在后台“偷梁换柱”加载 '/dashboard' 的内容
        // 浏览器地址栏依然显示: app.ziso.cc
        if (url.pathname === '/') {
            return NextResponse.rewrite(new URL('/dashboard', request.url));
        }

        // 2. (可选优化) 如果用户顽固地输入 '/dashboard'，可以重定向到 '/'
        // 让地址栏始终保持干净的 'app.ziso.cc'
        // if (url.pathname === '/dashboard') {
        //   return NextResponse.redirect(new URL('/', request.url));
        // }
    }

    // 其他情况（如 ziso.cc）保持原样
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
