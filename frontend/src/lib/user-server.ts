import { getDbClient } from './db';

/**
 * 获取用户的订阅等级
 * 
 * @param userId 用户唯一标识
 * @returns 'free' | 'pro'
 */
export async function getUserTier(userId: string | null): Promise<'free' | 'pro'> {
    if (!userId) return 'free';

    const client = getDbClient();
    try {
        if ('execute' in client) {
            const rs = await client.execute({
                sql: "SELECT subscription_tier FROM users WHERE user_id = ? LIMIT 1",
                args: [userId]
            });
            if (rs.rows.length > 0) {
                return (rs.rows[0].subscription_tier as 'free' | 'pro') || 'free';
            }
        } else {
            const row = client.prepare("SELECT subscription_tier FROM users WHERE user_id = ? LIMIT 1").get(userId) as { subscription_tier: string } | undefined;
            if (row) return (row.subscription_tier as 'free' | 'pro') || 'free';
        }
    } catch (e) {
        console.error('Failed to fetch user tier:', e);
    } finally {
        if (client && typeof (client as { close?: () => void }).close === 'function') {
            (client as { close: () => void }).close();
        }
    }

    return 'free';
}
