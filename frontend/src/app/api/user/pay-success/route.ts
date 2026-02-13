import { NextResponse } from 'next/server';
import { getDbClient } from '@/lib/db';
import { MEMBERSHIP_CONFIG } from '@/lib/membership-config';
import { sendInternalNotification } from '@/lib/server-notify';

/**
 * POST /api/user/pay-success
 * 模拟支付成功后的回调处理 (Stripe Webhook 或 成功跳转)
 * 核心：自动计算件佣金并记账
 */
export async function POST(request: Request) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let db: any;
    try {
        const { userId, amount, planId } = await request.json();

        if (!userId || !amount) {
            return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
        }

        db = getDbClient();
        const isCloud = 'execute' in db && typeof db.execute === 'function' && !('prepare' in db);
        const now = new Date().toISOString();

        // 1. 获取用户信息及推荐人信息
        let user;
        if (isCloud) {
            const res = await db.execute({
                sql: "SELECT referred_by FROM users WHERE user_id = ?",
                args: [userId]
            });
            user = res.rows[0];
        } else {
            user = db.prepare("SELECT referred_by FROM users WHERE user_id = ?").get(userId);
        }

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // 2. 更新付款用户的会员状态
        const durationDays = planId === 'yearly' ? 366 : 31;
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + durationDays);
        const expiresAt = expiryDate.toISOString();

        const updateOps = [
            {
                sql: "UPDATE users SET subscription_tier = 'pro', subscription_expires_at = ? WHERE user_id = ?",
                args: [expiresAt, userId]
            }
        ];

        // 3. 处理分润逻辑 (Commission Calculation)
        let commissionAmount = 0;
        if (user.referred_by) {
            const referrerId = user.referred_by;

            // 获取推荐人的自定义比例
            let referrer;
            if (isCloud) {
                const res = await db.execute({
                    sql: "SELECT custom_commission_rate FROM users WHERE user_id = ?",
                    args: [referrerId]
                });
                referrer = res.rows[0];
            } else {
                referrer = db.prepare("SELECT custom_commission_rate FROM users WHERE user_id = ?").get(referrerId);
            }

            if (referrer) {
                // 计算比例：优先使用自定义比例，否则使用全局默认 10%
                // 计算比例：优先使用自定义比例，否则默认为 0
                const commissionRate = referrer.custom_commission_rate ?? 0;
                commissionAmount = amount * commissionRate;

                if (commissionAmount > 0) {
                    const txId = `tx_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

                    // 准备记账操作
                    updateOps.push(
                        // A. 插入交易流水
                        {
                            sql: `INSERT INTO referral_transactions (id, referrer_id, referred_id, type, amount, status, created_at, note) 
                                  VALUES (?, ?, ?, 'commission', ?, 'converted', ?, ?)`,
                            args: [txId, referrerId, userId, commissionAmount, now, `Earned from ${planId} plan`]
                        },
                        // B. 更新推荐人的钱包余额
                        {
                            sql: "UPDATE users SET referral_balance = referral_balance + ?, total_earned = total_earned + ? WHERE user_id = ?",
                            args: [commissionAmount, commissionAmount, referrerId]
                        }
                    );

                    console.log(`💰 Commission allocated: ${commissionAmount} to referrer ${referrerId}`);
                }
            }
        }

        // 4. 原子化批量执行 (Batch Execution)
        if (isCloud) {
            await db.batch(updateOps);
        } else {
            const transaction = db.transaction(() => {
                for (const op of updateOps) {
                    db.prepare(op.sql).run(...op.args);
                }
            });
            transaction();
            // Don't close here if we need it later, but we've used it for all SQLs
            db.close();
        }

        // 5. 发送通知 (异步)
        if (user.referred_by && commissionAmount > 0) {
            const referrerId = user.referred_by;
            sendInternalNotification({
                target_user_id: referrerId,
                title: '💰 分润已入账',
                body: `你的推荐用户已付费，伙伴礼金 ¥${commissionAmount.toFixed(2)} 已入账！`,
                url: '/dashboard',
                tag: 'commission_reward'
            }).catch((e: unknown) => console.error('Failed to send commission notification:', e));
        }

        return NextResponse.json({
            success: true,
            expiresAt,
            tier: 'pro'
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
        console.error('Payment processing error:', error);
        return NextResponse.json({ error: error.message || 'Internal Error' }, { status: 500 });
    }
}
