// controllers/stripeConnectController.js

import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ============================================================
// 1. CREATE CONNECT ACCOUNT FOR TASKER
// ============================================================
// ============================================================
// 1. CREATE CONNECT ACCOUNT FOR TASKER (with invalid account handling)
// ============================================================
export const createConnectAccount = async (req, res) => {
    try {
        const user = req.user;

        // Check if already has Connect account
        if (user.stripeConnectAccountId) {
            try {
                // Verify the account still exists
                const account = await stripe.accounts.retrieve(user.stripeConnectAccountId);

                if (!account.details_submitted) {
                    // Create new onboarding link
                    const accountLink = await stripe.accountLinks.create({
                        account: user.stripeConnectAccountId,
                        refresh_url: `${process.env.FRONTEND_URL}/update-document?stripe_return=refresh`,
                        return_url: `${process.env.FRONTEND_URL}/update-document?stripe_return=complete`,
                        type: 'account_onboarding',
                    });

                    return res.json({
                        success: true,
                        message: 'Continue onboarding',
                        url: accountLink.url,
                        onboardingUrl: accountLink.url,
                        accountId: user.stripeConnectAccountId
                    });
                }

                return res.status(400).json({
                    success: false,
                    error: 'Stripe Connect account already exists and is active',
                    accountId: user.stripeConnectAccountId,
                    status: user.stripeConnectStatus
                });

            } catch (stripeError) {
                // ✅ Account doesn't exist anymore - clear and create new one
                if (
                    stripeError.code === 'account_invalid' ||
                    stripeError.type === 'StripeInvalidRequestError' ||
                    stripeError.message?.includes('No such account') ||
                    stripeError.message?.includes('does not have access')
                ) {
                    console.log(`Existing Stripe account invalid for user ${user._id}, creating new one`);
                    user.stripeConnectAccountId = null;
                    // Continue to create new account below
                } else {
                    throw stripeError;
                }
            }
        }

        // Create new Stripe Connect Express account
        const account = await stripe.accounts.create({
            type: 'express',
            country: user.country || 'CA',
            email: user.email,
            capabilities: {
                card_payments: { requested: true },
                transfers: { requested: true },
            },
            business_type: 'individual',
            individual: {
                email: user.email,
                first_name: user.firstName,
                last_name: user.lastName,
                phone: user.phone
            },
            // ✅ Pre-fill business info so tasker doesn't have to
            business_profile: {
                mcc: '7299',
                name: 'Taskallo',
                url: process.env.FRONTEND_URL || 'https://taskallo.com',
                product_description: 'Professional home services and task completion through the Taskallo platform.'
            },
            metadata: {
                userId: user._id.toString(),
                platform: 'Taskallo'
            },
            settings: {
                payouts: {
                    schedule: {
                        interval: 'daily'
                    }
                }
            }
        });

        // Save to user
        user.stripeConnectAccountId = account.id;
        user.stripeConnectStatus = 'pending';
        user.stripeConnectCreatedAt = new Date();
        user.stripeConnectDetails = {
            chargesEnabled: false,
            payoutsEnabled: false,
            detailsSubmitted: false
        };
        await user.save();

        // Create onboarding link
        const accountLink = await stripe.accountLinks.create({
            account: account.id,
            refresh_url: `${process.env.FRONTEND_URL}/update-document?stripe_return=refresh`,
            return_url: `${process.env.FRONTEND_URL}/update-document?stripe_return=complete`,
            type: 'account_onboarding',
        });

        console.log(`Stripe Connect account created for user ${user._id}: ${account.id}`);

        res.json({
            success: true,
            message: 'Stripe Connect account created',
            url: accountLink.url,
            onboardingUrl: accountLink.url,
            accountId: account.id
        });

    } catch (error) {
        console.error('Create Connect account error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create Stripe Connect account',
            details: error.message
        });
    }
};

// ============================================================
// 2. GET CONNECT ACCOUNT STATUS
// ============================================================
// ============================================================
// 2. GET CONNECT ACCOUNT STATUS (with auto-fix for invalid accounts)
// ============================================================
export const getConnectAccountStatus = async (req, res) => {
    try {
        const user = req.user;

        if (!user.stripeConnectAccountId) {
            return res.json({
                success: true,
                connected: false,
                status: 'not_connected',
                canReceivePayments: false,
                chargesEnabled: false,
                payoutsEnabled: false,
                detailsSubmitted: false,
                message: 'No Stripe Connect account. Please set up payouts.'
            });
        }

        try {
            // Retrieve account from Stripe
            const account = await stripe.accounts.retrieve(user.stripeConnectAccountId);

            // Determine status
            let status = 'pending';
            if (account.charges_enabled && account.payouts_enabled) {
                status = 'active';
            } else if (account.details_submitted && !account.payouts_enabled) {
                status = 'pending_verification';
            } else if (account.requirements?.disabled_reason) {
                status = 'restricted';
            }

            // Update user record
            user.stripeConnectStatus = status;
            user.stripeConnectOnboardingComplete = account.details_submitted;
            user.stripeConnectDetails = {
                chargesEnabled: account.charges_enabled,
                payoutsEnabled: account.payouts_enabled,
                detailsSubmitted: account.details_submitted,
                currentlyDue: account.requirements?.currently_due || [],
                eventuallyDue: account.requirements?.eventually_due || [],
                pastDue: account.requirements?.past_due || []
            };

            if (status === 'active' && !user.stripeConnectVerifiedAt) {
                user.stripeConnectVerifiedAt = new Date();
            }

            await user.save();

            res.json({
                success: true,
                connected: true,
                status,
                accountId: account.id,
                canReceivePayments: account.charges_enabled && account.payouts_enabled,
                chargesEnabled: account.charges_enabled,
                payoutsEnabled: account.payouts_enabled,
                detailsSubmitted: account.details_submitted,
                requirements: {
                    currentlyDue: account.requirements?.currently_due || [],
                    eventuallyDue: account.requirements?.eventually_due || [],
                    pastDue: account.requirements?.past_due || [],
                    disabledReason: account.requirements?.disabled_reason
                },
                payoutsSchedule: account.settings?.payouts?.schedule,
                defaultCurrency: account.default_currency
            });

        } catch (stripeError) {
            console.error('Stripe account retrieval error:', stripeError.message);

            // ✅ AUTO-FIX: Handle invalid/deleted accounts
            if (
                stripeError.code === 'account_invalid' ||
                stripeError.type === 'StripeInvalidRequestError' ||
                stripeError.message?.includes('No such account') ||
                stripeError.message?.includes('does not have access') ||
                stripeError.statusCode === 404
            ) {
                console.log(`Clearing invalid Stripe account for user ${user._id}`);

                // Clear the invalid account from user
                user.stripeConnectAccountId = null;
                user.stripeConnectStatus = 'not_connected';
                user.stripeConnectOnboardingComplete = false;
                user.stripeConnectDetails = {
                    chargesEnabled: false,
                    payoutsEnabled: false,
                    detailsSubmitted: false
                };
                await user.save();

                return res.json({
                    success: true,
                    connected: false,
                    status: 'not_connected',
                    canReceivePayments: false,
                    chargesEnabled: false,
                    payoutsEnabled: false,
                    detailsSubmitted: false,
                    message: 'Previous account was invalid. Please set up a new payment account.',
                    wasReset: true
                });
            }

            // Re-throw other Stripe errors
            throw stripeError;
        }

    } catch (error) {
        console.error('Get Connect status error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get account status',
            details: error.message
        });
    }
};

// ============================================================
// 3. CREATE NEW ONBOARDING LINK (REFRESH)
// ============================================================
export const createOnboardingLink = async (req, res) => {
    try {
        const user = req.user;

        if (!user.stripeConnectAccountId) {
            return res.status(400).json({
                success: false,
                error: 'No Stripe Connect account found. Please create one first.'
            });
        }

        try {
            const accountLink = await stripe.accountLinks.create({
                account: user.stripeConnectAccountId,
                refresh_url: `${process.env.FRONTEND_URL}/update-document?stripe_return=refresh`,
                return_url: `${process.env.FRONTEND_URL}/update-document?stripe_return=complete`,
                type: 'account_onboarding',
            });

            res.json({
                success: true,
                url: accountLink.url,
                onboardingUrl: accountLink.url
            });

        } catch (stripeError) {
            // Handle invalid account
            if (
                stripeError.code === 'account_invalid' ||
                stripeError.message?.includes('No such account')
            ) {
                user.stripeConnectAccountId = null;
                user.stripeConnectStatus = 'not_connected';
                await user.save();

                return res.status(400).json({
                    success: false,
                    error: 'Account was invalid. Please set up a new payment account.',
                    needsNewAccount: true
                });
            }
            throw stripeError;
        }

    } catch (error) {
        console.error('Create onboarding link error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create onboarding link',
            details: error.message
        });
    }
};

// ============================================================
// 4. CREATE STRIPE DASHBOARD LOGIN LINK
// ============================================================
export const createDashboardLink = async (req, res) => {
    try {
        const user = req.user;

        if (!user.stripeConnectAccountId) {
            return res.status(400).json({
                error: 'No Stripe Connect account found'
            });
        }

        const loginLink = await stripe.accounts.createLoginLink(
            user.stripeConnectAccountId
        );

        res.json({
            success: true,
            dashboardUrl: loginLink.url
        });

    } catch (error) {
        console.error('Create dashboard link error:', error);
        res.status(500).json({
            error: 'Failed to create dashboard link',
            details: error.message
        });
    }
};

// ============================================================
// 5. GET BALANCE FOR TASKER
// ============================================================
export const getConnectBalance = async (req, res) => {
    try {
        const user = req.user;

        if (!user.stripeConnectAccountId) {
            return res.status(400).json({
                error: 'No Stripe Connect account found'
            });
        }

        const balance = await stripe.balance.retrieve({
            stripeAccount: user.stripeConnectAccountId
        });

        res.json({
            success: true,
            balance: {
                available: balance.available.map(b => ({
                    amount: (b.amount / 100).toFixed(2),
                    currency: b.currency
                })),
                pending: balance.pending.map(b => ({
                    amount: (b.amount / 100).toFixed(2),
                    currency: b.currency
                }))
            }
        });

    } catch (error) {
        console.error('Get balance error:', error);
        res.status(500).json({
            error: 'Failed to get balance',
            details: error.message
        });
    }
};

// ============================================================
// 6. GET PAYOUT HISTORY
// ============================================================
export const getPayoutHistory = async (req, res) => {
    try {
        const user = req.user;
        const { limit = 10 } = req.query;

        if (!user.stripeConnectAccountId) {
            return res.status(400).json({
                error: 'No Stripe Connect account found'
            });
        }

        const payouts = await stripe.payouts.list({
            limit: parseInt(limit)
        }, {
            stripeAccount: user.stripeConnectAccountId
        });

        res.json({
            success: true,
            payouts: payouts.data.map(p => ({
                id: p.id,
                amount: (p.amount / 100).toFixed(2),
                currency: p.currency,
                status: p.status,
                arrivalDate: new Date(p.arrival_date * 1000),
                created: new Date(p.created * 1000),
                method: p.type,
                description: p.description
            }))
        });

    } catch (error) {
        console.error('Get payout history error:', error);
        res.status(500).json({
            error: 'Failed to get payout history',
            details: error.message
        });
    }
};

// ============================================================
// 7. DELETE/DISCONNECT CONNECT ACCOUNT
// ============================================================
export const disconnectAccount = async (req, res) => {
    try {
        const user = req.user;

        if (!user.stripeConnectAccountId) {
            return res.status(400).json({
                error: 'No Stripe Connect account to disconnect'
            });
        }

        // Note: This doesn't delete the Stripe account, just disconnects from your platform
        await stripe.accounts.del(user.stripeConnectAccountId);

        // Update user
        user.stripeConnectAccountId = null;
        user.stripeConnectStatus = 'not_connected';
        user.stripeConnectOnboardingComplete = false;
        user.stripeConnectDetails = {
            chargesEnabled: false,
            payoutsEnabled: false,
            detailsSubmitted: false
        };
        await user.save();

        res.json({
            success: true,
            message: 'Stripe Connect account disconnected'
        });

    } catch (error) {
        console.error('Disconnect account error:', error);
        res.status(500).json({
            error: 'Failed to disconnect account',
            details: error.message
        });
    }
};