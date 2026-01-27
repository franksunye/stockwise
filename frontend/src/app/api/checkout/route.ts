import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
    apiVersion: '2025-01-27.acacia' as any, // Use the latest API version or a stable one
});

export async function POST(request: Request) {
    try {
        const { priceId, userId } = await request.json();

        if (!priceId || !userId) {
            return NextResponse.json({ error: 'Missing priceId or userId' }, { status: 400 });
        }

        // Create Stripe Checkout Session
        const session = await stripe.checkout.sessions.create({
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
            // For future: metadata can hold more info
            metadata: {
                userId,
            },
            // Ensure specific tax logic if needed, but keeping it simple for now
        });

        return NextResponse.json({ url: session.url });
    } catch (error: any) {
        console.error('Stripe Checkout Session error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
