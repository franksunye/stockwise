import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getDbClient } from '@/lib/db';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
    apiVersion: '2025-01-27.acacia' as any,
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(req: Request) {
    const body = await req.text();
    const sig = (await headers()).get('stripe-signature') as string;

    let event: Stripe.Event;

    try {
        if (!sig || !webhookSecret) {
            throw new Error('Missing stripe-signature or webhook secret');
        }
        event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
    } catch (err: any) {
        console.error(`❌ Webhook signature verification failed: ${err.message}`);
        return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
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
                expiryDate.setFullYear(expiryDate.getFullYear() + 1); // Default to 1 year fallback
                let finalCustomerId = customerId;

                if (subscriptionId) {
                    try {
                        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
                        expiryDate = new Date((subscription as any).current_period_end * 1000);

                        // Fallback for customer ID if not in session
                        if (!finalCustomerId && (subscription as any).customer) {
                            finalCustomerId = (subscription as any).customer as string;
                        }

                        console.log(`📅 Subscription info: End=${expiryDate.toISOString()}, Customer=${finalCustomerId}`);
                    } catch (err: any) {
                        console.error('❌ Error retrieving subscription details:', err);
                    }
                } else {
                    // No subscriptionId in session
                }

                const expiryStr = expiryDate.toISOString();
                const emailToUpdate = customerEmail || null;

                console.log(`💾 DB Update Params -> User: ${userId}, Tier: pro, Expiry: ${expiryStr}, CustomerID: ${finalCustomerId}, Email: ${emailToUpdate}`);

                // Update user in database
                const db = getDbClient();
                const isCloud = 'execute' in db;

                try {
                    if (isCloud) {
                        await db.execute({
                            sql: "UPDATE users SET subscription_tier = 'pro', subscription_expires_at = ?, stripe_customer_id = ?, email = ? WHERE user_id = ?",
                            args: [expiryStr, finalCustomerId, emailToUpdate, userId]
                        });
                    } else {
                        const stmt = db.prepare("UPDATE users SET subscription_tier = 'pro', subscription_expires_at = ?, stripe_customer_id = ?, email = ? WHERE user_id = ?");
                        const result = stmt.run(expiryStr, finalCustomerId, emailToUpdate, userId);
                        console.log('✅ SQLite update successful. Changes:', result.changes);
                    }
                } catch (dbErr) {
                    console.error('❌ Database update failed:', dbErr);
                }

                if ('close' in db && typeof db.close === 'function') db.close();
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
                        const expiryDate = new Date((subscription as any).current_period_end * 1000);
                        const expiryStr = expiryDate.toISOString();

                        const db = getDbClient();
                        const isCloud = 'execute' in db;

                        if (isCloud) {
                            await db.execute({
                                sql: "UPDATE users SET subscription_tier = 'pro', subscription_expires_at = ?, stripe_customer_id = ? WHERE stripe_customer_id = ?",
                                args: [expiryStr, customerId, customerId]
                            });
                        } else {
                            db.prepare("UPDATE users SET subscription_tier = 'pro', subscription_expires_at = ?, stripe_customer_id = ? WHERE stripe_customer_id = ?")
                                .run(expiryStr, customerId, customerId);
                        }
                        if ('close' in db && typeof db.close === 'function') db.close();
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

                console.log(`🔴 Subscription deleted for customer ${customerId}`);

                const db = getDbClient();
                const isCloud = 'execute' in db;

                if (isCloud) {
                    await db.execute({
                        sql: "UPDATE users SET subscription_tier = 'free', subscription_expires_at = NULL WHERE stripe_customer_id = ?",
                        args: [customerId]
                    });
                } else {
                    db.prepare("UPDATE users SET subscription_tier = 'free', subscription_expires_at = NULL WHERE stripe_customer_id = ?")
                        .run(customerId);
                }

                if ('close' in db && typeof db.close === 'function') db.close();
                break;
            }

            // Add more cases like invoice.payment_failed as needed
            default:
                console.log(`ℹ️ Unhandled event type ${event.type}`);
        }

        return NextResponse.json({ received: true });
    } catch (error: any) {
        console.error('❌ Webhook handler error:', error);
        return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
    }
}
