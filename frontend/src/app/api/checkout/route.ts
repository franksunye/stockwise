import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getDbClient } from '@/lib/db';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
    apiVersion: '2025-12-15.clover',
});

export async function POST(request: Request) {
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
            success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?checkout=success`,
            cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing?checkout=cancelled`,
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
        } else {
            // New user -> Create new customer
            sessionConfig.customer_creation = 'always';
        }

        // Create Stripe Checkout Session
        const session = await stripe.checkout.sessions.create(sessionConfig);

        return NextResponse.json({ url: session.url });
    } catch (error: unknown) {
        console.error('Stripe Checkout Session error:', error);
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
