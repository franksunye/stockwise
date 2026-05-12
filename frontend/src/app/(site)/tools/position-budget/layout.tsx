import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { brandCoreZhCN } from '@/content/brand-core.zh-CN';
import {
    POSITION_BUDGET_CANONICAL_PATH,
    positionBudgetJsonLdScriptInnerHtml,
    positionBudgetSeoCopy,
} from '@/content/seo-position-budget';
import { DEFAULT_APP_LOCALE } from '@/lib/i18n';
import { buildPageMetadata } from '@/lib/seo';

import { PositionBudgetToolLayoutClient } from './layout-client';

export const metadata: Metadata = buildPageMetadata(brandCoreZhCN.domain, {
    title: positionBudgetSeoCopy.title,
    description: positionBudgetSeoCopy.description,
    path: POSITION_BUDGET_CANONICAL_PATH,
    locale: 'en',
    alternateLocales: ['en'],
    keywords: [...positionBudgetSeoCopy.keywords],
});

export default function PositionBudgetToolLayout({ children }: { children: ReactNode }) {
    const jsonLd = positionBudgetJsonLdScriptInnerHtml();
    return (
        <div className="min-h-screen bg-[#050508]">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: jsonLd }}
            />
            <PositionBudgetToolLayoutClient serverInitialLocale={DEFAULT_APP_LOCALE}>
                {children}
            </PositionBudgetToolLayoutClient>
        </div>
    );
}
