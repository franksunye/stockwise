'use client';

import { useEffect, useState } from 'react';
import { fetchLatestBrief, type BriefData } from '@/lib/brief-client';

export function useBriefSurface(enabled: boolean = true) {
    const [brief, setBrief] = useState<BriefData | null>(null);
    const [loading, setLoading] = useState(enabled);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!enabled) {
            setLoading(false);
            return;
        }

        let cancelled = false;

        const loadBrief = async () => {
            setLoading(true);
            setError(null);

            try {
                const nextBrief = await fetchLatestBrief();
                if (!cancelled) {
                    setBrief(nextBrief);
                }
            } catch (err) {
                if (!cancelled) {
                    console.error('Failed to fetch brief:', err);
                    setError('无法加载简报');
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        loadBrief();

        return () => {
            cancelled = true;
        };
    }, [enabled]);

    return {
        brief,
        loading,
        error,
    };
}
