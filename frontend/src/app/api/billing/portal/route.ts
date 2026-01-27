import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getDbClient } from '@/lib/db';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
    apiVersion: '2025-12-15.clover',
});

export async function POST(request: Request) {
    let db: any;
    try {
        const { userId } = await request.json();

        if (!userId) {
            return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
        }

        db = getDbClient();
        const isCloud = 'execute' in db && typeof db.execute === 'function' && !('prepare' in db);

        // Fetch user from DB to get stripe_customer_id
        let user;
        if (isCloud) {
            const res = await db.execute({
                sql: "SELECT stripe_customer_id FROM users WHERE user_id = ?",
                args: [userId]
            });
            user = res.rows[0];
        } else {
            user = db.prepare("SELECT stripe_customer_id FROM users WHERE user_id = ?").get(userId);
        }

        if (!user || !user.stripe_customer_id) {
            return NextResponse.json({ error: 'No active subscription found (missing customer ID)' }, { status: 404 });
        }

        // Create Stripe Portal Session
        const session = await stripe.billingPortal.sessions.create({
            customer: user.stripe_customer_id as string,
            return_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing`,
        });

        return NextResponse.json({ url: session.url });

    } catch (error: any) {
        console.error('Portal session error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    } finally {
        if (db && typeof db.close === 'function') {
            db.close();
        }
    }
}
