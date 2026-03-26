'use client';

import { getHKTime, getLastTradingDay } from '@/lib/date-utils';
import { getCurrentUser } from '@/lib/user';
import { getBriefDateCandidates } from '@/lib/brief-dates';

export interface BriefData {
    date: string;
    content: string;
    push_hook: string;
    created_at: string;
}

export async function fetchLatestBrief(): Promise<BriefData | null> {
    await getCurrentUser();

    for (const date of getBriefDateCandidates(getHKTime(), getLastTradingDay())) {
        const response = await fetch(`/api/brief?date=${date}`);
        const data = (await response.json()) as { brief?: BriefData | null };

        if (data?.brief) {
            return data.brief;
        }
    }

    return null;
}
