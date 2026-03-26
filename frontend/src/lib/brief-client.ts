'use client';

import { getHKTime, getLastTradingDay } from '@/lib/date-utils';
import { getCurrentUser } from '@/lib/user';

export interface BriefData {
    date: string;
    content: string;
    push_hook: string;
    created_at: string;
}

function getBriefDateCandidates(): string[] {
    const today = getHKTime().toISOString().split('T')[0];
    const lastTradingDay = getLastTradingDay().toISOString().split('T')[0];

    return today === lastTradingDay ? [today] : [today, lastTradingDay];
}

export async function fetchLatestBrief(): Promise<BriefData | null> {
    await getCurrentUser();

    for (const date of getBriefDateCandidates()) {
        const response = await fetch(`/api/brief?date=${date}`);
        const data = (await response.json()) as { brief?: BriefData | null };

        if (data?.brief) {
            return data.brief;
        }
    }

    return null;
}
