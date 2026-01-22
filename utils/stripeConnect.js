// utils/stripeConnect.js

import Stripe from 'stripe';
import User from '../models/user.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Add fallback for FRONTEND_URL
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// const PLATFORM_FEE_PERCENTAGE = 15;

// /**
//  * Calculate platform fee and tasker payout
//  */
// export const calculateFees = (amountInCents) => {
//     const platformFee = Math.round(amountInCents * (PLATFORM_FEE_PERCENTAGE / 100));
//     const taskerPayout = amountInCents - platformFee;
//     return { platformFee, taskerPayout };
// };

const CLIENT_PLATFORM_FEE_PERCENT = 10;    // 10%
const RESERVATION_FEE_CENTS = 500;          // $5 flat
const CLIENT_TAX_PERCENT = 13;              // 13% HST

// Tasker Side  
const TASKER_PLATFORM_FEE_PERCENT = 12;    // 12%
const TASKER_TAX_PERCENT = 13;              // 13% tax

/**
 * Calculate all fees for double-sided fee structure
 * @param {number} bidAmountInCents - The bid amount in cents
 * @returns {Object} - All fee calculations
 */
export const calculateFees = (bidAmountInCents) => {
    // ─── CLIENT SIDE ───
    const clientPlatformFee = Math.round(bidAmountInCents * (CLIENT_PLATFORM_FEE_PERCENT / 100));
    const reservationFee = RESERVATION_FEE_CENTS;
    const clientTax = Math.round(bidAmountInCents * (CLIENT_TAX_PERCENT / 100));
    const totalClientPays = bidAmountInCents + clientPlatformFee + reservationFee + clientTax;

    // ─── TASKER SIDE ───
    const taskerPlatformFee = Math.round(bidAmountInCents * (TASKER_PLATFORM_FEE_PERCENT / 100));
    const taskerTax = Math.round(bidAmountInCents * (TASKER_TAX_PERCENT / 100));
    const taskerPayout = bidAmountInCents - taskerPlatformFee - taskerTax;

    // ─── PLATFORM ───
    const applicationFee = totalClientPays - taskerPayout;

    return {
        // Client
        clientPlatformFee,
        reservationFee,
        clientTax,
        totalClientPays,

        // Tasker
        taskerPlatformFee,
        taskerTax,
        taskerPayout,

        // Platform
        applicationFee
    };
};



/**
 * Validate tasker can receive payments
 */
export const validateTaskerCanReceivePayments = async (taskerId) => {
    const tasker = await User.findById(taskerId);

    if (!tasker) {
        throw new Error('Tasker not found');
    }

    if (!tasker.stripeConnectAccountId) {
        throw new Error('Tasker has not set up their payment account. They need to complete Stripe onboarding first.');
    }

    try {
        // Always check Stripe directly for the most accurate status
        const account = await stripe.accounts.retrieve(tasker.stripeConnectAccountId);

        console.log("🔍 Stripe Account Status Check:", {
            taskerId,
            accountId: tasker.stripeConnectAccountId,
            chargesEnabled: account.charges_enabled,
            payoutsEnabled: account.payouts_enabled,
            detailsSubmitted: account.details_submitted,
            requirements: account.requirements?.currently_due || [],
        });

        // Update local DB status if different from Stripe
        let newStatus = 'pending';
        if (account.charges_enabled && account.payouts_enabled) {
            newStatus = 'active';
        } else if (account.details_submitted) {
            newStatus = 'pending'; // Submitted but not fully verified
        } else if (account.requirements?.disabled_reason) {
            newStatus = 'restricted';
        }

        // Sync local status with Stripe
        if (tasker.stripeConnectStatus !== newStatus) {
            console.log(`📝 Updating tasker ${taskerId} status: ${tasker.stripeConnectStatus} → ${newStatus}`);

            await User.findByIdAndUpdate(taskerId, {
                stripeConnectStatus: newStatus,
                'stripeConnectDetails.chargesEnabled': account.charges_enabled,
                'stripeConnectDetails.payoutsEnabled': account.payouts_enabled,
                'stripeConnectDetails.detailsSubmitted': account.details_submitted,
                'stripeConnectDetails.currentlyDue': account.requirements?.currently_due || [],
                'stripeConnectDetails.eventuallyDue': account.requirements?.eventually_due || [],
                'stripeConnectDetails.pastDue': account.requirements?.past_due || [],
                'stripeConnectDetails.disabledReason': account.requirements?.disabled_reason || null,
            });
        }

        // Check if payments can be received
        if (!account.charges_enabled) {
            const pendingRequirements = account.requirements?.currently_due || [];
            throw new Error(
                `Tasker's payment account is not ready to receive payments. ` +
                `They need to complete Stripe verification. ` +
                (pendingRequirements.length > 0
                    ? `Missing: ${pendingRequirements.join(', ')}`
                    : 'Verification is pending.')
            );
        }

        if (!account.payouts_enabled) {
            throw new Error(
                'Tasker cannot receive payouts yet. They may need to add a bank account or complete additional verification.'
            );
        }

        return tasker.stripeConnectAccountId;

    } catch (stripeError) {
        // If it's our custom error, re-throw it
        if (stripeError.message.includes('payment account')) {
            throw stripeError;
        }
        // Otherwise, it's a Stripe API error
        console.error('Stripe API error:', stripeError);
        throw new Error(`Could not verify tasker payment account: ${stripeError.message}`);
    }
};

/**
 * Create Stripe Connect account for tasker
 */
export const createConnectAccount = async (userId) => {
    const user = await User.findById(userId);

    if (!user) {
        throw new Error('User not found');
    }

    if (user.stripeConnectAccountId) {
        return user.stripeConnectAccountId;
    }

    const account = await stripe.accounts.create({
        type: 'express',
        country: 'CA',
        email: user.email,
        capabilities: {
            card_payments: { requested: true },
            transfers: { requested: true },
        },
        business_type: 'individual',
        individual: {
            first_name: user.firstName,
            last_name: user.lastName,
            email: user.email,
        },
        metadata: {
            userId: user._id.toString(),
        },
    });

    await User.findByIdAndUpdate(userId, {
        stripeConnectAccountId: account.id,
        stripeConnectStatus: 'pending',
        stripeConnectCreatedAt: new Date(),
    });

    return account.id;
};

/**
 * Get onboarding link for tasker
 */
export const getOnboardingLink = async (userId) => {
    let user = await User.findById(userId);

    if (!user.stripeConnectAccountId) {
        await createConnectAccount(userId);
        user = await User.findById(userId);
    }

    // ✅ FIX: Ensure URLs are valid
    const returnUrl = `${FRONTEND_URL}/complete-tasker-profile?stripe_return=complete`;
    const refreshUrl = `${FRONTEND_URL}/complete-tasker-profile?stripe_return=refresh`;

    console.log('Stripe Connect URLs:');
    console.log('  Return URL:', returnUrl);
    console.log('  Refresh URL:', refreshUrl);

    // Validate URLs
    if (!returnUrl.startsWith('http://') && !returnUrl.startsWith('https://')) {
        throw new Error(`Invalid return URL: ${returnUrl}. FRONTEND_URL must start with http:// or https://`);
    }

    const accountLink = await stripe.accountLinks.create({
        account: user.stripeConnectAccountId,
        type: 'account_onboarding',
        return_url: returnUrl,
        refresh_url: refreshUrl,
    });

    return accountLink.url;
};

/**
 * Check Connect account status
 */
export const checkConnectStatus = async (userId) => {
    try {
        const user = await User.findById(userId);

        if (!user) {
            throw new Error('User not found');
        }

        // If no Stripe account yet
        if (!user.stripeConnectAccountId) {
            return {
                status: 'not_connected',
                stripeAccountId: null,
                chargesEnabled: false,
                payoutsEnabled: false,
                detailsSubmitted: false,
                canReceivePayments: false,
            };
        }

        try {
            // Try to get account from Stripe
            const account = await stripe.accounts.retrieve(user.stripeConnectAccountId);

            // Determine status
            let status;
            if (account.charges_enabled && account.payouts_enabled) {
                status = 'active';
            } else if (account.details_submitted) {
                status = 'pending_verification';
            } else {
                status = 'pending';
            }

            return {
                status,
                stripeAccountId: account.id,
                chargesEnabled: account.charges_enabled,
                payoutsEnabled: account.payouts_enabled,
                detailsSubmitted: account.details_submitted,
                canReceivePayments: account.charges_enabled && account.payouts_enabled,
                requirements: {
                    currentlyDue: account.requirements?.currently_due || [],
                    eventuallyDue: account.requirements?.eventually_due || [],
                    pastDue: account.requirements?.past_due || [],
                },
            };
        } catch (stripeError) {
            console.error('Stripe account retrieval error:', stripeError.message);

            // Check if account is invalid or inaccessible
            if (
                stripeError.code === 'account_invalid' ||
                stripeError.type === 'StripePermissionError' ||
                stripeError.message?.includes('does not have access') ||
                stripeError.message?.includes('No such account')
            ) {
                // Clear the invalid account ID from user
                user.stripeConnectAccountId = undefined;
                await user.save();

                console.log(`Cleared invalid Stripe account for user ${userId}`);

                return {
                    status: 'not_connected',
                    stripeAccountId: null,
                    chargesEnabled: false,
                    payoutsEnabled: false,
                    detailsSubmitted: false,
                    canReceivePayments: false,
                    message: 'Previous account was invalid. Please set up a new payment account.',
                };
            }

            // Re-throw other errors
            throw stripeError;
        }
    } catch (error) {
        console.error('checkConnectStatus error:', error);
        throw error;
    }
};


/**
 * Get Stripe Express Dashboard link for tasker
 */
export const getDashboardLink = async (userId) => {
    const user = await User.findById(userId);

    if (!user.stripeConnectAccountId) {
        throw new Error('No Stripe Connect account found');
    }

    const loginLink = await stripe.accounts.createLoginLink(
        user.stripeConnectAccountId
    );

    return loginLink.url;
};

export default {
    calculateFees,
    validateTaskerCanReceivePayments,
    createConnectAccount,
    getOnboardingLink,
    checkConnectStatus,
    getDashboardLink,
};