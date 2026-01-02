// controllers/clientPaymentController.js

import Stripe from 'stripe';
import User from '../models/user.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Create Setup Intent for adding card
export const createSetupIntent = async (req, res) => {
    try {
        const user = req.user;

        // Get or create Stripe customer
        let customerId = user.stripeCustomerId;

        if (!customerId) {
            const customer = await stripe.customers.create({
                email: user.email,
                name: `${user.firstName} ${user.lastName}`,
                metadata: { userId: user._id.toString() }
            });
            customerId = customer.id;

            await User.findByIdAndUpdate(user._id, {
                stripeCustomerId: customerId
            });
        }

        // Create setup intent
        const setupIntent = await stripe.setupIntents.create({
            customer: customerId,
            payment_method_types: ['card'],
        });

        res.json({
            success: true,
            clientSecret: setupIntent.client_secret
        });

    } catch (error) {
        console.error('Setup intent error:', error);
        res.status(500).json({ error: error.message });
    }
};

// Save payment method after Stripe confirms
// controllers/clientPaymentController.js

export const savePaymentMethod = async (req, res) => {
    try {
        const user = req.user;
        const { paymentMethodId } = req.body;

        if (!paymentMethodId) {
            return res.status(400).json({ error: 'Payment method ID required' });
        }

        let customerId = user.stripeCustomerId;

        // Create customer if needed
        if (!customerId) {
            const customer = await stripe.customers.create({
                email: user.email,
                name: `${user.firstName} ${user.lastName}`,
            });
            customerId = customer.id;
        }

        // Attach to customer
        const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
        if (!pm.customer) {
            await stripe.paymentMethods.attach(paymentMethodId, {
                customer: customerId
            });
        }

        // Set as default
        await stripe.customers.update(customerId, {
            invoice_settings: { default_payment_method: paymentMethodId }
        });

        // ⭐ FIX: Use correct field name - defaultPaymentMethodId
        await User.findByIdAndUpdate(user._id, {
            stripeCustomerId: customerId,
            defaultPaymentMethodId: paymentMethodId,  // ✅ Fixed!
        });

        console.log("✅ Payment method saved:", {
            userId: user._id,
            customerId,
            paymentMethodId,
        });

        res.json({
            success: true,
            paymentMethodId,
            brand: pm.card?.brand,
            last4: pm.card?.last4
        });

    } catch (error) {
        console.error('Save payment method error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Get payment methods
export const getPaymentMethods = async (req, res) => {
    try {
        const user = req.user;

        if (!user.stripeCustomerId) {
            return res.json({ paymentMethods: [], hasPaymentMethod: false });
        }

        const methods = await stripe.paymentMethods.list({
            customer: user.stripeCustomerId,
            type: 'card'
        });

        res.json({
            paymentMethods: methods.data.map(m => ({
                id: m.id,
                brand: m.card?.brand,
                last4: m.card?.last4,
                isDefault: m.id === user.defaultPaymentMethodId  // ✅ Fixed!
            })),
            hasPaymentMethod: methods.data.length > 0
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};