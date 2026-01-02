// routes/webhooks.js

import express from 'express';
import Stripe from 'stripe';
import User from '../models/user.js';

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

router.post(
    '/stripe',
    express.raw({ type: 'application/json' }),
    async (req, res) => {
        const sig = req.headers['stripe-signature'];
        let event;

        try {
            event = stripe.webhooks.constructEvent(
                req.body,
                sig,
                process.env.STRIPE_WEBHOOK_SECRET
            );
        } catch (err) {
            console.error('⚠️ Webhook signature failed:', err.message);
            return res.status(400).send(`Webhook Error: ${err.message}`);
        }

        console.log('📥 Stripe Webhook received:', event.type);

        try {
            switch (event.type) {
                // ==================== CONNECT ACCOUNT EVENTS ====================
                case 'account.updated': {
                    const account = event.data.object;

                    // FIXED: Find user by stripeConnectAccountId (primary method)
                    let user = await User.findOne({ stripeConnectAccountId: account.id });

                    // Fallback: Try metadata if user not found
                    if (!user && account.metadata?.userId) {
                        user = await User.findById(account.metadata.userId);

                        // If found by metadata, update their stripeConnectAccountId
                        if (user && !user.stripeConnectAccountId) {
                            user.stripeConnectAccountId = account.id;
                            await user.save();
                            console.log(`📝 Updated user ${user._id} with stripeConnectAccountId: ${account.id}`);
                        }
                    }

                    if (!user) {
                        console.log(`⚠️ No user found for Stripe account: ${account.id}`);
                        break;
                    }

                    // Determine status based on Stripe account state
                    let newStatus = 'pending';

                    if (account.charges_enabled && account.payouts_enabled) {
                        newStatus = 'active';
                    } else if (account.requirements?.disabled_reason) {
                        newStatus = 'restricted';
                    } else if (account.details_submitted) {
                        newStatus = 'pending'; // Submitted but not fully verified
                    } else {
                        newStatus = 'onboarding_started';
                    }

                    const oldStatus = user.stripeConnectStatus;

                    // Prepare update data
                    const updateData = {
                        stripeConnectStatus: newStatus,
                        'stripeConnectDetails.chargesEnabled': account.charges_enabled,
                        'stripeConnectDetails.payoutsEnabled': account.payouts_enabled,
                        'stripeConnectDetails.detailsSubmitted': account.details_submitted,
                        'stripeConnectDetails.currentlyDue': account.requirements?.currently_due || [],
                        'stripeConnectDetails.eventuallyDue': account.requirements?.eventually_due || [],
                        'stripeConnectDetails.pastDue': account.requirements?.past_due || [],
                        'stripeConnectDetails.disabledReason': account.requirements?.disabled_reason || null,
                    };

                    // Set verified date if becoming active for first time
                    if (newStatus === 'active' && oldStatus !== 'active') {
                        updateData.stripeConnectVerifiedAt = new Date();
                    }

                    await User.findByIdAndUpdate(user._id, updateData);

                    console.log(`✅ User ${user._id} Stripe status: ${oldStatus || 'none'} → ${newStatus}`);
                    console.log(`   Charges: ${account.charges_enabled}, Payouts: ${account.payouts_enabled}`);

                    if (account.requirements?.currently_due?.length > 0) {
                        console.log(`   Pending requirements: ${account.requirements.currently_due.join(', ')}`);
                    }

                    // Celebrate when account becomes active! 🎉
                    if (newStatus === 'active' && oldStatus !== 'active') {
                        console.log(`🎉 User ${user._id} (${user.email}) Stripe Connect is now FULLY ACTIVE!`);
                    }

                    break;
                }

                case 'account.application.deauthorized': {
                    const account = event.data.object;

                    const user = await User.findOne({ stripeConnectAccountId: account.id });

                    if (user) {
                        await User.findByIdAndUpdate(user._id, {
                            stripeConnectStatus: 'not_connected',
                            stripeConnectAccountId: null,
                            'stripeConnectDetails.chargesEnabled': false,
                            'stripeConnectDetails.payoutsEnabled': false,
                            'stripeConnectDetails.detailsSubmitted': false,
                        });

                        console.log(`🚫 User ${user._id} disconnected their Stripe account`);
                    }
                    break;
                }

                // ==================== PAYMENT EVENTS ====================
                case 'payment_intent.succeeded':
                    console.log('✅ Payment succeeded:', event.data.object.id);
                    break;

                case 'payment_intent.payment_failed':
                    console.error('❌ Payment failed:', event.data.object.last_payment_error?.message);
                    break;

                case 'payment_intent.amount_capturable_updated':
                    console.log('💰 Payment authorized (on hold):', event.data.object.id);
                    break;

                // ==================== TRANSFER EVENTS ====================
                case 'transfer.created':
                    console.log('💸 Transfer to tasker created:', event.data.object.amount / 100);
                    break;

                case 'transfer.paid':
                    console.log('✅ Transfer to tasker completed');
                    break;

                case 'transfer.failed':
                    console.error('❌ Transfer to tasker failed:', event.data.object.id);
                    break;

                // ==================== PAYOUT EVENTS ====================
                case 'payout.paid':
                    console.log('🏦 Payout to tasker bank successful');
                    break;

                case 'payout.failed':
                    console.error('❌ Payout to bank failed:', event.data.object.failure_message);
                    break;

                default:
                    console.log(`ℹ️ Unhandled event: ${event.type}`);
            }

            res.json({ received: true });

        } catch (error) {
            console.error('❌ Webhook handler error:', error);
            // Still return 200 to prevent Stripe from retrying indefinitely
            res.status(200).json({ received: true, error: error.message });
        }
    }
);

export default router;