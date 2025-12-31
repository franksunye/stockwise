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
        const { target_user_id, related_symbol, title, body: msgBody, url } = body;

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

        // 3. 发送推送 (并行)
        const payload = JSON.stringify({
            title,
            body: msgBody,
            url: url || '/dashboard'
        });

        const promises = subscriptions.map(async (sub) => {
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
                    // 删除逻辑移入外层统一处理
                    // 注意：better-sqlite3 如果 close 了，下面再用会报错。
                    // 优化策略: 在最后 try/finally 中 close，或者重新获取。
                    // 为简单起见，这里暂不重新实现 DB 操作，留待完善
                    // 可以在外层循环后统一处理删除
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
