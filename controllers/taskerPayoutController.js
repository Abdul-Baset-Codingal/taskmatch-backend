// controllers/taskerPayoutController.js

import User from '../models/user.js';

// Create Stripe Connect account for tasker
export const createStripeConnectAccount = async (req, res) => {
    try {
        const user = req.user;
        const stripe = (await import('../utils/stripeConfig.js')).default;

        console.log('Creating Stripe Connect account for:', user.email);

        // Check if already has account
        if (user.stripeConnectAccountId) {
            try {
                // Check if account still exists
                const existingAccount = await stripe.accounts.retrieve(user.stripeConnectAccountId);

                if (existingAccount && !existingAccount.deleted) {
                    // Create new onboarding link for existing account
                    const accountLink = await stripe.accountLinks.create({
                        account: user.stripeConnectAccountId,
                        refresh_url: `${process.env.FRONTEND_URL}/tasker/wallet?refresh=true`,
                        return_url: `${process.env.FRONTEND_URL}/tasker/wallet?success=true`,
                        type: 'account_onboarding'
                    });

                    return res.json({
                        success: true,
                        message: 'Continue your account setup',
                        onboardingUrl: accountLink.url,
                        accountId: user.stripeConnectAccountId
                    });
                }
            } catch (e) {
                console.log('Existing account invalid, creating new one');
            }
        }

        // Create new Express connected account
        const account = await stripe.accounts.create({
            type: 'express',
            country: 'CA', // Change to 'US' or your country
            email: user.email,
            capabilities: {
                card_payments: { requested: true },
                transfers: { requested: true }
            },
            business_type: 'individual',
            individual: {
                email: user.email,
                first_name: user.firstName,
                last_name: user.lastName
            },
            business_profile: {
                name: `${user.firstName} ${user.lastName}`,
                product_description: 'Freelance services on TaskMatch platform'
            },
            metadata: {
                platform: 'TaskMatch',
                userId: user._id.toString(),
                email: user.email
            },
            settings: {
                payouts: {
                    schedule: {
                        interval: 'daily' // or 'weekly', 'monthly'
                    }
                }
            }
        });

        console.log('Stripe Connect account created:', account.id);

        // Save account ID to user
        await User.findByIdAndUpdate(user._id, {
            stripeConnectAccountId: account.id,
            stripeConnectStatus: 'pending'
        });

        // Create account link for onboarding
        const accountLink = await stripe.accountLinks.create({
            account: account.id,
            refresh_url: `${process.env.FRONTEND_URL}/tasker/wallet?refresh=true`,
            return_url: `${process.env.FRONTEND_URL}/tasker/wallet?success=true`,
            type: 'account_onboarding'
        });

        res.json({
            success: true,
            message: 'Stripe account created. Complete setup to receive payments.',
            accountId: account.id,
            onboardingUrl: accountLink.url
        });

    } catch (err) {
        console.error('createStripeConnectAccount error:', err);
        res.status(400).json({ error: err.message });
    }
};

// Get Stripe Connect account status
export const getStripeConnectStatus = async (req, res) => {
    try {
        const user = req.user;
        const stripe = (await import('../utils/stripeConfig.js')).default;

        if (!user.stripeConnectAccountId) {
            return res.json({
                success: true,
                connected: false,
                status: 'not_connected',
                message: 'Connect your bank account to receive payments'
            });
        }

        try {
            const account = await stripe.accounts.retrieve(user.stripeConnectAccountId);

            // Update user status in database
            let status = 'pending';
            if (account.charges_enabled && account.payouts_enabled) {
                status = 'active';
            } else if (account.details_submitted) {
                status = 'pending_verification';
            }

            await User.findByIdAndUpdate(user._id, {
                stripeConnectStatus: status
            });

            res.json({
                success: true,
                connected: true,
                status: status,
                accountId: account.id,
                chargesEnabled: account.charges_enabled,
                payoutsEnabled: account.payouts_enabled,
                detailsSubmitted: account.details_submitted,
                requirements: account.requirements,
                // If not fully set up, provide link to complete
                needsAction: !account.charges_enabled || !account.payouts_enabled,
                currentDeadline: account.requirements?.current_deadline
            });

        } catch (stripeErr) {
            // Account might be deleted or invalid
            await User.findByIdAndUpdate(user._id, {
                stripeConnectAccountId: null,
                stripeConnectStatus: 'not_connected'
            });

            return res.json({
                success: true,
                connected: false,
                status: 'not_connected',
                error: 'Previous account invalid. Please reconnect.'
            });
        }

    } catch (err) {
        console.error('getStripeConnectStatus error:', err);
        res.status(400).json({ error: err.message });
    }
};

// Get balance from Stripe Connect account
export const getStripeBalance = async (req, res) => {
    try {
        const user = req.user;
        const stripe = (await import('../utils/stripeConfig.js')).default;

        if (!user.stripeConnectAccountId) {
            return res.json({
                success: true,
                balance: {
                    available: 0,
                    pending: 0
                }
            });
        }

        // Get balance for the connected account
        const balance = await stripe.balance.retrieve({
            stripeAccount: user.stripeConnectAccountId
        });

        // Convert to readable format
        const available = balance.available.reduce((sum, b) => sum + b.amount, 0) / 100;
        const pending = balance.pending.reduce((sum, b) => sum + b.amount, 0) / 100;

        res.json({
            success: true,
            balance: {
                available: available.toFixed(2),
                pending: pending.toFixed(2),
                currency: balance.available[0]?.currency || 'usd'
            }
        });

    } catch (err) {
        console.error('getStripeBalance error:', err);
        res.status(400).json({ error: err.message });
    }
};

// Get tasker's payout history
export const getPayoutHistory = async (req, res) => {
    try {
        const user = req.user;
        const Transaction = (await import('../models/Transaction.js')).default;

        // Get all payouts for this tasker
        const payouts = await Transaction.find({
            taskerId: user._id,
            status: { $in: ['tasker_paid', 'tasker_payout_processing'] }
        })
            .sort({ createdAt: -1 })
            .limit(50)
            .populate('taskId', 'taskTitle')
            .lean();

        const formattedPayouts = payouts.map(p => ({
            id: p.transactionId,
            taskTitle: p.taskId?.taskTitle || p.taskSnapshot?.title || 'Unknown Task',
            amount: ((p.amounts?.taskerEarnings || 0) / 100).toFixed(2),
            status: p.taskerPayout?.status || 'pending',
            method: p.taskerPayout?.payoutMethod || 'unknown',
            date: p.taskerPayout?.processedDate || p.createdAt,
            stripeTransferId: p.stripeTransferId
        }));

        // Calculate totals
        const totalEarned = payouts.reduce((sum, p) => sum + (p.amounts?.taskerEarnings || 0), 0) / 100;
        const totalPending = payouts
            .filter(p => p.taskerPayout?.status === 'processing')
            .reduce((sum, p) => sum + (p.amounts?.taskerEarnings || 0), 0) / 100;

        res.json({
            success: true,
            payouts: formattedPayouts,
            summary: {
                totalEarned: totalEarned.toFixed(2),
                totalPending: totalPending.toFixed(2),
                payoutCount: payouts.length
            }
        });

    } catch (err) {
        console.error('getPayoutHistory error:', err);
        res.status(400).json({ error: err.message });
    }
};

// Create Stripe Express Dashboard login link
export const getStripeDashboardLink = async (req, res) => {
    try {
        const user = req.user;
        const stripe = (await import('../utils/stripeConfig.js')).default;

        if (!user.stripeConnectAccountId) {
            return res.status(400).json({ error: 'No Stripe account connected' });
        }

        // Create login link to Stripe Express Dashboard
        const loginLink = await stripe.accounts.createLoginLink(user.stripeConnectAccountId);

        res.json({
            success: true,
            url: loginLink.url
        });

    } catch (err) {
        console.error('getStripeDashboardLink error:', err);
        res.status(400).json({ error: err.message });
    }
};