import { NextResponse } from 'next/server';

type ManifestLocale = 'cn' | 'en';

type ManifestScreenshot = {
  src: string;
  sizes: string;
  type: string;
  form_factor: 'wide' | 'narrow';
  label: string;
};

type ManifestShortcut = {
  name: string;
  short_name: string;
  url: string;
  icons: Array<{
    src: string;
    sizes: string;
  }>;
};

const BASE_MANIFEST = {
  id: '/',
  name: 'ZISO AI',
  short_name: 'ZISO AI',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  orientation: 'portrait',
  background_color: '#050508',
  theme_color: '#6366f1',
  categories: ['finance', 'business', 'productivity'],
  icons: [
    {
      src: '/icon-192.png',
      sizes: '192x192',
      type: 'image/png',
      purpose: 'any',
    },
    {
      src: '/icon-192.png',
      sizes: '192x192',
      type: 'image/png',
      purpose: 'maskable',
    },
    {
      src: '/icon-512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'any',
    },
    {
      src: '/icon-512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'maskable',
    },
    {
      src: '/logo.png',
      sizes: '1024x1024',
      type: 'image/png',
      purpose: 'any',
    },
    {
      src: '/logo.png',
      sizes: '1024x1024',
      type: 'image/png',
      purpose: 'maskable',
    },
  ],
} as const;

const CN_SCREENSHOTS: ManifestScreenshot[] = [
  {
    src: '/images/landing/prediction-card-detail.png',
    sizes: '1125x1125',
    type: 'image/png',
    form_factor: 'wide',
    label: 'ZISO AI 策略深度分析',
  },
  {
    src: '/images/landing/main-dashboard.png',
    sizes: '1125x2436',
    type: 'image/png',
    form_factor: 'narrow',
    label: 'ZISO AI 智能仪表盘',
  },
];

const CN_SHORTCUTS: ManifestShortcut[] = [
  {
    name: '查看仪表盘',
    short_name: '仪表盘',
    url: '/',
    icons: [
      {
        src: '/logo.png',
        sizes: '1024x1024',
      },
    ],
  },
];

const EN_SHORTCUTS: ManifestShortcut[] = [
  {
    name: 'Open Dashboard',
    short_name: 'Dashboard',
    url: '/',
    icons: [
      {
        src: '/logo.png',
        sizes: '1024x1024',
      },
    ],
  },
];

function inferLocaleFromToken(value: string | null | undefined): ManifestLocale | null {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === 'cn' || normalized === 'zh' || normalized.startsWith('zh-')) return 'cn';
  if (normalized === 'en' || normalized.startsWith('en-')) return 'en';
  if (normalized === 'es' || normalized.startsWith('es-')) return 'en';
  if (normalized === 'ko' || normalized.startsWith('ko-')) return 'en';
  return null;
}

function getCookieValue(cookieHeader: string | null, key: string): string | null {
  if (!cookieHeader) return null;

  for (const part of cookieHeader.split(';')) {
    const [rawName, ...rest] = part.split('=');
    if (rawName?.trim() === key) {
      return decodeURIComponent(rest.join('=').trim());
    }
  }

  return null;
}

function normalizeHosts(raw: string | null): string[] {
  if (!raw) return [];

  return raw
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .map((item) => item.split(':')[0] || '')
    .filter(Boolean);
}

function getLocaleFromReferer(referer: string | null): ManifestLocale | null {
  if (!referer) return null;

  try {
    const pathname = new URL(referer).pathname.toLowerCase();
    if (pathname === '/cn' || pathname.startsWith('/cn/')) return 'cn';
    if (pathname === '/en' || pathname.startsWith('/en/')) return 'en';
  } catch {
    return null;
  }

  return null;
}

function resolveManifestLocale(request: Request): ManifestLocale {
  const cookieLocale = inferLocaleFromToken(
    getCookieValue(request.headers.get('cookie'), 'ziso_locale')
  );
  if (cookieLocale) return cookieLocale;

  const refererLocale = getLocaleFromReferer(request.headers.get('referer'));
  if (refererLocale) return refererLocale;

  const hosts = [
    ...normalizeHosts(request.headers.get('x-forwarded-host')),
    ...normalizeHosts(request.headers.get('host')),
    ...normalizeHosts(new URL(request.url).hostname),
  ];
  const isAppDomain = hosts.some((host) => host === 'app.ziso.cc' || host.startsWith('app.'));

  if (isAppDomain) return 'en';
  return 'en';
}

function buildManifest(locale: ManifestLocale) {
  if (locale === 'cn') {
    return {
      ...BASE_MANIFEST,
      description: '极致简单的 AI 炒股决策工具，实时监控、深度复盘、智能决策。',
      lang: 'zh-CN',
      screenshots: CN_SCREENSHOTS,
      shortcuts: CN_SHORTCUTS,
    };
  }

  return {
    ...BASE_MANIFEST,
    description: 'An ultra-simple AI investing workspace for real-time monitoring, deep review, and disciplined decisions.',
    lang: 'en',
    shortcuts: EN_SHORTCUTS,
  };
}

export function GET(request: Request) {
  const locale = resolveManifestLocale(request);
  const manifest = buildManifest(locale);

  return new NextResponse(JSON.stringify(manifest, null, 2), {
    headers: {
      'Content-Type': 'application/manifest+json; charset=utf-8',
      'Cache-Control': 'public, max-age=0, must-revalidate',
    },
  });
}
