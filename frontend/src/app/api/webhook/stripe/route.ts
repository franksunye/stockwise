/* eslint-disable @typescript-eslint/no-explicit-any */
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getDbClient } from '@/lib/db';
import { MEMBERSHIP_CONFIG } from '@/lib/membership-config';
import { sendInternalNotification } from '@/lib/server-notify';

export async function POST(req: Request) {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
        apiVersion: '2025-12-15.clover',
    });

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    const body = await req.text();
    const sig = (await headers()).get('stripe-signature') as string;

    let event: Stripe.Event;

    try {
        if (!sig || !webhookSecret) {
            throw new Error('Missing stripe-signature or webhook secret');
        }
        event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
    } catch (err: unknown) {
        console.error(`❌ Webhook signature verification failed: ${(err as Error).message}`);
        return NextResponse.json({ error: `Webhook Error: ${(err as Error).message}` }, { status: 400 });
    }

    // Handle the event
    try {
        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object as Stripe.Checkout.Session;
                const userId = session.client_reference_id || session.metadata?.userId;
                const customerEmail = session.customer_details?.email;
                const customerId = session.customer as string;
                const subscriptionId = session.subscription as string;

                if (!userId) {
                    console.error('❌ No userId found in session', session.id);
                    break;
                }

                console.log(`✅ Payment success for user ${userId} (${customerEmail})`);

                // Fetch subscription to get accurate period end and customer info
                let expiryDate = new Date();
                expiryDate.setDate(expiryDate.getDate() + 31); // Default to 31 days fallback (safer for monthly)
                let finalCustomerId = customerId;

                if (subscriptionId) {
                    try {
                        console.log(`🔍 Fetching subscription details for: ${subscriptionId}`);
                        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
                        const subData = subscription as any;
                        if (subData.current_period_end) {
                            expiryDate = new Date(subData.current_period_end * 1000);
                            console.log(`✅ Subscription period end discovered: ${expiryDate.toISOString()}`);
                        }

                        // Fallback for customer ID if not in session
                        if (!finalCustomerId && subData.customer) {
                            finalCustomerId = subData.customer as string;
                        }
                    } catch (err: unknown) {
                        console.error(`❌ Failed to retrieve subscription ${subscriptionId}:`, (err as Error).message);
                        // Falls back to current + 31 days
                    }
                } else {
                    console.warn('⚠️ No subscriptionId found in session. Using 31-day fallback.');
                }

                const expiryStr = expiryDate.toISOString();
                const emailToUpdate = customerEmail || null;

                console.log(`💾 DB Update Params -> User: ${userId}, Tier: pro, Expiry: ${expiryStr}, CustomerID: ${finalCustomerId}, Email: ${emailToUpdate}`);

                // Update user in database
                const db = getDbClient();
                const isCloud = 'execute' in db;

                try {
                    if (isCloud) {
                        await (db as unknown as { execute: (q: any) => Promise<any> }).execute({
                            sql: "UPDATE users SET subscription_tier = 'pro', subscription_expires_at = ?, stripe_customer_id = ?, email = ? WHERE user_id = ?",
                            args: [expiryStr, finalCustomerId, emailToUpdate, userId]
                        });
                    } else {
                        const stmt = (db as unknown as { prepare: (q: string) => any }).prepare("UPDATE users SET subscription_tier = 'pro', subscription_expires_at = ?, stripe_customer_id = ?, email = ? WHERE user_id = ?");
                        const result = stmt.run(expiryStr, finalCustomerId, emailToUpdate, userId);
                        console.log('✅ SQLite update successful. Changes:', result.changes);
                    }
                } catch (dbErr) {
                    console.error('❌ Database update failed:', dbErr);
                }

                // 💰 Commission Logic: If the paying user was referred, allocate commission
                try {
                    const cloudDb = db as unknown as { execute: (q: any) => Promise<any>, batch?: (stmts: any[]) => Promise<any> };
                    const localDb = db as unknown as { prepare: (q: string) => any };

                    // Get user's referrer
                    let payingUser;
                    if (isCloud) {
                        const userRes = await cloudDb.execute({
                            sql: "SELECT referred_by FROM users WHERE user_id = ?",
                            args: [userId]
                        });
                        payingUser = userRes.rows[0];
                    } else {
                        payingUser = localDb.prepare("SELECT referred_by FROM users WHERE user_id = ?").get(userId);
                    }

                    if (payingUser?.referred_by) {
                        const referrerId = payingUser.referred_by;

                        // Get referrer's commission rate
                        let referrer;
                        if (isCloud) {
                            const refRes = await cloudDb.execute({
                                sql: "SELECT custom_commission_rate FROM users WHERE user_id = ?",
                                args: [referrerId]
                            });
                            referrer = refRes.rows[0];
                        } else {
                            referrer = localDb.prepare("SELECT custom_commission_rate FROM users WHERE user_id = ?").get(referrerId);
                        }

                        if (referrer) {
                            const commissionRate = referrer.custom_commission_rate ?? 0;
                            // session.amount_total is in cents
                            const paymentAmount = (session.amount_total || 0) / 100;
                            const commissionAmount = paymentAmount * commissionRate;

                            if (commissionAmount > 0) {
                                const txId = `tx_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
                                const now = new Date().toISOString();

                                const commissionOps = [
                                    {
                                        sql: `INSERT INTO referral_transactions (id, referrer_id, referred_id, type, amount, status, created_at, note) 
                                              VALUES (?, ?, ?, 'commission', ?, 'converted', ?, ?)`,
                                        args: [txId, referrerId, userId, commissionAmount, now, `Stripe payment ${session.id}`]
                                    },
                                    {
                                        sql: "UPDATE users SET referral_balance = referral_balance + ?, total_earned = total_earned + ? WHERE user_id = ?",
                                        args: [commissionAmount, commissionAmount, referrerId]
                                    }
                                ];


                                if (isCloud && cloudDb.batch) {
                                    await cloudDb.batch(commissionOps);
                                } else {
                                    for (const op of commissionOps) {
                                        localDb.prepare(op.sql).run(...op.args);
                                    }
                                }
                                console.log(`💰 Commission allocated: ¥${commissionAmount.toFixed(2)} (${commissionRate * 100}%) to referrer ${referrerId}`);

                                // C. Send Notification
                                sendInternalNotification({
                                    target_user_id: referrerId,
                                    title: '💰 分润已入账',
                                    body: `你的推荐用户已付费，伙伴礼金 ¥${commissionAmount.toFixed(2)} 已入账！`,
                                    url: '/dashboard',
                                    tag: 'commission_reward'
                                }).catch((e: unknown) => console.error('Failed to send commission notification:', e));
                            }
                        }
                    }
                } catch (commErr) {
                    // Non-fatal: commission failure should not break the webhook
                    console.error('⚠️ Commission allocation failed (non-fatal):', commErr);
                }

                if ('close' in db && typeof (db as any).close === 'function') (db as any).close();
                break;
            }

            case 'invoice.paid': {
                const invoice = event.data.object as Stripe.Invoice;
                const customerId = invoice.customer as string;
                const subscriptionId = (invoice as any).subscription as string;
                const customerEmail = invoice.customer_email;

                console.log(`💳 Invoice paid for customer ${customerId} (${customerEmail})`);

                if (subscriptionId) {
                    try {
                        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
                        const subData = subscription as any;
                        const expiryDate = new Date(subData.current_period_end * 1000);
                        const expiryStr = expiryDate.toISOString();
                        const userIdFromMetadata = subData.metadata?.userId;

                        const db = getDbClient();
                        const isCloud = 'execute' in db;

                        // Self-healing: if we can't find by customerId, try finding by userId from metadata
                        if (isCloud) {
                            // Try updating by customerId first
                            const result = await (db as unknown as { execute: (q: any) => Promise<any> }).execute({
                                sql: "UPDATE users SET subscription_tier = 'pro', subscription_expires_at = ?, stripe_customer_id = ? WHERE stripe_customer_id = ?",
                                args: [expiryStr, customerId, customerId]
                            });

                            // If no row affected and we have metadata userId, repair the record
                            if (result.rowsAffected === 0 && userIdFromMetadata) {
                                console.log(`🔧 Self-healing: Repairing user ${userIdFromMetadata} with customerId ${customerId}`);
                                await (db as unknown as { execute: (q: any) => Promise<any> }).execute({
                                    sql: "UPDATE users SET stripe_customer_id = ?, subscription_expires_at = ?, subscription_tier = 'pro' WHERE user_id = ?",
                                    args: [customerId, expiryStr, userIdFromMetadata]
                                });
                            }
                        } else {
                            const stmt = (db as unknown as { prepare: (q: string) => any }).prepare("UPDATE users SET subscription_tier = 'pro', subscription_expires_at = ?, stripe_customer_id = ? WHERE stripe_customer_id = ?");
                            const result = stmt.run(expiryStr, customerId, customerId);

                            if (result.changes === 0 && userIdFromMetadata) {
                                console.log(`🔧 Self-healing (Local): Repairing user ${userIdFromMetadata} with customerId ${customerId}`);
                                (db as unknown as { prepare: (q: string) => any }).prepare("UPDATE users SET stripe_customer_id = ?, subscription_expires_at = ?, subscription_tier = 'pro' WHERE user_id = ?")
                                    .run(customerId, expiryStr, userIdFromMetadata);
                            }
                        }
                        if ('close' in db && typeof db.close === 'function') (db as any).close();
                        console.log(`📅 Updated expiry for customer ${customerId} to ${expiryStr}`);
                    } catch (err) {
                        console.error('❌ Error handling invoice.paid:', err);
                    }
                }
                break;
            }

            case 'customer.subscription.deleted': {
                const subscription = event.data.object as Stripe.Subscription;
                const customerId = subscription.customer as string;
                const userIdFromMetadata = subscription.metadata?.userId;

                console.log(`🔴 Subscription deleted for customer ${customerId}`);

                const db = getDbClient();
                const isCloud = 'execute' in db;

                if (isCloud) {
                    const result = await (db as unknown as { execute: (q: any) => Promise<any> }).execute({
                        sql: "UPDATE users SET subscription_tier = 'free', subscription_expires_at = NULL WHERE stripe_customer_id = ?",
                        args: [customerId]
                    });

                    // If not found by customerId, try metadata
                    if (result.rowsAffected === 0 && userIdFromMetadata) {
                        await (db as unknown as { execute: (q: any) => Promise<any> }).execute({
                            sql: "UPDATE users SET subscription_tier = 'free', subscription_expires_at = NULL WHERE user_id = ?",
                            args: [userIdFromMetadata]
                        });
                    }
                } else {
                    const result = (db as unknown as { prepare: (q: string) => any }).prepare("UPDATE users SET subscription_tier = 'free', subscription_expires_at = NULL WHERE stripe_customer_id = ?")
                        .run(customerId);

                    if (result.changes === 0 && userIdFromMetadata) {
                        (db as unknown as { prepare: (q: string) => any }).prepare("UPDATE users SET subscription_tier = 'free', subscription_expires_at = NULL WHERE user_id = ?")
                            .run(userIdFromMetadata);
                    }
                }

                if ('close' in db && typeof db.close === 'function') (db as any).close();
                break;
            }

            default:
                console.log(`ℹ️ Unhandled event type ${event.type}`);
        }

        return NextResponse.json({ received: true });
    } catch (error: unknown) {
        console.error('❌ Webhook handler error:', error);
        return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
    }
}
