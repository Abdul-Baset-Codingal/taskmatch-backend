// controllers/webhookController.js

import Stripe from 'stripe';
import Transaction from '../models/Transaction.js';
import User from '../models/user.js';
import Task from '../models/task.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const handleStripeWebhook = async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    console.log(`📩 Webhook received: ${event.type}`);

    try {
        switch (event.type) {
            // ============ PAYMENT EVENTS ============
            case 'payment_intent.succeeded':
                await handlePaymentSucceeded(event.data.object);
                break;

            case 'payment_intent.payment_failed':
                await handlePaymentFailed(event.data.object);
                break;

            case 'payment_intent.canceled':
                await handlePaymentCanceled(event.data.object);
                break;

            // ============ TRANSFER EVENTS ============
            case 'transfer.created':
                await handleTransferCreated(event.data.object);
                break;

            case 'transfer.failed':
                await handleTransferFailed(event.data.object);
                break;

            case 'transfer.reversed':
                await handleTransferReversed(event.data.object);
                break;

            // ============ PAYOUT EVENTS ============
            case 'payout.paid':
                await handlePayoutPaid(event.data.object);
                break;

            case 'payout.failed':
                await handlePayoutFailed(event.data.object);
                break;

            // ============ CONNECT ACCOUNT EVENTS ============
            case 'account.updated':
                await handleAccountUpdated(event.data.object);
                break;

            case 'account.application.deauthorized':
                await handleAccountDeauthorized(event.data.object);
                break;

            // ============ REFUND EVENTS ============
            case 'charge.refunded':
                await handleChargeRefunded(event.data.object);
                break;

            default:
                console.log(`Unhandled event type: ${event.type}`);
        }

        res.json({ received: true });

    } catch (error) {
        console.error(`Error handling webhook ${event.type}:`, error);
        res.status(500).json({ error: error.message });
    }
};

// ============ HANDLER FUNCTIONS ============

async function handlePaymentSucceeded(paymentIntent) {
    console.log(`✅ Payment succeeded: ${paymentIntent.id}`);

    const transaction = await Transaction.findOne({
        stripePaymentIntentId: paymentIntent.id
    });

    if (transaction && transaction.status === 'pending') {
        transaction.status = 'authorized';
        transaction.statusHistory.push({
            status: 'authorized',
            changedAt: new Date(),
            reason: 'Payment authorized via webhook'
        });
        await transaction.save();
    }
}

async function handlePaymentFailed(paymentIntent) {
    console.log(`❌ Payment failed: ${paymentIntent.id}`);

    const transaction = await Transaction.findOne({
        stripePaymentIntentId: paymentIntent.id
    });

    if (transaction) {
        transaction.status = 'failed';
        transaction.statusHistory.push({
            status: 'failed',
            changedAt: new Date(),
            reason: paymentIntent.last_payment_error?.message || 'Payment failed'
        });
        await transaction.save();

        // Update task
        await Task.findByIdAndUpdate(transaction.taskId, {
            paymentStatus: 'failed'
        });
    }
}

async function handlePaymentCanceled(paymentIntent) {
    console.log(`🚫 Payment canceled: ${paymentIntent.id}`);

    const transaction = await Transaction.findOne({
        stripePaymentIntentId: paymentIntent.id
    });

    if (transaction) {
        transaction.status = 'cancelled';
        transaction.statusHistory.push({
            status: 'cancelled',
            changedAt: new Date(),
            reason: 'Payment cancelled'
        });
        await transaction.save();
    }
}

async function handleTransferCreated(transfer) {
    console.log(`💸 Transfer created: ${transfer.id} to ${transfer.destination}`);

    const transaction = await Transaction.findOne({
        stripeTransferId: transfer.id
    });

    if (transaction) {
        transaction.taskerPayout.status = 'completed';
        transaction.taskerPayout.processedDate = new Date();
        await transaction.save();
    }
}

async function handleTransferFailed(transfer) {
    console.log(`❌ Transfer failed: ${transfer.id}`);

    const transaction = await Transaction.findOne({
        $or: [
            { stripeTransferId: transfer.id },
            { 'metadata.transferId': transfer.id }
        ]
    });

    if (transaction) {
        transaction.taskerPayout.status = 'failed';
        transaction.taskerPayout.failureReason = 'Transfer failed';
        transaction.statusHistory.push({
            status: 'tasker_payout_failed',
            changedAt: new Date(),
            reason: 'Stripe transfer failed'
        });
        await transaction.save();
    }
}

async function handleTransferReversed(transfer) {
    console.log(`↩️ Transfer reversed: ${transfer.id}`);

    const transaction = await Transaction.findOne({
        stripeTransferId: transfer.id
    });

    if (transaction) {
        transaction.taskerPayout.status = 'cancelled';
        transaction.taskerPayout.notes = 'Transfer was reversed';
        transaction.statusHistory.push({
            status: 'transfer_reversed',
            changedAt: new Date(),
            reason: 'Transfer reversed'
        });
        await transaction.save();
    }
}

async function handlePayoutPaid(payout) {
    console.log(`💰 Payout paid: ${payout.id}`);
    // This is when money hits the tasker's bank account
}

async function handlePayoutFailed(payout) {
    console.log(`❌ Payout to bank failed: ${payout.id}`);
}

async function handleAccountUpdated(account) {
    console.log(`👤 Connect account updated: ${account.id}`);

    const user = await User.findOne({ stripeConnectAccountId: account.id });

    if (user) {
        let status = 'pending';
        if (account.details_submitted && account.payouts_enabled) {
            status = 'active';
        } else if (account.requirements?.disabled_reason) {
            status = 'restricted';
        }

        user.stripeConnectStatus = status;
        user.stripeConnectOnboardingComplete = account.details_submitted;
        user.stripeConnectDetails = {
            chargesEnabled: account.charges_enabled,
            payoutsEnabled: account.payouts_enabled,
            detailsSubmitted: account.details_submitted,
            currentlyDue: account.requirements?.currently_due || [],
            pastDue: account.requirements?.past_due || []
        };

        if (status === 'active' && !user.stripeConnectVerifiedAt) {
            user.stripeConnectVerifiedAt = new Date();
        }

        await user.save();
        console.log(`Updated user ${user._id} Connect status: ${status}`);
    }
}

async function handleAccountDeauthorized(account) {
    console.log(`🚫 Connect account deauthorized: ${account.id}`);

    const user = await User.findOne({ stripeConnectAccountId: account.id });

    if (user) {
        user.stripeConnectStatus = 'not_connected';
        user.stripeConnectAccountId = null;
        await user.save();
    }
}

async function handleChargeRefunded(charge) {
    console.log(`💸 Charge refunded: ${charge.id}`);

    const transaction = await Transaction.findOne({
        stripeChargeId: charge.id
    });

    if (transaction && transaction.status !== 'refunded') {
        transaction.status = 'refunded';
        transaction.statusHistory.push({
            status: 'refunded',
            changedAt: new Date(),
            reason: 'Refund processed via webhook'
        });
        await transaction.save();
    }
}