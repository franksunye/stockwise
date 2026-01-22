import { NextResponse } from 'next/server';
import { getDbClient } from '@/lib/db';
import { Client } from '@libsql/client';
import Database from 'better-sqlite3';
import webpush from 'web-push';


// Configure web-push
if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
        process.env.VAPID_SUBJECT || 'mailto:admin@stockwise.com',
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
    );
}

export async function POST(request: Request) {
    // 1. 验证内部调用的 Secret
    const authHeader = request.headers.get('Authorization');
    const secret = process.env.INTERNAL_API_SECRET;

    // 如果没有设置 secret，或者不匹配，则拒绝
    if (!secret || authHeader !== `Bearer ${secret}`) {
        // 开发环境如果没设置，可能由于配置问题，允许通过但打印警告? 
        // 还是严格点比较好，或者允许本地回环?
        // 为简单起见，严格验证
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { target_user_id, related_symbol, title, body: msgBody, url, tag } = body;

        if (!title || !msgBody) {
            return NextResponse.json({ error: 'Missing title or body' }, { status: 400 });
        }

        const client = getDbClient();
        const strategy = process.env.DB_STRATEGY || 'local';
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let subscriptions: any[] = [];

        // 2. 查找目标订阅者
        if (target_user_id) {
            // 直接查找指定用户
            const sql = 'SELECT * FROM push_subscriptions WHERE user_id = ?';
            if (strategy === 'cloud') {
                const res = await (client as Client).execute({ sql, args: [target_user_id] });
                subscriptions = res.rows;
            } else {
                const db = client as Database.Database;
                subscriptions = db.prepare(sql).all(target_user_id);
                db.close();
            }
        } else if (related_symbol) {
            // 查找关注该股票的用户
            // 先查 user_watchlist 拿到 user_id，再查 push_subscriptions
            // 联表查询
            const sql = `
                SELECT s.* 
                FROM push_subscriptions s
                JOIN user_watchlist w ON s.user_id = w.user_id
                WHERE w.symbol = ?
            `;
            if (strategy === 'cloud') {
                const res = await (client as Client).execute({ sql, args: [related_symbol] });
                subscriptions = res.rows;
            } else {
                const db = client as Database.Database;
                subscriptions = db.prepare(sql).all(related_symbol);
                db.close();
            }
        } else if (body.broadcast) {
            // 广播给所有订阅用户 (仅限系统通知，如日报完成)
            const sql = 'SELECT * FROM push_subscriptions';
            if (strategy === 'cloud') {
                const res = await (client as Client).execute(sql);
                subscriptions = res.rows;
            } else {
                const db = client as Database.Database;
                subscriptions = db.prepare(sql).all();
                db.close();
            }
        } else {
            // 必须指定目标
            return NextResponse.json({ error: 'Must specify target_user_id, related_symbol, or broadcast: true' }, { status: 400 });
        }

        console.log(`Found ${subscriptions.length} subscriptions for push.`);

        // 3. 获取用户偏好设置 (用于过滤)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const userPreferences: Map<string, any> = new Map();

        // 从 tag 映射到 notification type key
        // tag 可能是 "price_update_600519" 格式，需要提取基础类型
        let notifTypeKey = tag || 'unknown';
        if (notifTypeKey.startsWith('price_update_')) {
            notifTypeKey = 'price_update';
        }

        // 只有在有订阅者时才查询偏好
        if (subscriptions.length > 0) {
            const userIds = [...new Set(subscriptions.map(s => s.user_id))];
            const placeholders = userIds.map(() => '?').join(',');
            const prefSql = `SELECT user_id, notification_settings FROM users WHERE user_id IN (${placeholders})`;

            if (strategy === 'cloud') {
                const res = await (client as Client).execute({ sql: prefSql, args: userIds });
                for (const row of res.rows) {
                    userPreferences.set(row.user_id as string, row.notification_settings);
                }
            } else {
                const db = getDbClient() as Database.Database;
                const rows = db.prepare(prefSql).all(...userIds);
                for (const row of rows as { user_id: string; notification_settings: string }[]) {
                    userPreferences.set(row.user_id, row.notification_settings);
                }
                db.close();
            }
        }

        // 4. 发送推送 (并行) - 检查用户偏好
        const payload = JSON.stringify({
            title,
            body: msgBody,
            url: url || '/dashboard',
            tag: tag
        });

        const promises = subscriptions.map(async (sub) => {
            // 检查用户是否禁用了此类型的通知
            const settingsJson = userPreferences.get(sub.user_id as string);
            if (settingsJson) {
                try {
                    const settings = typeof settingsJson === 'string' ? JSON.parse(settingsJson) : settingsJson;
                    // 全局开关
                    if (settings.enabled === false) {
                        console.log(`[Notify] User ${sub.user_id} has notifications disabled globally, skipping`);
                        return { status: 'skipped', id: sub.id, reason: 'user_disabled_all' };
                    }
                    // 类型开关
                    const typeSettings = settings.types?.[notifTypeKey];
                    if (typeSettings?.enabled === false) {
                        console.log(`[Notify] User ${sub.user_id} has '${notifTypeKey}' notifications disabled, skipping`);
                        return { status: 'skipped', id: sub.id, reason: 'user_disabled_type' };
                    }
                } catch (e) {
                    console.warn(`[Notify] Failed to parse settings for ${sub.user_id}:`, e);
                    // 解析失败时继续发送
                }
            }

            const pushConfig = {
                endpoint: sub.endpoint,
                keys: {
                    auth: sub.auth,
                    p256dh: sub.p256dh
                }
            };

            try {
                await webpush.sendNotification(pushConfig, payload);
                return { status: 'fulfilled', id: sub.id };
            } catch (error: unknown) {
                const pushError = error as { statusCode?: number };
                console.error(`Error sending push to ${sub.id}:`, error);

                // 如果是 410 (Gone)，说明订阅失效，删除之
                if (pushError.statusCode === 410 || pushError.statusCode === 404) {
                    console.log(`Subscription ${sub.id} expired/gone. Marking for deletion...`);
                    return { status: 'rejected', id: sub.id, reason: 'expired' };
                }
                return { status: 'rejected', id: sub.id, error };
            }
        });

        const results = await Promise.all(promises);
        const successCount = results.filter(r => r.status === 'fulfilled').length;
        const expiredIds = results
            .filter((r): r is { status: 'rejected'; id: string; reason: string } =>
                r.status === 'rejected' && 'reason' in r && r.reason === 'expired'
            )
            .map(r => r.id);

        // 4. 清理失效订阅 (异步)
        if (expiredIds.length > 0) {
            // Re-open DB or use a new client instance
            const cleanupClient = getDbClient();
            try {
                if (strategy === 'cloud') {
                    // Turso/LibSQL 不支持 batch delete conveniently via IN clause without parsing? 
                    // Simple loop
                    for (const id of expiredIds) {
                        await (cleanupClient as Client).execute({ sql: 'DELETE FROM push_subscriptions WHERE id = ?', args: [id] });
                    }
                } else {
                    const db = cleanupClient as Database.Database;
                    const deleteStmt = db.prepare('DELETE FROM push_subscriptions WHERE id = ?');
                    const transaction = db.transaction((ids) => {
                        for (const id of ids) deleteStmt.run(id);
                    });
                    transaction(expiredIds);
                    db.close();
                }
            } catch (e) {
                console.error('Failed to cleanup expired subscriptions:', e);
            }
        }

        return NextResponse.json({
            success: true,
            count: successCount,
            total: subscriptions.length
        });

    } catch (error) {
        console.error('Notification error:', error);
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}
