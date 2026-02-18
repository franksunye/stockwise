/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getDbClient } from '@/lib/db';

export async function POST(request: Request) {
    // 强制依赖明确的环境变量配置，拒绝硬编码兜底，确保运维逻辑清晰
    // NEXT_PUBLIC_APP_URL: 应用主入口 (e.g. https://app.ziso.cc)
    // NEXT_PUBLIC_SITE_URL: 官网主入口 (e.g. https://ziso.cc)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

    if (!appUrl || !siteUrl) {
        console.error("❌ Missing required environment variables: NEXT_PUBLIC_APP_URL or NEXT_PUBLIC_SITE_URL");
        return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
        console.error("❌ Missing STRIPE_SECRET_KEY");
        return NextResponse.json({ error: "Checkout not configured (STRIPE_SECRET_KEY missing)" }, { status: 500 });
    }

    const stripe = new Stripe(stripeKey, {
        apiVersion: '2025-01-27.acacia' as any, // 锁定版本或使用最新稳定版
    });
    try {
        const { priceId, userId } = await request.json();

        if (!priceId || !userId) {
            return NextResponse.json({ error: 'Missing priceId or userId' }, { status: 400 });
        }

        // 1. Lookup User to reuse Stripe Customer ID (Single Customer View)
        let stripeCustomerId: string | null = null;
        let db: any;

        try {
            db = getDbClient();
            const isCloud = 'execute' in db && typeof db.execute === 'function' && !('prepare' in db);

            if (isCloud) {
                const res = await db.execute({
                    sql: "SELECT stripe_customer_id FROM users WHERE user_id = ?",
                    args: [userId]
                });
                if (res.rows.length > 0) {
                    stripeCustomerId = res.rows[0].stripe_customer_id as string;
                }
            } else {
                const row = db.prepare("SELECT stripe_customer_id FROM users WHERE user_id = ?").get(userId) as { stripe_customer_id: string } | undefined;
                if (row) {
                    stripeCustomerId = row.stripe_customer_id;
                }
            }
        } catch (dbErr) {
            console.error('Failed to lookup existing customer ID:', dbErr);
            // Non-blocking, continue as new customer
        } finally {
            if (db && typeof db.close === 'function') db.close();
        }

        const sessionConfig: Stripe.Checkout.SessionCreateParams = {
            payment_method_types: ['card'],
            mode: 'subscription',
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            client_reference_id: userId,
            success_url: `${appUrl}/dashboard?checkout=success`,
            cancel_url: `${appUrl}/pricing?checkout=cancelled`,
            subscription_data: {
                metadata: {
                    userId,
                },
            },
            metadata: {
                userId,
            },
        };

        // IF existing customer -> Reuse ID
        if (stripeCustomerId) {
            console.log(`♻️  Reusing existing Stripe Customer ID: ${stripeCustomerId} for user ${userId}`);
            sessionConfig.customer = stripeCustomerId;
            // Optionally allow updating address/email if the user enters new info
            sessionConfig.customer_update = {
                address: 'auto',
                name: 'auto',
            };
        }

        // Create Stripe Checkout Session
        const session = await stripe.checkout.sessions.create(sessionConfig);

        return NextResponse.json({ url: session.url });
    } catch (error: unknown) {
        console.error('Stripe Checkout Session error:', error);
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
