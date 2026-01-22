import PlatformSettings from "../models/PlatformSettings.js";
import Task from "../models/task.js";
import Transaction from '../models/Transaction.js';
import User from "../models/user.js";

import stripe from '../utils/stripeConfig.js';
import { calculateFees, validateTaskerCanReceivePayments } from "../utils/stripeConnect.js";
import { createNotification } from "./notificationHelper.js";
import {
    logTask,
    logBid,
    logComment,
    logTaskAcceptance,
    logPayment,
    logActivity,
    logReview , 
    logTaskCompletion,
    logBidAcceptance,

} from "../utils/activityLogger.js";

// taskController.js



// export const createTask = async (req, res) => {
//     try {
//         console.log("createTask called at", new Date().toISOString());
//         console.log("req.body:", JSON.stringify(req.body, null, 2));
//         console.log("req.files:", JSON.stringify(req.files, null, 2));
//         console.log("req.body.estimatedTime:", req.body.estimatedTime);
//         console.log("Type of req.body.estimatedTime:", typeof req.body.estimatedTime);

//         const {
//             serviceId,
//             serviceTitle,
//             taskTitle,
//             taskDescription,
//             estimatedTime,
//             location,
//             schedule,
//             additionalInfo,
//             price,
//             offerDeadline,
//             client,
//         } = req.body;

//         if (!estimatedTime || estimatedTime.trim() === "" || estimatedTime === "undefined") {
//             console.log("Validation failed: estimatedTime is", estimatedTime);
//             return res.status(400).json({
//                 error: "Bad Request",
//                 message: "estimatedTime is required and cannot be empty or undefined",
//             });
//         }

//         console.log("Creating Task with estimatedTime:", estimatedTime);
//         console.log("Type of estimatedTime (destructured):", typeof estimatedTime);

//         const photos = Array.isArray(req.files?.photos)
//             ? req.files.photos.map((file) => file.path)
//             : [];
//         const video = Array.isArray(req.files?.video) && req.files.video.length > 0
//             ? req.files.video[0].path
//             : null;

//         const newTask = new Task({
//             serviceId,
//             serviceTitle,
//             taskTitle,
//             taskDescription,
//             estimatedTime: String(estimatedTime), // Ensure string
//             location,
//             schedule,
//             extraCharge: schedule === "Urgent",
//             additionalInfo,
//             offerDeadline,
//             photos,
//             price,
//             video,
//             client: req.user.id,
//         });

//         console.log("Task object before save:", JSON.stringify(newTask, null, 2));

//         await newTask.save();
//         console.log("Saved task:", JSON.stringify(newTask, null, 2));
//         const dbTask = await Task.findById(newTask._id);
//         console.log("Database task:", JSON.stringify(dbTask, null, 2));

//         res.status(201).json({ message: "Task created successfully", task: newTask });
//     } catch (error) {
//         console.error("❌ Error creating task:", error);
//         if (error.name === "ValidationError") {
//             return res.status(400).json({
//                 error: "Validation Error",
//                 message: "Invalid data provided",
//                 details: error.errors,
//             });
//         }
//         res.status(500).json({
//             error: "Internal server error",
//             message: "Something went wrong",
//             details: error.message,
//         });
//     }
// };
// export const createTask = async (req, res) => {
//     try {
//         console.log("createTask called at", new Date().toISOString());
//         console.log("req.body:", JSON.stringify(req.body, null, 2));
//         console.log("req.files:", JSON.stringify(req.files, null, 2));
//         console.log("req.body.estimatedTime:", req.body.estimatedTime);
//         console.log("Type of req.body.estimatedTime:", typeof req.body.estimatedTime);

//         const {
//             serviceId,
//             serviceTitle,
//             taskTitle,
//             taskDescription,
//             estimatedTime,
//             location,
//             schedule,
//             additionalInfo,
//             price,
//             offerDeadline,
//             client,
//         } = req.body;
//         console.log("Creating Task with estimatedTime:", estimatedTime);
//         console.log("Type of estimatedTime (destructured):", typeof estimatedTime);

//         const photos = Array.isArray(req.files?.photos)
//             ? req.files.photos.map((file) => file.path)
//             : [];
//         const video = Array.isArray(req.files?.video) && req.files.video.length > 0
//             ? req.files.video[0].path
//             : null;

//         const newTask = new Task({
//             serviceId,
//             serviceTitle,
//             taskTitle,
//             taskDescription,
//             estimatedTime: String(estimatedTime), // Ensure string
//             location,
//             schedule,
//             extraCharge: schedule === "Urgent",
//             additionalInfo,
//             offerDeadline,
//             photos,
//             price,
//             video,
//             client: req.user.id,
//         });

//         console.log("Task object before save:", JSON.stringify(newTask, null, 2));

//         await newTask.save();
//         console.log("Saved task:", JSON.stringify(newTask, null, 2));
//         const dbTask = await Task.findById(newTask._id);
//         console.log("Database task:", JSON.stringify(dbTask, null, 2));

//         // Create notification for the client (task poster) - non-blocking
//         try {
//             await createNotification(
//                 req.user.id, // Client ID
//                 "Task Created Successfully",
//                 `Your task "${newTask.taskTitle}" is now live and waiting for tasker bids.`,
//                 "task-posted",
//                 newTask._id // Link to task
//             );
//             console.log("Notification created for new task"); // Debug
//         } catch (notifErr) {
//             console.error("Failed to create notification (non-blocking):", notifErr); // Log but don't crash
//         }

//         res.status(201).json({ message: "Task created successfully", task: newTask });
//     } catch (error) {
//         console.error("❌ Error creating task:", error);
//         if (error.name === "ValidationError") {
//             return res.status(400).json({
//                 error: "Validation Error",
//                 message: "Invalid data provided",
//                 details: error.errors,
//             });
//         }
//         res.status(500).json({
//             error: "Internal server error",
//             message: "Something went wrong",
//             details: error.message,
//         });
//     }
// };


// In taskController.js (Express) or route.ts (Next.js)
export const checkPaymentMethod = async (req, res) => {
    try {
        const userId = req.user.id; // From auth middleware
        const user = await User.findById(userId).select('defaultPaymentMethod');
        res.json({ hasPaymentMethod: !!user?.defaultPaymentMethod });
    } catch (err) {
        res.status(500).json({ error: 'Check failed' });
    }
};

export const createSetupIntent = async (req, res) => {
    try {
        const stripe = (await import('../utils/stripeConfig.js')).default;
        const intent = await stripe.setupIntents.create({
            usage: 'off_session', // For future holds
            customer: req.user.stripeCustomerId || undefined,
        });
        res.json({ clientSecret: intent.client_secret });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

// ------------------------ for bid ----------------------------------
// controllers/stripeController.js (or paymentController.js)

// controllers/paymentController.js or stripeController.js

// export const createSetupIntentForBid = async (req, res) => {
//     try {
//         const { bidAmount, taskId, taskerId } = req.body;
//         const user = req.user; // This is the CLIENT (person accepting the bid)
//         const stripe = (await import('../utils/stripeConfig.js')).default;
//         console.log(req.body)
//         let customer;

//         // If user already has a Stripe customer → use it
//         if (user.stripeCustomerId) {
//             customer = await stripe.customers.retrieve(user.stripeCustomerId);
//         } else {
//             // Create new customer + SAVE TO DB
//             customer = await stripe.customers.create({
//                 email: user.email,
//                 name: `${user.firstName} ${user.lastName}`,
//                 metadata: {
//                     userId: user._id.toString(),
//                     taskId,
//                     taskerId,
//                 },
//             });

//             // THIS IS THE MISSING LINE — SAVE customer ID to user!
//             await User.findByIdAndUpdate(user._id, {
//                 stripeCustomerId: customer.id
//             });
//         }

//         const setupIntent = await stripe.setupIntents.create({
//             customer: customer.id,
//             usage: 'off_session',
//             payment_method_types: ['card'],
//             metadata: {
//                 taskId,
//                 taskerId,
//                 bidAmount: bidAmount.toString(),
//                 type: 'bid_authorization'
//             }
//         });

//         res.json({
//             clientSecret: setupIntent.client_secret,
//             customerId: customer.id
//         });

//     } catch (err) {
//         console.error("createSetupIntentForBid error:", err);
//         res.status(400).json({ error: err.message });
//     }
// };


// // --------------------------------for bid ---------------------------

// // controllers/taskController.js (or paymentController.js)

// export const confirmBidPaymentSetup = async (req, res) => {
//     try {
//         const { paymentMethodId, taskId, taskerId, bidAmount } = req.body;
//         const user = req.user;

//         if (!user.stripeCustomerId) {
//             return res.status(400).json({ error: "Customer not found" });
//         }

//         const stripe = (await import('../utils/stripeConfig.js')).default;

//         // 1. Attach payment method
//         await stripe.paymentMethods.attach(paymentMethodId, {
//             customer: user.stripeCustomerId
//         });

//         // 2. Set as default in Stripe
//         await stripe.customers.update(user.stripeCustomerId, {
//             invoice_settings: { default_payment_method: paymentMethodId },
//         });

//         // 3. SAVE defaultPaymentMethod TO DATABASE ← THIS FIXES EVERYTHING
//         await User.findByIdAndUpdate(user._id, {
//             defaultPaymentMethod: paymentMethodId
//         });

//         // 4. Create hold for exact bid amount
//         const paymentIntent = await stripe.paymentIntents.create({
//             amount: Math.round(bidAmount * 100),
//             currency: 'cad',
//             customer: user.stripeCustomerId,
//             payment_method: paymentMethodId,
//             confirm: true,
//             capture_method: 'manual',
//             automatic_payment_methods: {
//                 enabled: true,
//                 allow_redirects: 'never'
//             },
//             metadata: {
//                 taskId,
//                 taskerId,
//                 type: 'bid_hold'
//             }
//         });

//         res.json({
//             success: true,
//             paymentIntentId: paymentIntent.id,
//             status: paymentIntent.status
//         });

//     } catch (err) {
//         console.error("confirmBidPaymentSetup error:", err);
//         res.status(400).json({ error: err.message });
//     }
// };


export const createSetupIntentForBid = async (req, res) => {
    try {
        const { bidAmount, taskId, taskerId, customerInfo } = req.body;
        const user = req.user; // The CLIENT (person accepting the bid)
        const stripe = (await import('../utils/stripeConfig.js')).default;

        console.log('Creating setup intent for bid:', {
            bidAmount,
            taskId,
            taskerId,
            userId: user._id,
            customerInfo
        });

        let customer;

        // Build customer name and details
        const customerName = customerInfo?.name ||
            `${user.firstName || ''} ${user.lastName || ''}`.trim() ||
            user.name ||
            'Customer';

        const customerEmail = customerInfo?.email || user.email;
        const customerPhone = customerInfo?.phone || user.phone || user.phoneNumber || user.mobileNumber || null;

        // If user already has a Stripe customer → retrieve and update
        if (user.stripeCustomerId) {
            try {
                customer = await stripe.customers.retrieve(user.stripeCustomerId);

                // Update customer with latest info
                if (!customer.deleted) {
                    customer = await stripe.customers.update(user.stripeCustomerId, {
                        name: customerName,
                        email: customerEmail,
                        phone: customerPhone,
                        metadata: {
                            ...customer.metadata,
                            userId: user._id.toString(),
                            lastUpdated: new Date().toISOString()
                        }
                    });
                } else {
                    // Customer was deleted, create new one
                    customer = null;
                }
            } catch (retrieveError) {
                console.log('Customer not found, will create new one:', retrieveError.message);
                customer = null;
            }
        }

        // Create new customer if needed
        if (!customer) {
            customer = await stripe.customers.create({
                email: customerEmail,
                name: customerName,
                phone: customerPhone,
                metadata: {
                    userId: user._id.toString(),
                    platform: 'YourAppName', // Replace with your app name
                    createdAt: new Date().toISOString()
                },
            });

            // Save customer ID to user in database
            await User.findByIdAndUpdate(user._id, {
                stripeCustomerId: customer.id
            });

            console.log('Created new Stripe customer:', customer.id);
        }

        // Fetch task details for better metadata (optional)
        let taskTitle = '';
        try {
            const task = await Task.findById(taskId);
            taskTitle = task?.taskTitle || task?.title || '';
        } catch (e) {
            console.log('Could not fetch task title:', e.message);
        }

        // Fetch tasker details for metadata (optional)
        let taskerName = '';
        try {
            const tasker = await User.findById(taskerId);
            taskerName = tasker ? `${tasker.firstName || ''} ${tasker.lastName || ''}`.trim() : '';
        } catch (e) {
            console.log('Could not fetch tasker name:', e.message);
        }

        // Create SetupIntent with comprehensive metadata
        const setupIntent = await stripe.setupIntents.create({
            customer: customer.id,
            usage: 'off_session',
            payment_method_types: ['card'],
            metadata: {
                // Transaction details
                type: 'bid_authorization',
                bidAmount: bidAmount.toString(),
                currency: 'cad',

                // Task details
                taskId: taskId,
                taskTitle: taskTitle.substring(0, 500), // Stripe has 500 char limit

                // Tasker details
                taskerId: taskerId,
                taskerName: taskerName,

                // Client details
                clientId: user._id.toString(),
                clientName: customerName,
                clientEmail: customerEmail,

                // Timestamps
                createdAt: new Date().toISOString()
            }
        });

        console.log('SetupIntent created:', setupIntent.id);

        res.json({
            clientSecret: setupIntent.client_secret,
            customerId: customer.id,
            setupIntentId: setupIntent.id
        });

    } catch (err) {
        console.error("createSetupIntentForBid error:", err);
        res.status(400).json({ error: err.message });
    }
};

// controllers/paymentController.js

export const capturePaymentOnTaskCompletion = async (req, res) => {
    try {
        const { taskId } = req.params;
        const adminUser = req.user; // Admin or system
        const stripe = (await import('../utils/stripeConfig.js')).default;

        // Find the transaction
        const transaction = await Transaction.findOne({
            taskId: taskId,
            type: 'bid_authorization',
            status: 'authorized'
        });

        if (!transaction) {
            return res.status(404).json({
                error: 'No authorized payment found for this task'
            });
        }

        // Capture the payment
        const paymentIntent = await stripe.paymentIntents.capture(
            transaction.stripePaymentIntentId
        );

        if (paymentIntent.status !== 'succeeded') {
            throw new Error(`Payment capture failed: ${paymentIntent.status}`);
        }

        // Update transaction status
        transaction.status = 'captured';
        transaction.taskerPayout.status = 'pending';
        transaction.taskerPayout.scheduledDate = calculatePayoutDate();
        transaction.statusHistory.push({
            status: 'captured',
            changedAt: new Date(),
            changedBy: adminUser?._id,
            reason: 'Task completed, payment captured'
        });

        await transaction.save();

        // Update task
        await Task.findByIdAndUpdate(taskId, {
            $set: {
                'paymentInfo.status': 'captured',
                'paymentInfo.capturedAt': new Date()
            }
        });

        console.log('Payment captured:', transaction.transactionId);

        res.json({
            success: true,
            transactionId: transaction.transactionId,
            message: 'Payment captured successfully',
            taskerPayoutScheduled: transaction.taskerPayout.scheduledDate
        });

    } catch (err) {
        console.error("capturePaymentOnTaskCompletion error:", err);
        res.status(400).json({ error: err.message });
    }
};

// Helper function to calculate payout date
function calculatePayoutDate() {
    const now = new Date();
    // Add 7 days hold period
    now.setDate(now.getDate() + 7);
    return now;
}



// Also update confirmBidPaymentSetup to include customer info
// export const confirmBidPaymentSetup = async (req, res) => {
//     try {
//         const { paymentMethodId, taskId, taskerId, bidAmount, customerInfo } = req.body;
//         const user = req.user;
//         const stripe = (await import('../utils/stripeConfig.js')).default;

//         console.log('Confirming bid payment setup:', {
//             paymentMethodId,
//             taskId,
//             taskerId,
//             bidAmount,
//             userId: user._id
//         });

//         // Get or verify customer
//         let customerId = user.stripeCustomerId;

//         if (!customerId) {
//             // Create customer if doesn't exist
//             const customerName = customerInfo?.name ||
//                 `${user.firstName || ''} ${user.lastName || ''}`.trim() ||
//                 'Customer';

//             const customer = await stripe.customers.create({
//                 email: customerInfo?.email || user.email,
//                 name: customerName,
//                 phone: customerInfo?.phone || user.phone || null,
//                 metadata: {
//                     userId: user._id.toString()
//                 }
//             });

//             customerId = customer.id;

//             await User.findByIdAndUpdate(user._id, {
//                 stripeCustomerId: customerId
//             });
//         }

//         // Attach payment method to customer if not already attached
//         try {
//             await stripe.paymentMethods.attach(paymentMethodId, {
//                 customer: customerId,
//             });
//         } catch (attachError) {
//             // Payment method might already be attached
//             if (!attachError.message.includes('already been attached')) {
//                 throw attachError;
//             }
//         }

//         // Set as default payment method
//         await stripe.customers.update(customerId, {
//             invoice_settings: {
//                 default_payment_method: paymentMethodId,
//             },
//         });

//         // Create a PaymentIntent with manual capture (authorization hold)
//         const paymentIntent = await stripe.paymentIntents.create({
//             amount: Math.round(bidAmount * 100), // Convert to cents
//             currency: 'cad',
//             customer: customerId,
//             payment_method: paymentMethodId,
//             capture_method: 'manual', // This creates an authorization hold
//             confirm: true,
//             off_session: true,
//             metadata: {
//                 type: 'bid_authorization',
//                 taskId: taskId,
//                 taskerId: taskerId,
//                 clientId: user._id.toString(),
//                 clientName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
//                 clientEmail: user.email,
//                 bidAmount: bidAmount.toString(),
//                 authorizedAt: new Date().toISOString()
//             },
//             description: `Bid authorization for Task ${taskId}`,
//             statement_descriptor_suffix: 'TASKBID', // Shows on card statement
//         });

//         console.log('PaymentIntent created with authorization:', paymentIntent.id);

//         // Save payment info to your database
//         // You might want to save this to the task or a separate payments collection
//         await Task.findByIdAndUpdate(taskId, {
//             $set: {
//                 'paymentInfo.paymentIntentId': paymentIntent.id,
//                 'paymentInfo.paymentMethodId': paymentMethodId,
//                 'paymentInfo.customerId': customerId,
//                 'paymentInfo.amount': bidAmount,
//                 'paymentInfo.status': 'authorized',
//                 'paymentInfo.authorizedAt': new Date()
//             }
//         });

//         res.json({
//             success: true,
//             paymentIntentId: paymentIntent.id,
//             status: paymentIntent.status,
//             message: 'Payment authorized successfully'
//         });

//     } catch (err) {
//         console.error("confirmBidPaymentSetup error:", err);

//         // Handle specific Stripe errors
//         if (err.type === 'StripeCardError') {
//             return res.status(400).json({
//                 error: err.message,
//                 code: err.code
//             });
//         }

//         res.status(400).json({ error: err.message });
//     }
// };

export const confirmBidPaymentSetup = async (req, res) => {
    try {
        const { paymentMethodId, taskId, taskerId, bidAmount, customerInfo } = req.body;
        const user = req.user;
        const stripe = (await import('../utils/stripeConfig.js')).default;

        console.log('Confirming bid payment setup:', {
            paymentMethodId, taskId, taskerId, bidAmount, userId: user._id
        });

        // Get platform settings
        const settings = await PlatformSettings.getSettings();
        const platformFeePercentage = settings.platformFeePercentage;

        // Calculate amounts (in cents)
        const totalAmountCents = Math.round(bidAmount * 100);
        const platformFeeCents = Math.round(totalAmountCents * (platformFeePercentage / 100));
        const taskerEarningsCents = totalAmountCents - platformFeeCents;

        // Get or create customer (your existing code)
        let customerId = user.stripeCustomerId;

        if (!customerId) {
            const customerName = customerInfo?.name ||
                `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Customer';

            const customer = await stripe.customers.create({
                email: customerInfo?.email || user.email,
                name: customerName,
                phone: customerInfo?.phone || user.phone || null,
                metadata: { userId: user._id.toString() }
            });

            customerId = customer.id;
            await User.findByIdAndUpdate(user._id, { stripeCustomerId: customerId });
        }

        // Attach payment method
        try {
            await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
        } catch (attachError) {
            if (!attachError.message.includes('already been attached')) {
                throw attachError;
            }
        }

        await stripe.customers.update(customerId, {
            invoice_settings: { default_payment_method: paymentMethodId }
        });

        // Get task and tasker details
        const task = await Task.findById(taskId);
        const tasker = await User.findById(taskerId);

        // Create PaymentIntent
        const paymentIntent = await stripe.paymentIntents.create({
            amount: totalAmountCents,
            currency: 'cad',
            customer: customerId,
            payment_method: paymentMethodId,
            capture_method: 'manual',
            confirm: true,
            off_session: true,
            metadata: {
                type: 'bid_authorization',
                taskId: taskId,
                taskerId: taskerId,
                clientId: user._id.toString(),
                platformFee: platformFeeCents.toString(),
                taskerEarnings: taskerEarningsCents.toString(),
                platformFeePercentage: platformFeePercentage.toString()
            },
            description: `Task: ${task?.taskTitle || taskId}`,
            statement_descriptor_suffix: 'TASK'
        });

        // Create transaction record
        const transaction = await Transaction.create({
            type: 'bid_authorization',
            taskId: taskId,
            clientId: user._id,
            taskerId: taskerId,
            stripePaymentIntentId: paymentIntent.id,
            stripeCustomerId: customerId,
            amounts: {
                total: totalAmountCents,
                platformFee: platformFeeCents,
                platformFeePercentage: platformFeePercentage,
                taskerEarnings: taskerEarningsCents
            },
            status: 'authorized',
            taskSnapshot: {
                title: task?.taskTitle || '',
                description: task?.taskDescription?.substring(0, 500) || ''
            },
            clientSnapshot: {
                name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
                email: user.email
            },
            taskerSnapshot: {
                name: `${tasker?.firstName || ''} ${tasker?.lastName || ''}`.trim(),
                email: tasker?.email || '',
                stripeConnectAccountId: tasker?.stripeConnectAccountId || ''
            },
            statusHistory: [{
                status: 'authorized',
                changedAt: new Date(),
                reason: 'Payment authorized by client'
            }]
        });

        // Update task with payment info
        await Task.findByIdAndUpdate(taskId, {
            $set: {
                'paymentInfo.transactionId': transaction._id,
                'paymentInfo.paymentIntentId': paymentIntent.id,
                'paymentInfo.paymentMethodId': paymentMethodId,
                'paymentInfo.customerId': customerId,
                'paymentInfo.amount': bidAmount,
                'paymentInfo.platformFee': platformFeeCents / 100,
                'paymentInfo.taskerEarnings': taskerEarningsCents / 100,
                'paymentInfo.status': 'authorized',
                'paymentInfo.authorizedAt': new Date()
            }
        });

        console.log('Transaction created:', transaction.transactionId);

        res.json({
            success: true,
            paymentIntentId: paymentIntent.id,
            transactionId: transaction.transactionId,
            status: paymentIntent.status,
            breakdown: {
                total: bidAmount,
                platformFee: platformFeeCents / 100,
                taskerEarnings: taskerEarningsCents / 100,
                platformFeePercentage: platformFeePercentage
            },
            message: 'Payment authorized successfully'
        });

    } catch (err) {
        console.error("confirmBidPaymentSetup error:", err);

        if (err.type === 'StripeCardError') {
            return res.status(400).json({ error: err.message, code: err.code });
        }

        res.status(400).json({ error: err.message });
    }
};

export const savePaymentMethod = async (req, res) => {
    try {
        const userId = req.user.id;
        const { paymentMethodId } = req.body;
        const stripe = (await import('../utils/stripeConfig.js')).default;

        let customer = req.user.stripeCustomerId
            ? await stripe.customers.retrieve(req.user.stripeCustomerId)
            : await stripe.customers.create({ email: req.user.email });

        await stripe.paymentMethods.attach(paymentMethodId, { customer: customer.id });
        await stripe.customers.update(customer.id, {
            invoice_settings: { default_payment_method: paymentMethodId },
        });

        const user = await User.findByIdAndUpdate(userId, {
            stripeCustomerId: customer.id,
            defaultPaymentMethod: paymentMethodId,
        }, { new: true });

        res.json({ message: 'Saved', hasPaymentMethod: true });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

// export const createSetupIntent = async (req, res) => {
//     try {
//         const stripe = (await import('../utils/stripeConfig.js')).default;
//         const { taskId, taskerId, bidAmount } = req.body;  // ✅ Get bidAmount

//         const intent = await stripe.setupIntents.create({
//             usage: 'off_session',
//             customer: req.user.stripeCustomerId || undefined,
//             metadata: {
//                 taskId,
//                 taskerId,
//                 bidAmount: bidAmount.toString()  // ✅ Store in metadata
//             }
//         });
//         res.json({ clientSecret: intent.client_secret });
//     } catch (err) {
//         res.status(400).json({ error: err.message });
//     }
// };


// export const savePaymentMethod = async (req, res) => {
//     try {
//         const userId = req.user.id;
//         const { paymentMethodId, taskId, taskerId, bidAmount } = req.body;  // ✅ Get bidAmount
//         const stripe = (await import('../utils/stripeConfig.js')).default;

//         let customer = req.user.stripeCustomerId
//             ? await stripe.customers.retrieve(req.user.stripeCustomerId)
//             : await stripe.customers.create({ email: req.user.email });

//         await stripe.paymentMethods.attach(paymentMethodId, { customer: customer.id });
//         await stripe.customers.update(customer.id, {
//             invoice_settings: { default_payment_method: paymentMethodId },
//         });

//         await User.findByIdAndUpdate(userId, {
//             stripeCustomerId: customer.id,
//             defaultPaymentMethod: paymentMethodId,
//         }, { new: true });

//         // ✅ Update task with the accepted BID AMOUNT
//         await Task.findByIdAndUpdate(taskId, {
//             acceptedBidAmount: bidAmount,
//             acceptedTaskerId: taskerId
//         });

//         res.json({ message: 'Saved', hasPaymentMethod: true });
//     } catch (err) {
//         res.status(400).json({ error: err.message });
//     }
// };



// export const createTask = async (req, res) => {
//     try {
//         console.log("createTask called at", new Date().toISOString());
//         console.log("req.body:", JSON.stringify(req.body, null, 2));
//         console.log("req.files:", JSON.stringify(req.files, null, 2));

//         const {
//             serviceId,
//             serviceTitle,
//             taskTitle,
//             taskDescription,
//             estimatedTime,
//             location,
//             schedule,
//             additionalInfo,
//             price,
//             offerDeadline,
//         } = req.body;

//         const budget = parseFloat(price) || 0;
//         const isUrgent = schedule === "Urgent";
//         const urgentFee = isUrgent ? budget * 0.20 : 0;
//         const subtotal = budget + urgentFee;
//         const serviceFee = subtotal * 0.08;
//         const tax = subtotal * 0.13;
//         const totalDollars = subtotal + serviceFee + tax;
//         const totalAmount = Math.round(totalDollars * 100); // Cents for Stripe

//         const photos = Array.isArray(req.files?.photos)
//             ? req.files.photos.map((file) => file.path)
//             : [];
//         const video = Array.isArray(req.files?.video) && req.files.video.length > 0
//             ? req.files.video[0].path
//             : null;

//         const newTask = new Task({
//             serviceId,
//             serviceTitle,
//             taskTitle,
//             taskDescription,
//             estimatedTime: String(estimatedTime),
//             location,
//             schedule,
//             extraCharge: isUrgent,
//             additionalInfo,
//             offerDeadline,
//             photos,
//             price: budget, // Store base price
//             totalAmount, // New: Full amount in cents
//             video,
//             client: req.user.id,
//             stripeStatus: 'pending', // New
//         });

//         console.log("Task object before save:", JSON.stringify(newTask, null, 2));

//         await newTask.save();
//         console.log("Saved task:", JSON.stringify(newTask, null, 2));

//         // Create notification for the client (task poster) - non-blocking
//         try {
//             await createNotification(
//                 req.user.id,
//                 "Task Created Successfully",
//                 `Your task "${newTask.taskTitle}" is now live and waiting for tasker bids. Total: $${totalDollars.toFixed(2)}.`,
//                 "task-posted",
//                 newTask._id
//             );
//             console.log("Notification created for new task");
//         } catch (notifErr) {
//             console.error("Failed to create notification (non-blocking):", notifErr);
//         }

//         res.status(201).json({
//             message: "Task created successfully",
//             task: newTask,
//             totalAmount: totalDollars.toFixed(2) // For frontend display
//         });
//     } catch (error) {
//         console.error("❌ Error creating task:", error);
//         if (error.name === "ValidationError") {
//             return res.status(400).json({
//                 error: "Validation Error",
//                 message: "Invalid data provided",
//                 details: error.errors,
//             });
//         }
//         res.status(500).json({
//             error: "Internal server error",
//             message: "Something went wrong",
//             details: error.message,
//         });
//     }
// };

export const createTask = async (req, res) => {
    try {
        console.log("createTask called at", new Date().toISOString());
        console.log("req.body:", JSON.stringify(req.body, null, 2));
        console.log("req.files:", JSON.stringify(req.files, null, 2));

        const {
            serviceId,
            serviceTitle,
            taskTitle,
            taskDescription,
            estimatedTime,
            location,
            schedule,
            additionalInfo,
            price,
            offerDeadline,
        } = req.body;

        const budget = parseFloat(price) || 0;
        const isUrgent = schedule === "Urgent";
        const urgentFee = isUrgent ? budget * 0.20 : 0;
        const subtotal = budget + urgentFee;
        const serviceFee = subtotal * 0.08;
        const tax = subtotal * 0.13;
        const totalDollars = subtotal + serviceFee + tax;
        const totalAmount = Math.round(totalDollars * 100); // Cents for Stripe

        const photos = Array.isArray(req.files?.photos)
            ? req.files.photos.map((file) => file.path)
            : [];
        const video = Array.isArray(req.files?.video) && req.files.video.length > 0
            ? req.files.video[0].path
            : null;

        const newTask = new Task({
            serviceId,
            serviceTitle,
            taskTitle,
            taskDescription,
            estimatedTime: String(estimatedTime),
            location,
            schedule,
            extraCharge: isUrgent,
            additionalInfo,
            offerDeadline,
            photos,
            price: budget,
            totalAmount,
            video,
            client: req.user.id,
            stripeStatus: 'pending',
        });

        console.log("Task object before save:", JSON.stringify(newTask, null, 2));

        await newTask.save();
        console.log("Saved task:", JSON.stringify(newTask, null, 2));

        // ✅ Log successful task creation
        await logTask({
            action: "TASK_CREATED",
            user: req.user,
            req,
            taskId: newTask._id.toString(),
            taskTitle: newTask.taskTitle,
            status: "success",
            metadata: {
                serviceId,
                serviceTitle,
                location,
                schedule,
                isUrgent,
                basePrice: budget,
                urgentFee,
                serviceFee,
                tax,
                totalAmount: totalDollars,
                photosCount: photos.length,
                hasVideo: !!video,
                estimatedTime,
                offerDeadline,
            },
        });

        // Create notification for the client (task poster) - non-blocking
        try {
            await createNotification(
                req.user.id,
                "Task Created Successfully",
                `Your task "${newTask.taskTitle}" is now live and waiting for tasker bids. Total: $${totalDollars.toFixed(2)}.`,
                "task-posted",
                newTask._id
            );
            console.log("Notification created for new task");
        } catch (notifErr) {
            console.error("Failed to create notification (non-blocking):", notifErr);
        }

        res.status(201).json({
            message: "Task created successfully",
            task: newTask,
            totalAmount: totalDollars.toFixed(2)
        });
    } catch (error) {
        console.error("❌ Error creating task:", error);

        // ✅ Log failed task creation
        await logActivity({
            userId: req.user?.id || req.user?._id || null,
            userEmail: req.user?.email || null,
            userName: req.user ? `${req.user.firstName} ${req.user.lastName}` : null,
            userRole: req.user?.currentRole || "client",
            action: "TASK_CREATED",
            description: `Failed to create task "${req.body?.taskTitle || 'Unknown'}" - ${error.message}`,
            req,
            metadata: {
                taskTitle: req.body?.taskTitle,
                serviceTitle: req.body?.serviceTitle,
                price: req.body?.price,
                errorName: error.name,
                errorMessage: error.message,
                validationErrors: error.errors || null,
            },
            status: "failure",
            module: "task",
            severity: "error",
        });

        if (error.name === "ValidationError") {
            return res.status(400).json({
                error: "Validation Error",
                message: "Invalid data provided",
                details: error.errors,
            });
        }
        res.status(500).json({
            error: "Internal server error",
            message: "Something went wrong",
            details: error.message,
        });
    }
};


// export const addTaskReview = async (req, res) => {
//     try {
//         const { taskId, rating, message } = req.body;
//         const clientId = req.user._id;

//         console.log('Client ID:', clientId, 'Task ID:', taskId); // Debug: Log IDs

//         // Validate input
//         if (!taskId || !rating || !message) {
//             return res.status(400).json({ message: "Task ID, rating, and message are required" });
//         }

//         if (rating < 0 || rating > 5) {
//             return res.status(400).json({ message: "Rating must be between 0 and 5" });
//         }

//         // Find the task
//         const task = await Task.findById(taskId);
//         if (!task) {
//             return res.status(404).json({ message: "Task not found" });
//         }

//         console.log('Task Client ID:', task.client.toString()); // Debug: Log task client ID

//         // Check if the task is completed and the client is authorized
//         if (task.status !== "completed") {
//             return res.status(400).json({ message: "Reviews can only be added for completed tasks" });
//         }
//         if (task.client.toString() !== clientId.toString()) {
//             return res.status(403).json({ message: "You are not authorized to review this task" });
//         }

//         // Find the tasker
//         const tasker = await User.findById(task.acceptedBy);
//         if (!tasker || tasker.currentRole !== "tasker") {
//             return res.status(404).json({ message: "Tasker not found" });
//         }

//         // Check if a review already exists for this task in tasker's reviews
//         const existingReview = tasker.reviews.find(
//             (review) => review.taskId === taskId
//         );
//         if (existingReview) {
//             return res.status(400).json({ message: "A review has already been submitted for this task" });
//         }

//         // Add the review to the tasker's reviews array
//         tasker.reviews.push({
//             reviewer: clientId,
//             rating,
//             message,
//             taskId, // Link review to task
//             createdAt: new Date(),
//         });

//         // Update tasker's rating and review count
//         const totalReviews = tasker.reviews.length;
//         const averageRating =
//             tasker.reviews.reduce((sum, rev) => sum + rev.rating, 0) / totalReviews;

//         tasker.rating = parseFloat(averageRating.toFixed(2));
//         tasker.reviewCount = totalReviews;

//         await tasker.save();

//         // Create notification for the tasker (new review) - non-blocking
//         try {
//             const client = await User.findById(clientId); // Fetch client name
//             await createNotification(
//                 tasker._id, // Tasker ID
//                 "New Review Received",
//                 `You received a ${rating}-star review from ${client.firstName} ${client.lastName} for task "${task.taskTitle}". "${message}"`,
//                 "review",
//                 taskId // Link to task
//             );
//             console.log("Notification created for new review"); // Debug
//         } catch (notifErr) {
//             console.error("Failed to create notification (non-blocking):", notifErr); // Log but don't crash
//         }

//         res.status(201).json({
//             message: "Review added successfully",
//             review: { reviewer: clientId, rating, message, createdAt: new Date() },
//         });
//     } catch (error) {
//         console.error("Error adding task review:", error);
//         res.status(500).json({ message: "Server error" });
//     }
// };




// Enhanced getAllTasks controller with pagination and search

export const addTaskReview = async (req, res) => {
    const { taskId, rating, message } = req.body;
    const clientId = req.user._id || req.user.id;

    try {
        console.log('Client ID:', clientId, 'Task ID:', taskId);

        // Validate input
        if (!taskId || !rating || !message) {
            // ✅ Log failed review - missing fields
            await logReview({
                action: "REVIEW_POSTED",
                user: req.user,
                req,
                taskId,
                status: "failure",
                metadata: {
                    errorMessage: "Task ID, rating, and message are required",
                    providedFields: {
                        hasTaskId: !!taskId,
                        hasRating: !!rating,
                        hasMessage: !!message,
                    },
                },
            });

            return res.status(400).json({ message: "Task ID, rating, and message are required" });
        }

        if (rating < 0 || rating > 5) {
            // ✅ Log failed review - invalid rating
            await logReview({
                action: "REVIEW_POSTED",
                user: req.user,
                req,
                taskId,
                rating,
                status: "failure",
                metadata: {
                    errorMessage: "Rating must be between 0 and 5",
                    providedRating: rating,
                },
            });

            return res.status(400).json({ message: "Rating must be between 0 and 5" });
        }

        // Find the task
        const task = await Task.findById(taskId);
        if (!task) {
            // ✅ Log failed review - task not found
            await logReview({
                action: "REVIEW_POSTED",
                user: req.user,
                req,
                taskId,
                rating,
                status: "failure",
                metadata: {
                    errorMessage: "Task not found",
                },
            });

            return res.status(404).json({ message: "Task not found" });
        }

        console.log('Task Client ID:', task.client.toString());

        // Check if the task is completed
        if (task.status !== "completed") {
            // ✅ Log failed review - task not completed
            await logReview({
                action: "REVIEW_POSTED",
                user: req.user,
                req,
                taskId: task._id.toString(),
                taskTitle: task.taskTitle,
                rating,
                status: "failure",
                metadata: {
                    errorMessage: "Reviews can only be added for completed tasks",
                    currentTaskStatus: task.status,
                },
            });

            return res.status(400).json({ message: "Reviews can only be added for completed tasks" });
        }

        // Check if the client is authorized
        if (task.client.toString() !== clientId.toString()) {
            // ✅ Log failed review - unauthorized
            await logReview({
                action: "REVIEW_POSTED",
                user: req.user,
                req,
                taskId: task._id.toString(),
                taskTitle: task.taskTitle,
                rating,
                status: "failure",
                metadata: {
                    errorMessage: "Unauthorized - not task owner",
                    taskOwnerId: task.client.toString(),
                    attemptedByUserId: clientId.toString(),
                },
            });

            return res.status(403).json({ message: "You are not authorized to review this task" });
        }

        // Find the tasker
        const tasker = await User.findById(task.acceptedBy);
        if (!tasker || tasker.currentRole !== "tasker") {
            // ✅ Log failed review - tasker not found
            await logReview({
                action: "REVIEW_POSTED",
                user: req.user,
                req,
                taskId: task._id.toString(),
                taskTitle: task.taskTitle,
                rating,
                status: "failure",
                metadata: {
                    errorMessage: "Tasker not found",
                    acceptedById: task.acceptedBy?.toString(),
                },
            });

            return res.status(404).json({ message: "Tasker not found" });
        }

        // Check if a review already exists for this task
        const existingReview = tasker.reviews.find(
            (review) => review.taskId === taskId
        );
        if (existingReview) {
            // ✅ Log failed review - already reviewed
            await logReview({
                action: "REVIEW_POSTED",
                user: req.user,
                req,
                taskId: task._id.toString(),
                taskTitle: task.taskTitle,
                rating,
                revieweeId: tasker._id.toString(),
                revieweeName: `${tasker.firstName} ${tasker.lastName}`,
                status: "failure",
                metadata: {
                    errorMessage: "A review has already been submitted for this task",
                    existingReviewDate: existingReview.createdAt,
                    existingRating: existingReview.rating,
                },
            });

            return res.status(400).json({ message: "A review has already been submitted for this task" });
        }

        // Get client details for the log
        const client = await User.findById(clientId).select("firstName lastName email");

        // Add the review to the tasker's reviews array
        const newReview = {
            reviewer: clientId,
            rating,
            message,
            taskId,
            createdAt: new Date(),
        };

        tasker.reviews.push(newReview);

        // Calculate previous rating for logging
        const previousRating = tasker.rating;
        const previousReviewCount = tasker.reviewCount;

        // Update tasker's rating and review count
        const totalReviews = tasker.reviews.length;
        const averageRating =
            tasker.reviews.reduce((sum, rev) => sum + rev.rating, 0) / totalReviews;

        tasker.rating = parseFloat(averageRating.toFixed(2));
        tasker.reviewCount = totalReviews;

        await tasker.save();

        // ✅ Log successful review
        await logReview({
            action: "REVIEW_POSTED",
            user: { ...req.user, ...client?.toObject() },
            req,
            taskId: task._id.toString(),
            taskTitle: task.taskTitle,
            rating,
            revieweeId: tasker._id.toString(),
            revieweeName: `${tasker.firstName} ${tasker.lastName}`,
            status: "success",
            metadata: {
                reviewMessage: message.substring(0, 200),
                messageLength: message.length,
                taskerEmail: tasker.email,
                previousTaskerRating: previousRating,
                newTaskerRating: tasker.rating,
                previousReviewCount: previousReviewCount,
                newReviewCount: tasker.reviewCount,
                taskServiceTitle: task.serviceTitle,
                taskPrice: task.price,
            },
        });

        // Create notification for the tasker (new review) - non-blocking
        try {
            await createNotification(
                tasker._id,
                "New Review Received ⭐",
                `You received a ${rating}-star review from ${client.firstName} ${client.lastName} for task "${task.taskTitle}". "${message.substring(0, 100)}${message.length > 100 ? '...' : ''}"`,
                "review",
                taskId
            );
            console.log("Notification created for new review");
        } catch (notifErr) {
            console.error("Failed to create notification (non-blocking):", notifErr);
        }

        res.status(201).json({
            message: "Review added successfully",
            review: {
                reviewer: clientId,
                rating,
                message,
                createdAt: new Date()
            },
            taskerNewRating: tasker.rating,
            taskerTotalReviews: tasker.reviewCount,
        });
    } catch (error) {
        console.error("Error adding task review:", error);

        // ✅ Log failed review - server error
        await logReview({
            action: "REVIEW_POSTED",
            user: req.user,
            req,
            taskId,
            rating,
            status: "failure",
            metadata: {
                errorMessage: error.message,
                errorName: error.name,
                errorStack: error.stack?.substring(0, 500),
            },
        });

        res.status(500).json({ message: "Server error" });
    }
};




export const getAllTasks = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            search = '',
            status = '',
            priority = '',
            category = '',
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = req.query;

        // Convert page and limit to numbers
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;

        // Build search query
        let searchQuery = {};

        // Text search across multiple fields
        if (search) {
            searchQuery.$or = [
                { title: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
                { type: { $regex: search, $options: 'i' } },
                { category: { $regex: search, $options: 'i' } }
            ];
        }

        // Filter by status
        if (status) {
            searchQuery.status = status;
        }

        // Filter by priority  
        if (priority) {
            searchQuery.priority = priority;
        }

        // Filter by category
        if (category) {
            searchQuery.category = category;
        }

        // Build sort object
        const sortObj = {};
        sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;

        // Execute queries
        const [tasks, totalTasks] = await Promise.all([
            Task.find(searchQuery)
                .populate("client", "fullName email")
                .sort(sortObj)
                .skip(skip)
                .limit(limitNum),
            Task.countDocuments(searchQuery)
        ]);

        // Calculate pagination info
        const totalPages = Math.ceil(totalTasks / limitNum);
        const hasNextPage = pageNum < totalPages;
        const hasPrevPage = pageNum > 1;

        res.status(200).json({
            tasks,
            pagination: {
                currentPage: pageNum,
                totalPages,
                totalTasks,
                hasNextPage,
                hasPrevPage,
                limit: limitNum
            }
        });
    } catch (error) {
        console.error('Error fetching tasks:', error);
        res.status(500).json({ error: "Failed to fetch tasks" });
    }
};


// Get filter options (for dropdowns)
export const getTaskFilters = async (req, res) => {
    try {
        const [statuses, priorities, categories] = await Promise.all([
            Task.distinct('status'),
            Task.distinct('priority'),
            Task.distinct('category')
        ]);

        res.status(200).json({
            statuses,
            priorities,
            categories
        });
    } catch (error) {
        console.error('Error fetching filter options:', error);
        res.status(500).json({ error: "Failed to fetch filter options" });
    }
};

export const getCompletedAndInProgressTasks = async (req, res) => {
    try {
        // Query for tasks with status "in progress" or "completed"
        const tasks = await Task.find({
            status: { $in: ['in progress', 'completed'] }
        })
            .populate("client", "fullName email")
            .limit(8)
            .sort({ createdAt: -1 }); // Optional: sort by newest first

        res.status(200).json({
            tasks
        });
    } catch (error) {
        console.error('Error fetching tasks:', error);
        res.status(500).json({ error: "Failed to fetch tasks" });
    }
};


// ✅ 3. Get Task by ID (with bid privacy logic)
export const getTaskById = async (req, res) => {
    try {
        const task = await Task.findById(req.params.id)
            .populate("client", "firstName lastName email")
            .populate("acceptedBy", "firstName lastName email profilePicture phone")
            .populate("bids.taskerId", "firstName lastName email profilePicture phone")
            .populate("comments.userId", "firstName lastName email profilePicture phone")
            .populate("comments.replies.userId", "firstName lastName email");

        if (!task) return res.status(404).json({ error: "Task not found" });

        const userId = req.user?.id;

        // 🛡️ Privacy for bids
        let filteredBids = [];
        // Convert ObjectId to string safely
        const clientIdStr = task.client?._id?.toString();

        if (clientIdStr === userId) {
            filteredBids = task.bids;
        } else {
            filteredBids = task.bids.filter(
                (bid) => bid.taskerId?._id.toString() === userId
            );
        }

        res.status(200).json({
            ...task.toObject(),
            bids: filteredBids,
        });

    } catch (error) {
        res.status(500).json({
            error: "Failed to fetch task",
            details: error.message,
        });
    }
};


export const getTasksByTaskerIdAndStatus = async (req, res) => {
    try {
        const { id } = req.params; // Tasker ID from route param
        const { status } = req.query; // Status from query param (e.g., ?status=completed)

        // Build the query object - filter by acceptedBy (tasker who accepted the task)
        const query = { acceptedBy: id };

        if (status) {
            query.status = status; // Filter by status if provided
        }

        // Fetch tasks from the database
        const tasks = await Task.find(query)
            .populate('client', 'firstName lastName email'); // Populate client details

        res.status(200).json(tasks);
    } catch (error) {
        console.error('Error fetching tasks:', error);
        res.status(500).json({
            message: 'Server error while fetching tasks',
            error: error.message
        });
    }
};


// Add this to your taskController.js
export const getTaskMessages = async (req, res) => {
    try {
        const { taskId } = req.params;
        const userId = req.user.id;

        const task = await Task.findById(taskId)
            .populate("messages.sender", "firstName lastName profilePicture currentRole")
            .select("messages client acceptedBy status");

        if (!task) {
            return res.status(404).json({ error: "Task not found" });
        }

        // Verify user has access to this task
        const isClient = task.client.toString() === userId;
        const isTasker = task.acceptedBy && task.acceptedBy.toString() === userId;

        if (!isClient && !isTasker) {
            return res.status(403).json({ error: "Not authorized to view messages for this task" });
        }

        // Return messages sorted by creation date (oldest first)
        const sortedMessages = task.messages.sort((a, b) =>
            new Date(a.createdAt) - new Date(b.createdAt)
        );

        res.status(200).json(sortedMessages);
    } catch (error) {
        console.error("Error fetching task messages:", error);
        res.status(500).json({ error: "Failed to fetch messages", details: error.message });
    }
};

// ✅ 4. Get Tasks by User (Client)
export const getTasksByClient = async (req, res) => {
    try {
        console.log(req.user.id)
        const clientId = req.user.id;
        console.log(clientId)
        const tasks = await Task.find({ client: clientId })
            .populate("client", "fullName email")
            .sort({ createdAt: -1 });
        res.status(200).json(tasks);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch user's tasks" });
    }
};

// ✅ 5. Get Urgent Tasks (Optionally by Status)
export const getUrgentTasksByStatus = async (req, res) => {
    try {
        const { status } = req.query;

        const query = { schedule: "Urgent" };
        if (status) {
            query.status = status;
        }

        const urgentTasks = await Task.find(query)
            .populate("client", "firstName lastName email")
            .populate("comments.userId", "firstName lastName email profilePicture")
            .populate("comments.replies.userId", "firstName lastName email profilePicture")
            .sort({ createdAt: -1 });

        res.status(200).json(urgentTasks);
    } catch (error) {
        console.error("❌ Failed to fetch urgent tasks:", error);
        res.status(500).json({ error: "Failed to fetch urgent tasks" });
    }
};


export const getScheduledTasksByStatus = async (req, res) => {
    try {
        const query = {
            schedule: "Schedule",
            status: "pending"
        };

        const scheduleTasks = await Task.find(query)
            .populate("client", "firstName lastName email")
            .populate("comments.userId", "firstName lastName email profilePicture")
            .populate("comments.replies.userId", "firstName lastName email profilePicture")
            .populate("messages.sender", "firstName lastName profilePicture email") // Add this

            .sort({ createdAt: -1 });

        res.status(200).json(scheduleTasks);
    } catch (error) {
        console.error("❌ Failed to fetch pending tasks:", error);
        res.status(500).json({ error: "Failed to fetch pending tasks" });
    }
};

export const getFlexibleTasksByStatus = async (req, res) => {
    try {
        const query = {
            schedule: "Flexible",
            status: "pending"
        };

        const scheduleTasks = await Task.find(query)
            .populate("client", "firstName lastName email")
            .populate("comments.userId", "firstName lastName email profilePicture")
            .populate("comments.replies.userId", "firstName lastName email profilePicture")
            .populate("messages.sender", "firstName lastName profilePicture email") // Add this

            .sort({ createdAt: -1 });

        res.status(200).json(scheduleTasks);
    } catch (error) {
        console.error("❌ Failed to fetch pending tasks:", error);
        res.status(500).json({ error: "Failed to fetch pending tasks" });
    }
};


// ✅ Get Tasks by Status (Flexible for all statuses)
export const getTasksByStatus = async (req, res) => {
    try {
        const { status } = req.query;
        const query = {};

        if (status) {
            query.status = status.toLowerCase();
        }

        const tasks = await Task.find(query)
            .populate("client", "firstName lastName email")
            .populate("acceptedBy", "firstName lastName email")
            .sort({ createdAt: -1 });

        res.status(200).json(tasks);
    } catch (error) {
        console.error("❌ Failed to fetch tasks by status:", error);
        res.status(500).json({ error: "Failed to fetch tasks", details: error.message });
    }
};


export const getTasksExcludingStatus = async (req, res) => {
    try {
        const query = {
            status: "pending",
            schedule: "Schedule"
        };

        const tasks = await Task.find(query)
            .populate("client", "firstName lastName email")
            .sort({ createdAt: -1 });
        res.status(200).json(tasks);
    } catch (error) {
        console.error("❌ Failed to fetch filtered tasks:", error);
        res.status(500).json({ error: "Failed to fetch tasks", details: error.message });
    }
};

export const getScheduledPendingTasks = async (req, res) => {
    try {
        const tasks = await Task.find({
            schedule: "Schedule",    // Only tasks with schedule 'Schedule'
            status: "pending"        // Only tasks with status 'pending'
        })
            .populate("client", "firstName lastName email")
            .sort({ createdAt: -1 });

        res.status(200).json(tasks);
    } catch (error) {
        console.error("❌ Failed to fetch scheduled pending tasks:", error);
        res.status(500).json({ error: "Failed to fetch tasks", details: error.message });
    }
};



export const addMessage = async (req, res) => {
    try {
        const { taskId } = req.params;
        const { message } = req.body;
        const senderId = req.user.id;
        const senderRole = req.user.currentRole || req.user.role;

        if (!message || message.trim() === "") {
            return res.status(400).json({ error: "Message cannot be empty" });
        }

        if (message.trim().length > 5000) {
            return res.status(400).json({ error: "Message too long (max 5000 characters)" });
        }

        const task = await Task.findById(taskId);
        if (!task) {
            return res.status(404).json({ error: "Task not found" });
        }

        const isClient = task.client.toString() === senderId;
        const isTasker = senderRole === "tasker";

        if (!isClient && !isTasker) {
            return res.status(403).json({ error: "You are not authorized to message" });
        }

        const newMessage = {
            sender: senderId,
            senderRole: isClient ? "client" : "tasker",
            message: message.trim(),
            isRead: false,
        };

        task.messages.push(newMessage);
        await task.save();

        const populatedTask = await Task.findById(taskId)
            .populate("client", "firstName lastName profilePicture")
            .populate("acceptedBy", "firstName lastName profilePicture")
            .populate("messages.sender", "firstName lastName profilePicture email");

        const addedMessage = populatedTask.messages[populatedTask.messages.length - 1];

        // FIX: Determine recipient correctly - notify the OTHER person
        try {
            let recipientId;
            if (isClient) {
                // Client sent message, notify tasker (if task has been accepted)
                recipientId = task.acceptedBy;
            } else {
                // Tasker sent message, notify client
                recipientId = task.client;
            }

            if (recipientId) {
                const sender = await User.findById(senderId).select("firstName lastName");
                const senderName = sender ? `${sender.firstName} ${sender.lastName}` : "Someone";

                await createNotification(
                    recipientId,
                    "New Message",
                    `${senderName}: ${message.trim().substring(0, 60)}${message.length > 60 ? "..." : ""}`,
                    "new-message",
                    taskId
                );
                console.log("Message notification created for:", recipientId);
            } else {
                console.log("No recipient found for message notification");
            }
        } catch (notifErr) {
            console.error("Failed to send message notification:", notifErr);
        }

        res.status(201).json({
            message: "Message sent successfully",
            newMessage: addedMessage,
        });
    } catch (error) {
        console.error("Error sending message:", error);
        res.status(500).json({ error: "Failed to send message", details: error.message });
    }
};


export const getMessageStatus = async (req, res) => {
    try {
        const { taskId } = req.params;
        const userId = req.user.id;

        const task = await Task.findById(taskId)
            .populate("messages.sender", "firstName lastName");

        if (!task) {
            return res.status(404).json({ error: "Task not found" });
        }

        const messageStatus = task.messages.map((msg, index) => {
            const senderId = msg.sender?._id?.toString() || msg.sender?.toString();
            return {
                index,
                senderId,
                senderName: msg.sender?.firstName || 'Unknown',
                isFromMe: senderId === userId.toString(),
                isRead: msg.isRead,
                readAt: msg.readAt,
                message: msg.message?.substring(0, 50),
                createdAt: msg.createdAt
            };
        });

        res.json({
            taskId,
            currentUserId: userId,
            totalMessages: task.messages.length,
            messages: messageStatus
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


// Get all tasks where the tasker has placed bids
export const getTasksBiddedByTasker = async (req, res) => {
    try {
        const taskerId = req.user?.id || req.user?._id;

        console.log("=== getTasksBiddedByTasker called ===");
        console.log("Tasker ID:", taskerId);

        if (!taskerId) {
            return res.status(401).json({
                success: false,
                error: "User not authenticated",
                message: "No user ID found in request"
            });
        }

        const { status, bidStatus } = req.query;

        // Build query - MongoDB will handle string to ObjectId conversion
        let query = {
            'bids.taskerId': taskerId
        };

        if (status) {
            query.status = status;
        }

        console.log("Query:", JSON.stringify(query));

        const tasks = await Task.find(query)
            .populate('client', 'firstName lastName profileImage email phone')
            .populate('acceptedBy', 'firstName lastName profileImage')
            .populate('bids.taskerId', 'firstName lastName profileImage')
            .populate('acceptedBid.taskerId', 'firstName lastName profileImage')
            .sort({ createdAt: -1 })
            .lean();

        console.log(`Found ${tasks.length} tasks with bids from tasker`);

        const tasksWithBidInfo = tasks.map(task => {
            // Find this tasker's bid
            const myBid = task.bids?.find(bid => {
                const bidTaskerId = bid.taskerId?._id?.toString() || bid.taskerId?.toString();
                return bidTaskerId === taskerId.toString();
            });

            // Determine bid status
            let myBidStatus = myBid?.status || 'pending';

            if (task.acceptedBy) {
                const acceptedById = task.acceptedBy._id?.toString() || task.acceptedBy.toString();
                if (acceptedById === taskerId.toString()) {
                    myBidStatus = 'accepted';
                } else if (myBidStatus === 'pending') {
                    myBidStatus = 'rejected';
                }
            }

            if (task.acceptedBid?.taskerId) {
                const acceptedBidTaskerId = task.acceptedBid.taskerId._id?.toString() ||
                    task.acceptedBid.taskerId.toString();
                if (acceptedBidTaskerId === taskerId.toString()) {
                    myBidStatus = 'accepted';
                }
            }

            return {
                _id: task._id,
                taskTitle: task.taskTitle,
                taskDescription: task.taskDescription,
                serviceId: task.serviceId,
                serviceTitle: task.serviceTitle,
                location: task.location,
                schedule: task.schedule,
                estimatedTime: task.estimatedTime,
                price: task.price,
                status: task.status,
                photos: task.photos,
                video: task.video,
                client: task.client,
                acceptedBy: task.acceptedBy,
                acceptedBid: task.acceptedBid,
                createdAt: task.createdAt,
                updatedAt: task.updatedAt,
                myBid: myBid || null,
                myBidStatus: myBidStatus,
                totalBids: task.bids?.length || 0,
                payment: myBidStatus === 'accepted' ? task.payment : null
            };
        });

        let filteredTasks = tasksWithBidInfo;
        if (bidStatus && bidStatus !== 'all') {
            filteredTasks = tasksWithBidInfo.filter(
                task => task.myBidStatus === bidStatus
            );
        }

        console.log(`Returning ${filteredTasks.length} filtered tasks`);

        res.status(200).json({
            success: true,
            count: filteredTasks.length,
            tasks: filteredTasks
        });

    } catch (error) {
        console.error("❌ Error in getTasksBiddedByTasker:", error);
        console.error("Error stack:", error.stack);

        res.status(500).json({
            success: false,
            error: "Failed to fetch bidded tasks",
            message: error.message
        });
    }
};

// Get tasker's bid statistics
export const getTaskerBidStats = async (req, res) => {
    try {
        const taskerId = req.user?.id || req.user?._id;

        console.log("=== getTaskerBidStats called ===");
        console.log("Tasker ID:", taskerId);

        if (!taskerId) {
            return res.status(401).json({
                success: false,
                error: "User not authenticated"
            });
        }

        // MongoDB handles string to ObjectId conversion automatically
        const tasks = await Task.find({ 'bids.taskerId': taskerId }).lean();

        let stats = {
            totalBids: 0,
            pendingBids: 0,
            acceptedBids: 0,
            rejectedBids: 0,
            withdrawnBids: 0,
            totalBidAmount: 0,
            averageBidAmount: 0,
            acceptanceRate: 0
        };

        tasks.forEach(task => {
            const myBid = task.bids?.find(
                bid => bid.taskerId?.toString() === taskerId.toString()
            );

            if (myBid) {
                stats.totalBids++;
                stats.totalBidAmount += myBid.offerPrice || 0;

                if (myBid.status === 'withdrawn') {
                    stats.withdrawnBids++;
                } else if (myBid.status === 'accepted' ||
                    (task.acceptedBy && task.acceptedBy.toString() === taskerId.toString()) ||
                    (task.acceptedBid?.taskerId?.toString() === taskerId.toString())) {
                    stats.acceptedBids++;
                } else if (myBid.status === 'rejected' ||
                    (task.acceptedBy && task.acceptedBy.toString() !== taskerId.toString())) {
                    stats.rejectedBids++;
                } else {
                    stats.pendingBids++;
                }
            }
        });

        if (stats.totalBids > 0) {
            stats.averageBidAmount = Math.round(stats.totalBidAmount / stats.totalBids);
            const decidedBids = stats.acceptedBids + stats.rejectedBids;
            if (decidedBids > 0) {
                stats.acceptanceRate = Math.round((stats.acceptedBids / decidedBids) * 100);
            }
        }

        console.log("Stats calculated:", stats);

        res.status(200).json({
            success: true,
            stats
        });

    } catch (error) {
        console.error("❌ Error in getTaskerBidStats:", error);
        res.status(500).json({
            success: false,
            error: "Failed to fetch bid statistics",
            message: error.message
        });
    }
};



// export const addBidToTask = async (req, res) => {
//     try {
//         const { id: taskId } = req.params;
//         const { offerPrice, message } = req.body;

//         const newBid = {
//             taskerId: req.user.id,
//             offerPrice,
//             message,
//             createdAt: new Date(),
//         };

//         const updatedTask = await Task.findByIdAndUpdate(
//             taskId,
//             { $push: { bids: newBid } },
//             { new: true }
//         );

//         if (!updatedTask) {
//             return res.status(404).json({ error: "Task not found" });
//         }

//         // Create notification for the client (new bid received) - non-blocking
//         try {
//             // FIX: Get tasker details from database to ensure we have the name
//             const tasker = await User.findById(req.user.id).select("firstName lastName");

//             if (!tasker) {
//                 console.error("Tasker not found for notification");
//             }

//             const taskerName = tasker
//                 ? `${tasker.firstName} ${tasker.lastName}`
//                 : "A tasker";

//             // Debug: Log notification details
//             console.log("Creating bid notification:", {
//                 clientId: updatedTask.client,
//                 taskerName,
//                 offerPrice,
//                 taskTitle: updatedTask.taskTitle
//             });

//             await createNotification(
//                 updatedTask.client, // Client ID (task owner)
//                 "New Bid Received",
//                 `${taskerName} placed a bid of $${offerPrice} for "${updatedTask.taskTitle}". Check details.`,
//                 "new-bid",
//                 updatedTask._id // Link to task
//             );
//             console.log("✅ Notification created for new bid");
//         } catch (notifErr) {
//             console.error("❌ Failed to create notification (non-blocking):", notifErr);
//         }

//         // Optional: Also notify the tasker that their bid was submitted successfully
//         try {
//             await createNotification(
//                 req.user.id, // Tasker ID
//                 "Bid Submitted",
//                 `Your bid of $${offerPrice} for "${updatedTask.taskTitle}" has been submitted successfully.`,
//                 "bid-submitted",
//                 updatedTask._id
//             );
//             console.log("✅ Confirmation notification sent to tasker");
//         } catch (notifErr) {
//             console.error("❌ Failed to create tasker confirmation notification:", notifErr);
//         }

//         res.status(200).json({ message: "Bid added successfully", task: updatedTask });
//     } catch (error) {
//         console.error("Error adding bid:", error);
//         res.status(500).json({ error: "Failed to add bid", details: error.message });
//     }
// };



// export const addCommentToTask = async (req, res) => {
//     try {
//         const taskId = req.params.id;
//         const userId = req.user._id;
//         const { message } = req.body;

//         if (!message || message.trim() === "") {
//             return res.status(400).json({ error: "Comment message cannot be empty" });
//         }

//         const userRole = req.user.currentRole;

//         if (!["tasker", "client"].includes(userRole)) {
//             return res.status(400).json({ error: "Invalid user role" });
//         }

//         const user = await User.findById(userId).select("firstName lastName email profilePicture");
//         if (!user) {
//             return res.status(404).json({ error: "User not found" });
//         }

//         const newComment = {
//             userId: userId,
//             role: userRole,
//             firstName: user.firstName,
//             lastName: user.lastName,
//             email: user.email,
//             profilePicture: user.profilePicture || null,
//             message: message.trim(),
//             createdAt: new Date(),
//             replies: [],
//         };

//         const updatedTask = await Task.findByIdAndUpdate(
//             taskId,
//             { $push: { comments: newComment } },
//             { new: true, runValidators: false }
//         );

//         if (!updatedTask) {
//             return res.status(404).json({ error: "Task not found" });
//         }

//         // FIX: Notify the appropriate person based on who commented
//         try {
//             const commenterName = `${user.firstName} ${user.lastName}`;
//             const notificationMessage = `"${commenterName}" commented on "${updatedTask.taskTitle}": "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`;

//             // If tasker commented, notify client
//             if (userRole === "tasker") {
//                 await createNotification(
//                     updatedTask.client,
//                     "New Comment on Your Task",
//                     notificationMessage,
//                     "new-comment",
//                     updatedTask._id
//                 );
//                 console.log("Notification sent to client for new comment");
//             }
//             // If client commented, notify tasker (if one is assigned)
//             else if (userRole === "client" && updatedTask.acceptedBy) {
//                 await createNotification(
//                     updatedTask.acceptedBy,
//                     "New Comment on Task",
//                     notificationMessage,
//                     "new-comment",
//                     updatedTask._id
//                 );
//                 console.log("Notification sent to tasker for new comment");
//             }
//             // Also notify if client comments on their own task (for other bidders visibility)
//             // You might want to notify all bidders here
//         } catch (notifErr) {
//             console.error("Failed to create notification (non-blocking):", notifErr);
//         }

//         res.status(201).json({
//             message: "Comment added successfully",
//             task: updatedTask,
//         });
//     } catch (error) {
//         console.error("Error adding comment:", error);
//         res.status(500).json({ error: "Failed to add comment", details: error.message });
//     }
// };



// export const acceptTaskByTasker = async (req, res) => {
//     try {
//         const { id: taskId } = req.params;

//         const task = await Task.findById(taskId).populate('client');
//         if (!task) return res.status(404).json({ error: "Task not found" });

//         if (task.status !== "pending") {
//             return res.status(400).json({ error: "Task already accepted or completed" });
//         }

//         const client = task.client;
//         if (!client.stripeCustomerId || !client.defaultPaymentMethod) {
//             return res.status(400).json({ message: 'Client has no saved payment method. Please ask them to add one.' });
//         }

//         // Authorize (hold) funds
//         const paymentIntent = await stripe.paymentIntents.create({
//             amount: task.totalAmount,
//             currency: 'cad',
//             customer: client.stripeCustomerId,
//             payment_method: client.defaultPaymentMethod,
//             confirmation_method: 'manual',
//             confirm: true,
//             capture_method: 'manual',
//             description: `Authorization for Task ${task._id}`,
//             metadata: { taskId: task._id.toString() },
//         });

//         if (paymentIntent.status !== 'requires_capture') {
//             return res.status(400).json({
//                 message: 'Payment authorization failed',
//                 error: paymentIntent.last_payment_error?.message
//             });
//         }

//         task.acceptedBy = req.user.id;
//         task.status = "in progress";
//         task.paymentIntentId = paymentIntent.id;
//         task.stripeStatus = 'authorized';
//         await task.save();

//         // FIX: Get tasker details from database
//         const tasker = await User.findById(req.user.id).select("firstName lastName");

//         if (!tasker) {
//             console.error("Tasker not found for notification");
//         }

//         const taskerName = tasker
//             ? `${tasker.firstName} ${tasker.lastName}`
//             : "A tasker";

//         const paymentAmount = task.totalAmount ? (task.totalAmount / 100).toFixed(2) : '0.00';

//         // Get client ID safely (since client is populated)
//         const clientId = task.client._id || task.client;

//         // Create notification for the client (task accepted)
//         try {
//             // Debug: Log notification details
//             console.log("Creating task accepted notification:", {
//                 clientId,
//                 taskerName,
//                 taskTitle: task.taskTitle,
//                 paymentAmount
//             });

//             await createNotification(
//                 clientId, // Client ID (task owner)
//                 "Task Accepted! 🎉",
//                 `${taskerName} has accepted your task "${task.taskTitle}". A hold of $${paymentAmount} has been placed on your payment method. Work will begin soon!`,
//                 "task-accepted",
//                 task._id
//             );
//             console.log("✅ Notification created for client - task accepted");

//         } catch (notifErr) {
//             console.error("❌ Failed to create client notification (non-blocking):", notifErr);
//         }

//         // Send confirmation notification to tasker
//         try {
//             await createNotification(
//                 req.user.id, // Tasker ID
//                 "Task Accepted Successfully",
//                 `You have accepted the task "${task.taskTitle}". A payment of $${paymentAmount} has been authorized. You can now start working on this task!`,
//                 "task-accept-confirmed",
//                 task._id
//             );
//             console.log("✅ Confirmation notification sent to tasker");

//         } catch (notifErr) {
//             console.error("❌ Failed to create tasker confirmation notification:", notifErr);
//         }

//         // Optional: Notify other bidders that task has been assigned
//         try {
//             if (task.bids && task.bids.length > 0) {
//                 // Get unique tasker IDs from bids (excluding the one who accepted)
//                 const otherBidderIds = [...new Set(
//                     task.bids
//                         .map(bid => bid.taskerId.toString())
//                         .filter(id => id !== req.user.id)
//                 )];

//                 console.log("Notifying other bidders about task assignment:", otherBidderIds);

//                 for (const bidderId of otherBidderIds) {
//                     await createNotification(
//                         bidderId,
//                         "Task Assigned to Another Tasker",
//                         `The task "${task.taskTitle}" has been assigned to another tasker. Keep an eye out for other opportunities!`,
//                         "task-assigned-other",
//                         task._id
//                     );
//                 }
//                 console.log(`✅ Notified ${otherBidderIds.length} other bidders`);
//             }
//         } catch (notifErr) {
//             console.error("❌ Failed to notify other bidders (non-blocking):", notifErr);
//         }

//         res.status(200).json({ message: "Task accepted successfully", task });
//     } catch (error) {
//         console.error("Error accepting task:", error);
//         res.status(500).json({ error: "Failed to accept task", details: error.message });
//     }
// };


export const addBidToTask = async (req, res) => {
    const { id: taskId } = req.params;
    const { offerPrice, message } = req.body;

    try {
        const newBid = {
            taskerId: req.user.id,
            offerPrice,
            message,
            createdAt: new Date(),
        };

        const updatedTask = await Task.findByIdAndUpdate(
            taskId,
            { $push: { bids: newBid } },
            { new: true }
        );

        if (!updatedTask) {
            // ✅ Log failed bid - task not found
            await logBid({
                action: "BID_PLACED",
                user: req.user,
                req,
                taskId,
                offerPrice,
                status: "failure",
                metadata: {
                    errorMessage: "Task not found",
                    bidMessage: message?.substring(0, 100),
                },
            });

            return res.status(404).json({ error: "Task not found" });
        }

        // Get tasker details for notification
        const tasker = await User.findById(req.user.id).select("firstName lastName email");
        const taskerName = tasker ? `${tasker.firstName} ${tasker.lastName}` : "A tasker";

        // ✅ Log successful bid placement
        await logBid({
            action: "BID_PLACED",
            user: { ...req.user, ...tasker?.toObject() },
            req,
            taskId: updatedTask._id.toString(),
            taskTitle: updatedTask.taskTitle,
            offerPrice,
            status: "success",
            metadata: {
                bidMessage: message?.substring(0, 200),
                totalBidsOnTask: updatedTask.bids.length,
                taskOwnerId: updatedTask.client.toString(),
                taskStatus: updatedTask.status,
                serviceTitle: updatedTask.serviceTitle,
            },
        });

        // Create notification for the client (new bid received) - non-blocking
        try {
            console.log("Creating bid notification:", {
                clientId: updatedTask.client,
                taskerName,
                offerPrice,
                taskTitle: updatedTask.taskTitle
            });

            await createNotification(
                updatedTask.client,
                "New Bid Received",
                `${taskerName} placed a bid of $${offerPrice} for "${updatedTask.taskTitle}". Check details.`,
                "new-bid",
                updatedTask._id
            );
            console.log("✅ Notification created for new bid");
        } catch (notifErr) {
            console.error("❌ Failed to create notification (non-blocking):", notifErr);
        }

        // Notify tasker that their bid was submitted
        try {
            await createNotification(
                req.user.id,
                "Bid Submitted",
                `Your bid of $${offerPrice} for "${updatedTask.taskTitle}" has been submitted successfully.`,
                "bid-submitted",
                updatedTask._id
            );
            console.log("✅ Confirmation notification sent to tasker");
        } catch (notifErr) {
            console.error("❌ Failed to create tasker confirmation notification:", notifErr);
        }

        res.status(200).json({ message: "Bid added successfully", task: updatedTask });
    } catch (error) {
        console.error("Error adding bid:", error);

        // ✅ Log failed bid - server error
        await logBid({
            action: "BID_PLACED",
            user: req.user,
            req,
            taskId,
            offerPrice,
            status: "failure",
            metadata: {
                errorMessage: error.message,
                errorName: error.name,
                bidMessage: message?.substring(0, 100),
            },
        });

        res.status(500).json({ error: "Failed to add bid", details: error.message });
    }
};

// ============================================
// ADD COMMENT TO TASK
// ============================================
export const addCommentToTask = async (req, res) => {
    const taskId = req.params.id;
    const userId = req.user._id || req.user.id;
    const { message } = req.body;

    try {
        if (!message || message.trim() === "") {
            // ✅ Log failed comment - empty message
            await logComment({
                action: "COMMENT_ADDED",
                user: req.user,
                req,
                taskId,
                status: "failure",
                metadata: {
                    errorMessage: "Comment message cannot be empty",
                },
            });

            return res.status(400).json({ error: "Comment message cannot be empty" });
        }

        const userRole = req.user.currentRole;

        if (!["tasker", "client"].includes(userRole)) {
            // ✅ Log failed comment - invalid role
            await logComment({
                action: "COMMENT_ADDED",
                user: req.user,
                req,
                taskId,
                status: "failure",
                metadata: {
                    errorMessage: "Invalid user role",
                    attemptedRole: userRole,
                },
            });

            return res.status(400).json({ error: "Invalid user role" });
        }

        const user = await User.findById(userId).select("firstName lastName email profilePicture");
        if (!user) {
            await logComment({
                action: "COMMENT_ADDED",
                user: req.user,
                req,
                taskId,
                status: "failure",
                metadata: { errorMessage: "User not found" },
            });

            return res.status(404).json({ error: "User not found" });
        }

        const newComment = {
            userId: userId,
            role: userRole,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            profilePicture: user.profilePicture || null,
            message: message.trim(),
            createdAt: new Date(),
            replies: [],
        };

        const updatedTask = await Task.findByIdAndUpdate(
            taskId,
            { $push: { comments: newComment } },
            { new: true, runValidators: false }
        );

        if (!updatedTask) {
            // ✅ Log failed comment - task not found
            await logComment({
                action: "COMMENT_ADDED",
                user: { ...req.user, ...user.toObject() },
                req,
                taskId,
                commentPreview: message,
                status: "failure",
                metadata: { errorMessage: "Task not found" },
            });

            return res.status(404).json({ error: "Task not found" });
        }

        // ✅ Log successful comment
        await logComment({
            action: "COMMENT_ADDED",
            user: { ...req.user, ...user.toObject() },
            req,
            taskId: updatedTask._id.toString(),
            taskTitle: updatedTask.taskTitle,
            commentPreview: message,
            status: "success",
            metadata: {
                commentLength: message.length,
                totalCommentsOnTask: updatedTask.comments.length,
                commenterRole: userRole,
                taskOwnerId: updatedTask.client.toString(),
                hasAcceptedTasker: !!updatedTask.acceptedBy,
            },
        });

        // Notifications
        try {
            const commenterName = `${user.firstName} ${user.lastName}`;
            const notificationMessage = `"${commenterName}" commented on "${updatedTask.taskTitle}": "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`;

            if (userRole === "tasker") {
                await createNotification(
                    updatedTask.client,
                    "New Comment on Your Task",
                    notificationMessage,
                    "new-comment",
                    updatedTask._id
                );
                console.log("Notification sent to client for new comment");
            } else if (userRole === "client" && updatedTask.acceptedBy) {
                await createNotification(
                    updatedTask.acceptedBy,
                    "New Comment on Task",
                    notificationMessage,
                    "new-comment",
                    updatedTask._id
                );
                console.log("Notification sent to tasker for new comment");
            }
        } catch (notifErr) {
            console.error("Failed to create notification (non-blocking):", notifErr);
        }

        res.status(201).json({
            message: "Comment added successfully",
            task: updatedTask,
        });
    } catch (error) {
        console.error("Error adding comment:", error);

        // ✅ Log failed comment - server error
        await logComment({
            action: "COMMENT_ADDED",
            user: req.user,
            req,
            taskId,
            commentPreview: message,
            status: "failure",
            metadata: {
                errorMessage: error.message,
                errorName: error.name,
            },
        });

        res.status(500).json({ error: "Failed to add comment", details: error.message });
    }
};

// ============================================
// ACCEPT TASK BY TASKER
// ============================================
export const acceptTaskByTasker = async (req, res) => {
    const { id: taskId } = req.params;

    try {
        const task = await Task.findById(taskId).populate('client');
        if (!task) {
            // ✅ Log failed acceptance - task not found
            await logTaskAcceptance({
                action: "TASK_ACCEPTED",
                user: req.user,
                req,
                taskId,
                status: "failure",
                metadata: { errorMessage: "Task not found" },
            });

            return res.status(404).json({ error: "Task not found" });
        }

        if (task.status !== "pending") {
            // ✅ Log failed acceptance - invalid status
            await logTaskAcceptance({
                action: "TASK_ACCEPTED",
                user: req.user,
                req,
                taskId,
                taskTitle: task.taskTitle,
                status: "failure",
                metadata: {
                    errorMessage: "Task already accepted or completed",
                    currentStatus: task.status,
                },
            });

            return res.status(400).json({ error: "Task already accepted or completed" });
        }

        const client = task.client;
        if (!client.stripeCustomerId || !client.defaultPaymentMethod) {
            // ✅ Log failed acceptance - no payment method
            await logTaskAcceptance({
                action: "TASK_ACCEPTED",
                user: req.user,
                req,
                taskId,
                taskTitle: task.taskTitle,
                clientId: client._id.toString(),
                status: "failure",
                metadata: {
                    errorMessage: "Client has no saved payment method",
                    clientEmail: client.email,
                },
            });

            return res.status(400).json({
                message: 'Client has no saved payment method. Please ask them to add one.'
            });
        }

        // Authorize (hold) funds
        let paymentIntent;
        try {
            paymentIntent = await stripe.paymentIntents.create({
                amount: task.totalAmount,
                currency: 'cad',
                customer: client.stripeCustomerId,
                payment_method: client.defaultPaymentMethod,
                confirmation_method: 'manual',
                confirm: true,
                capture_method: 'manual',
                description: `Authorization for Task ${task._id}`,
                metadata: { taskId: task._id.toString() },
            });

            // ✅ Log payment authorization
            await logPayment({
                action: "PAYMENT_AUTHORIZED",
                user: client,
                req,
                taskId: task._id.toString(),
                taskTitle: task.taskTitle,
                amount: task.totalAmount,
                paymentIntentId: paymentIntent.id,
                status: "success",
                metadata: {
                    taskerId: req.user.id,
                    stripeCustomerId: client.stripeCustomerId,
                    paymentStatus: paymentIntent.status,
                },
            });

        } catch (stripeError) {
            // ✅ Log payment authorization failure
            await logPayment({
                action: "PAYMENT_AUTHORIZED",
                user: client,
                req,
                taskId: task._id.toString(),
                taskTitle: task.taskTitle,
                amount: task.totalAmount,
                status: "failure",
                metadata: {
                    errorMessage: stripeError.message,
                    stripeErrorCode: stripeError.code,
                    taskerId: req.user.id,
                },
            });

            // Also log task acceptance failure due to payment
            await logTaskAcceptance({
                action: "TASK_ACCEPTED",
                user: req.user,
                req,
                taskId: task._id.toString(),
                taskTitle: task.taskTitle,
                amount: task.totalAmount,
                status: "failure",
                metadata: {
                    errorMessage: "Payment authorization failed",
                    stripeError: stripeError.message,
                },
            });

            return res.status(400).json({
                message: 'Payment authorization failed',
                error: stripeError.message
            });
        }

        if (paymentIntent.status !== 'requires_capture') {
            // ✅ Log failed payment status
            await logPayment({
                action: "PAYMENT_AUTHORIZED",
                user: client,
                req,
                taskId: task._id.toString(),
                taskTitle: task.taskTitle,
                amount: task.totalAmount,
                paymentIntentId: paymentIntent.id,
                status: "failure",
                metadata: {
                    errorMessage: "Payment authorization did not result in requires_capture status",
                    actualStatus: paymentIntent.status,
                    lastPaymentError: paymentIntent.last_payment_error?.message,
                },
            });

            return res.status(400).json({
                message: 'Payment authorization failed',
                error: paymentIntent.last_payment_error?.message
            });
        }

        // Update task
        task.acceptedBy = req.user.id;
        task.status = "in progress";
        task.paymentIntentId = paymentIntent.id;
        task.stripeStatus = 'authorized';
        task.acceptedAt = new Date();
        await task.save();

        // Get tasker details
        const tasker = await User.findById(req.user.id).select("firstName lastName email");
        const taskerName = tasker ? `${tasker.firstName} ${tasker.lastName}` : "A tasker";
        const paymentAmount = task.totalAmount ? (task.totalAmount / 100).toFixed(2) : '0.00';
        const clientId = task.client._id || task.client;

        // ✅ Log successful task acceptance
        await logTaskAcceptance({
            action: "TASK_ACCEPTED",
            user: { ...req.user, ...tasker?.toObject() },
            req,
            taskId: task._id.toString(),
            taskTitle: task.taskTitle,
            clientId: clientId.toString(),
            amount: task.totalAmount,
            status: "success",
            metadata: {
                paymentIntentId: paymentIntent.id,
                paymentAmountFormatted: `$${paymentAmount}`,
                previousStatus: "pending",
                newStatus: "in progress",
                clientEmail: client.email,
                taskerEmail: tasker?.email,
                totalBidsOnTask: task.bids?.length || 0,
                serviceTitle: task.serviceTitle,
            },
        });

        // Notifications
        try {
            console.log("Creating task accepted notification:", {
                clientId,
                taskerName,
                taskTitle: task.taskTitle,
                paymentAmount
            });

            await createNotification(
                clientId,
                "Task Accepted! 🎉",
                `${taskerName} has accepted your task "${task.taskTitle}". A hold of $${paymentAmount} has been placed on your payment method. Work will begin soon!`,
                "task-accepted",
                task._id
            );
            console.log("✅ Notification created for client - task accepted");
        } catch (notifErr) {
            console.error("❌ Failed to create client notification (non-blocking):", notifErr);
        }

        // Tasker confirmation notification
        try {
            await createNotification(
                req.user.id,
                "Task Accepted Successfully",
                `You have accepted the task "${task.taskTitle}". A payment of $${paymentAmount} has been authorized. You can now start working on this task!`,
                "task-accept-confirmed",
                task._id
            );
            console.log("✅ Confirmation notification sent to tasker");
        } catch (notifErr) {
            console.error("❌ Failed to create tasker confirmation notification:", notifErr);
        }

        // Notify other bidders
        try {
            if (task.bids && task.bids.length > 0) {
                const otherBidderIds = [...new Set(
                    task.bids
                        .map(bid => bid.taskerId.toString())
                        .filter(id => id !== req.user.id)
                )];

                console.log("Notifying other bidders about task assignment:", otherBidderIds);

                for (const bidderId of otherBidderIds) {
                    await createNotification(
                        bidderId,
                        "Task Assigned to Another Tasker",
                        `The task "${task.taskTitle}" has been assigned to another tasker. Keep an eye out for other opportunities!`,
                        "task-assigned-other",
                        task._id
                    );
                }
                console.log(`✅ Notified ${otherBidderIds.length} other bidders`);
            }
        } catch (notifErr) {
            console.error("❌ Failed to notify other bidders (non-blocking):", notifErr);
        }

        res.status(200).json({ message: "Task accepted successfully", task });
    } catch (error) {
        console.error("Error accepting task:", error);

        // ✅ Log failed task acceptance - server error
        await logTaskAcceptance({
            action: "TASK_ACCEPTED",
            user: req.user,
            req,
            taskId,
            status: "failure",
            metadata: {
                errorMessage: error.message,
                errorName: error.name,
                errorStack: error.stack?.substring(0, 500),
            },
        });

        res.status(500).json({ error: "Failed to accept task", details: error.message });
    }
};

export const createPaymentIntent = async (req, res) => {
    try {
        const { amount, taskId, taskerId, description } = req.body;
        const userId = req.user.id;

        // Validate required fields
        if (!amount || !taskId || !taskerId) {
            return res.status(400).json({
                error: "Amount, taskId, and taskerId are required"
            });
        }

        // Verify the task exists and user is authorized
        const task = await Task.findById(taskId);
        if (!task) {
            return res.status(404).json({ error: "Task not found" });
        }

        // Check if user is the client who owns the task
        if (task.client.toString() !== userId) {
            return res.status(403).json({
                error: "You are not authorized to create payment for this task"
            });
        }

        // Check if user has payment method set up
        const user = await User.findById(userId);
        if (!user.stripeCustomerId || !user.defaultPaymentMethod) {
            return res.status(400).json({
                error: "No payment method found. Please add a payment method first."
            });
        }

        // Create payment intent with manual capture (to hold funds)
        const paymentIntent = await stripe.paymentIntents.create({
            amount: amount, // Amount in cents
            currency: 'cad',
            customer: user.stripeCustomerId,
            payment_method: user.defaultPaymentMethod,
            capture_method: 'manual', // This holds funds until captured
            description: description || `Payment hold for task: ${taskId}`,
            metadata: {
                taskId: taskId,
                taskerId: taskerId,
                clientId: userId
            },
            // Optional: Setup future usage for off-session payments
            setup_future_usage: 'off_session',

        });

        res.status(200).json({
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id,
            amount: paymentIntent.amount,
            status: paymentIntent.status
        });

    } catch (error) {
        console.error("Error creating payment intent:", error);
        res.status(500).json({
            error: "Failed to create payment intent",
            details: error.message
        });
    }
};







// ==================== FEE CONSTANTS ====================
// CLIENT SIDE
const CLIENT_PLATFORM_FEE_PERCENT = 0.10;  // 10%
const RESERVATION_FEE_CENTS = 500;          // $5 flat fee
const CLIENT_TAX_PERCENT = 0.13;            // 13% HST on task price

// TASKER SIDE
const TASKER_PLATFORM_FEE_PERCENT = 0.12;  // 12%
const TASKER_TAX_PERCENT = 0.13;            // 13% tax deducted

//     let paymentIntent = null;

//     try {
//         const { id: taskId } = req.params;
//         const { taskerId, paymentMethodId: providedPaymentMethodId } = req.body;

//         console.log("📥 Accept bid request:", req.body);

//         // ==================== VALIDATION PHASE ====================
//         const task = await Task.findById(taskId).populate('client');
//         if (!task) {
//             return res.status(404).json({ error: "Task not found" });
//         }

//         if (task.client._id.toString() !== req.user.id) {
//             return res.status(403).json({ error: "You are not authorized" });
//         }

//         if (task.status !== "pending") {
//             return res.status(400).json({ error: "Task already accepted or completed" });
//         }

//         const acceptedBid = task.bids.find(bid => bid.taskerId.toString() === taskerId);
//         if (!acceptedBid) {
//             return res.status(404).json({ error: "Bid not found for this tasker" });
//         }

//         // Validate tasker can receive payments
//         let taskerStripeAccountId;
//         try {
//             taskerStripeAccountId = await validateTaskerCanReceivePayments(taskerId);
//         } catch (connectError) {
//             return res.status(400).json({
//                 error: connectError.message,
//                 code: 'TASKER_PAYMENT_NOT_SETUP',
//             });
//         }

//         // Get client and validate payment method
//         let client = await User.findById(task.client._id);
//         let paymentMethodId = providedPaymentMethodId || client.defaultPaymentMethodId;

//         if (!paymentMethodId) {
//             return res.status(400).json({
//                 message: 'No payment method provided.',
//                 code: 'NO_PAYMENT_METHOD'
//             });
//         }

//         // Verify payment method exists and get customer
//         let customerId = client.stripeCustomerId;

//         try {
//             const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);

//             if (!paymentMethod.customer) {
//                 if (!customerId) {
//                     const customer = await stripe.customers.create({
//                         email: client.email,
//                         name: `${client.firstName} ${client.lastName}`,
//                         metadata: { userId: client._id.toString() }
//                     });
//                     customerId = customer.id;
//                 }

//                 await stripe.paymentMethods.attach(paymentMethodId, {
//                     customer: customerId,
//                 });
//             } else {
//                 customerId = paymentMethod.customer;
//             }

//             client.stripeCustomerId = customerId;
//             client.defaultPaymentMethodId = paymentMethodId;
//             await client.save();

//         } catch (pmError) {
//             console.error("Payment method error:", pmError);
//             return res.status(400).json({
//                 message: 'Invalid payment method. Please add a new card.',
//                 code: 'INVALID_PAYMENT_METHOD'
//             });
//         }

//         // ==================== ⭐ DOUBLE-SIDED FEE CALCULATION ====================
//         const bidAmountInCents = Math.round(acceptedBid.offerPrice * 100);

//         // ────────────────────────────────────────────
//         // CLIENT SIDE FEES (added to bid amount)
//         // ────────────────────────────────────────────

//         // Platform Fee: 10% of bid
//         const clientPlatformFeeInCents = Math.round(bidAmountInCents * CLIENT_PLATFORM_FEE_PERCENT);

//         // Reservation Fee: $5 flat
//         const reservationFeeInCents = RESERVATION_FEE_CENTS;

//         // HST: 13% on the task price (bid amount)
//         const clientTaxInCents = Math.round(bidAmountInCents * CLIENT_TAX_PERCENT);

//         // TOTAL CLIENT PAYS = Bid + 10% + $5 + 13%
//         const totalClientPaysInCents = bidAmountInCents + clientPlatformFeeInCents + reservationFeeInCents + clientTaxInCents;

//         // ────────────────────────────────────────────
//         // TASKER SIDE FEES (deducted from bid amount)
//         // ────────────────────────────────────────────

//         // Platform Fee: 12% deducted from tasker
//         const taskerPlatformFeeInCents = Math.round(bidAmountInCents * TASKER_PLATFORM_FEE_PERCENT);

//         // Tax: 13% deducted from tasker
//         const taskerTaxInCents = Math.round(bidAmountInCents * TASKER_TAX_PERCENT);

//         // Total deductions from tasker
//         const totalTaskerDeductionsInCents = taskerPlatformFeeInCents + taskerTaxInCents;

//         // TASKER RECEIVES = Bid - 12% - 13%
//         const taskerPayoutInCents = bidAmountInCents - totalTaskerDeductionsInCents;

//         // ────────────────────────────────────────────
//         // PLATFORM KEEPS (application fee for Stripe)
//         // ────────────────────────────────────────────

//         // Application Fee = Total Client Pays - Tasker Payout
//         const applicationFeeInCents = totalClientPaysInCents - taskerPayoutInCents;

//         // For logging: breakdown of platform revenue
//         const clientFeesTotal = clientPlatformFeeInCents + reservationFeeInCents + clientTaxInCents;
//         const taskerFeesTotal = totalTaskerDeductionsInCents;

//         console.log("💰 DOUBLE-SIDED FEE Payment Breakdown:");
//         console.log(`   ┌─────────────────────────────────────────────────────┐`);
//         console.log(`   │ BID AMOUNT:                  $${(bidAmountInCents / 100).toFixed(2).padStart(8)}`);
//         console.log(`   ├─────────────────────────────────────────────────────┤`);
//         console.log(`   │ CLIENT SIDE (added to bid):`);
//         console.log(`   │   Platform Fee (10%):       +$${(clientPlatformFeeInCents / 100).toFixed(2).padStart(8)}`);
//         console.log(`   │   Reservation Fee:          +$${(reservationFeeInCents / 100).toFixed(2).padStart(8)}`);
//         console.log(`   │   HST (13%):                +$${(clientTaxInCents / 100).toFixed(2).padStart(8)}`);
//         console.log(`   │   ─────────────────────────────────────────────────`);
//         console.log(`   │   TOTAL CLIENT PAYS:         $${(totalClientPaysInCents / 100).toFixed(2).padStart(8)}`);
//         console.log(`   ├─────────────────────────────────────────────────────┤`);
//         console.log(`   │ TASKER SIDE (deducted from bid):`);
//         console.log(`   │   Platform Fee (12%):       -$${(taskerPlatformFeeInCents / 100).toFixed(2).padStart(8)}`);
//         console.log(`   │   Tax (13%):                -$${(taskerTaxInCents / 100).toFixed(2).padStart(8)}`);
//         console.log(`   │   ─────────────────────────────────────────────────`);
//         console.log(`   │   TASKER RECEIVES:           $${(taskerPayoutInCents / 100).toFixed(2).padStart(8)}`);
//         console.log(`   ├─────────────────────────────────────────────────────┤`);
//         console.log(`   │ PLATFORM REVENUE:`);
//         console.log(`   │   From Client:              +$${(clientFeesTotal / 100).toFixed(2).padStart(8)}`);
//         console.log(`   │   From Tasker:              +$${(taskerFeesTotal / 100).toFixed(2).padStart(8)}`);
//         console.log(`   │   ─────────────────────────────────────────────────`);
//         console.log(`   │   TOTAL PLATFORM KEEPS:      $${(applicationFeeInCents / 100).toFixed(2).padStart(8)}`);
//         console.log(`   └─────────────────────────────────────────────────────┘`);

//         // Validation
//         if (totalClientPaysInCents < 50) {
//             return res.status(400).json({
//                 message: 'Total amount too small. Minimum is $0.50 CAD',
//                 code: 'AMOUNT_TOO_SMALL'
//             });
//         }

//         if (taskerPayoutInCents < 0) {
//             return res.status(400).json({
//                 message: 'Bid amount too small to cover fees',
//                 code: 'BID_TOO_SMALL'
//             });
//         }

//         console.log("✅ All validations passed, creating PaymentIntent...");

//         // ==================== PAYMENT PHASE ====================
//         try {
//             paymentIntent = await stripe.paymentIntents.create({
//                 // Charge the TOTAL amount from client
//                 amount: totalClientPaysInCents,
//                 currency: 'cad',
//                 customer: customerId,
//                 payment_method: paymentMethodId,
//                 capture_method: 'manual',  // Hold, don't capture yet

//                 description: `Task: ${task.taskTitle} - Bid: $${acceptedBid.offerPrice} (+ fees & taxes)`,

//                 // Platform keeps this amount
//                 application_fee_amount: applicationFeeInCents,

//                 // Tasker receives the remainder
//                 transfer_data: {
//                     destination: taskerStripeAccountId,
//                 },

//                 metadata: {
//                     taskId: task._id.toString(),
//                     taskerId: taskerId,
//                     clientId: client._id.toString(),

//                     // All amounts for reference
//                     bidAmount: (bidAmountInCents / 100).toString(),

//                     // Client fees
//                     clientPlatformFee: (clientPlatformFeeInCents / 100).toString(),
//                     reservationFee: (reservationFeeInCents / 100).toString(),
//                     clientTax: (clientTaxInCents / 100).toString(),
//                     totalClientPays: (totalClientPaysInCents / 100).toString(),

//                     // Tasker deductions
//                     taskerPlatformFee: (taskerPlatformFeeInCents / 100).toString(),
//                     taskerTax: (taskerTaxInCents / 100).toString(),
//                     taskerPayout: (taskerPayoutInCents / 100).toString(),

//                     // Platform
//                     applicationFee: (applicationFeeInCents / 100).toString(),

//                     feeStructure: 'client-10-5-13_tasker-12-13',
//                 },

//                 automatic_payment_methods: {
//                     enabled: true,
//                     allow_redirects: 'never'
//                 },
//                 confirm: true,
//             });

//             console.log("✅ PaymentIntent created:", paymentIntent.id);
//             console.log("   Status:", paymentIntent.status);

//         } catch (stripeError) {
//             console.error("❌ Stripe error:", stripeError);
//             return res.status(400).json({
//                 message: 'Payment authorization failed: ' + stripeError.message,
//                 code: 'STRIPE_ERROR'
//             });
//         }

//         if (paymentIntent.status !== 'requires_capture') {
//             try {
//                 await stripe.paymentIntents.cancel(paymentIntent.id);
//             } catch (e) {
//                 console.error("Failed to cancel PaymentIntent:", e);
//             }

//             return res.status(400).json({
//                 message: 'Payment authorization failed',
//                 status: paymentIntent.status,
//                 error: paymentIntent.last_payment_error?.message
//             });
//         }

//         // ==================== DATABASE UPDATE PHASE ====================
//         try {
//             const now = new Date();

//             task.acceptedBy = taskerId;
//             task.status = "in progress";
//             task.paymentIntentId = paymentIntent.id;
//             task.stripeStatus = 'authorized';
//             task.acceptedBidAmount = acceptedBid.offerPrice;
//             task.acceptedBidMessage = acceptedBid.message || null;
//             task.acceptedAt = now;

//             // Store detailed payment breakdown
//             task.payment = {
//                 paymentIntentId: paymentIntent.id,
//                 status: 'held',
//                 currency: 'cad',
//                 authorizedAt: now,
//                 feeStructure: 'client-10-5-13_tasker-12-13',

//                 // Amounts in cents for precision
//                 bidAmountCents: bidAmountInCents,

//                 // Client-side fees
//                 clientPlatformFeeCents: clientPlatformFeeInCents,
//                 reservationFeeCents: reservationFeeInCents,
//                 clientTaxCents: clientTaxInCents,
//                 totalClientPaysCents: totalClientPaysInCents,

//                 // Tasker-side deductions
//                 taskerPlatformFeeCents: taskerPlatformFeeInCents,
//                 taskerTaxCents: taskerTaxInCents,
//                 taskerPayoutCents: taskerPayoutInCents,

//                 // Platform revenue
//                 applicationFeeCents: applicationFeeInCents,

//                 // Dollars for easy reading
//                 bidAmount: bidAmountInCents / 100,
//                 clientPlatformFee: clientPlatformFeeInCents / 100,
//                 reservationFee: reservationFeeInCents / 100,
//                 clientTax: clientTaxInCents / 100,
//                 totalClientPays: totalClientPaysInCents / 100,
//                 taskerPlatformFee: taskerPlatformFeeInCents / 100,
//                 taskerTax: taskerTaxInCents / 100,
//                 taskerPayout: taskerPayoutInCents / 100,
//                 applicationFee: applicationFeeInCents / 100,
//             };

//             task.acceptedBid = {
//                 taskerId: acceptedBid.taskerId,
//                 offerPrice: acceptedBid.offerPrice,
//                 message: acceptedBid.message || null,
//                 acceptedAt: now
//             };

//             await task.save();
//             console.log("✅ Task updated successfully");

//         } catch (dbError) {
//             console.error("❌ Database error, cancelling PaymentIntent:", dbError);

//             try {
//                 await stripe.paymentIntents.cancel(paymentIntent.id);
//                 console.log("✅ PaymentIntent cancelled due to DB error");
//             } catch (cancelError) {
//                 console.error("❌ Failed to cancel PaymentIntent:", cancelError);
//             }

//             return res.status(500).json({
//                 message: 'Failed to update task. Payment was not charged.',
//                 code: 'DATABASE_ERROR'
//             });
//         }

//         // ==================== NOTIFICATIONS ====================
//         const clientName = `${client.firstName} ${client.lastName}`;
//         const tasker = await User.findById(taskerId).select("firstName lastName");
//         const taskerName = tasker ? `${tasker.firstName} ${tasker.lastName}` : "The tasker";

//         try {
//             await createNotification(
//                 taskerId,
//                 "🎉 Your Bid Was Accepted!",
//                 `${clientName} accepted your bid of $${acceptedBid.offerPrice} for "${task.taskTitle}". You will receive $${(taskerPayoutInCents / 100).toFixed(2)} upon completion (after 12% platform fee + 13% tax).`,
//                 "bid-accepted",
//                 task._id
//             );
//         } catch (e) {
//             console.error("Notification error:", e);
//         }

//         try {
//             await createNotification(
//                 req.user.id,
//                 "Bid Accepted",
//                 `You accepted ${taskerName}'s bid of $${acceptedBid.offerPrice}. Total charged: $${(totalClientPaysInCents / 100).toFixed(2)} (including 10% platform fee + $5 reservation + 13% HST).`,
//                 "bid-accept-confirmed",
//                 task._id
//             );
//         } catch (e) {
//             console.error("Notification error:", e);
//         }

//         // Notify rejected bidders
//         try {
//             const rejectedBidderIds = [...new Set(
//                 task.bids
//                     .map(bid => bid.taskerId.toString())
//                     .filter(id => id !== taskerId)
//             )];

//             for (const bidderId of rejectedBidderIds) {
//                 await createNotification(
//                     bidderId,
//                     "Bid Not Selected",
//                     `Your bid for "${task.taskTitle}" was not selected.`,
//                     "bid-rejected",
//                     task._id
//                 );
//             }
//         } catch (e) {
//             console.error("Rejected bidders notification error:", e);
//         }

//         // ==================== SUCCESS RESPONSE ====================
//         return res.status(200).json({
//             success: true,
//             message: "Bid accepted successfully",
//             task: {
//                 _id: task._id,
//                 status: task.status,
//                 acceptedBy: task.acceptedBy,
//             },
//             paymentBreakdown: {
//                 bidAmount: bidAmountInCents / 100,

//                 // Client side
//                 clientPlatformFee: clientPlatformFeeInCents / 100,
//                 reservationFee: reservationFeeInCents / 100,
//                 clientTax: clientTaxInCents / 100,
//                 totalClientPays: totalClientPaysInCents / 100,

//                 // Tasker side
//                 taskerPlatformFee: taskerPlatformFeeInCents / 100,
//                 taskerTax: taskerTaxInCents / 100,
//                 taskerPayout: taskerPayoutInCents / 100,

//                 // Platform
//                 platformTotal: applicationFeeInCents / 100,

//                 currency: 'CAD',
//                 status: 'authorized',
//                 feeStructure: 'client-10-5-13_tasker-12-13'
//             }
//         });

//     } catch (error) {
//         console.error("❌ Unexpected error:", error);

//         if (paymentIntent?.id) {
//             try {
//                 await stripe.paymentIntents.cancel(paymentIntent.id);
//                 console.log("✅ PaymentIntent cancelled due to error");
//             } catch (cancelError) {
//                 console.error("❌ Failed to cancel PaymentIntent:", cancelError);
//             }
//         }

//         return res.status(500).json({
//             success: false,
//             error: "Failed to accept bid",
//             details: error.message
//         });
//     }
// };


// export const acceptBidByClient = async (req, res) => {
//     let paymentIntent = null;

//     try {
//         const { id: taskId } = req.params;
//         const { taskerId, paymentMethodId: providedPaymentMethodId } = req.body;

//         console.log("📥 Accept bid request:", { taskId, taskerId });

//         // ==================== VALIDATION PHASE ====================
//         const task = await Task.findById(taskId).populate('client');
//         if (!task) {
//             return res.status(404).json({ error: "Task not found" });
//         }

//         if (task.client._id.toString() !== req.user.id) {
//             return res.status(403).json({ error: "You are not authorized" });
//         }

//         if (task.status !== "pending") {
//             return res.status(400).json({ error: "Task already accepted or completed" });
//         }

//         const acceptedBid = task.bids.find(bid => bid.taskerId.toString() === taskerId);
//         if (!acceptedBid) {
//             return res.status(404).json({ error: "Bid not found for this tasker" });
//         }

//         // Validate tasker can receive payments
//         let taskerStripeAccountId;
//         try {
//             taskerStripeAccountId = await validateTaskerCanReceivePayments(taskerId);
//         } catch (connectError) {
//             return res.status(400).json({
//                 error: connectError.message,
//                 code: 'TASKER_PAYMENT_NOT_SETUP',
//             });
//         }

//         // Get client and validate payment method
//         let client = await User.findById(task.client._id);
//         let paymentMethodId = providedPaymentMethodId || client.defaultPaymentMethodId;

//         if (!paymentMethodId) {
//             return res.status(400).json({
//                 message: 'No payment method provided.',
//                 code: 'NO_PAYMENT_METHOD'
//             });
//         }

//         // Verify payment method exists and get customer
//         let customerId = client.stripeCustomerId;

//         try {
//             const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);

//             if (!paymentMethod.customer) {
//                 if (!customerId) {
//                     const customer = await stripe.customers.create({
//                         email: client.email,
//                         name: `${client.firstName} ${client.lastName}`,
//                         metadata: { userId: client._id.toString() }
//                     });
//                     customerId = customer.id;
//                 }

//                 await stripe.paymentMethods.attach(paymentMethodId, {
//                     customer: customerId,
//                 });
//             } else {
//                 customerId = paymentMethod.customer;
//             }

//             client.stripeCustomerId = customerId;
//             client.defaultPaymentMethodId = paymentMethodId;
//             await client.save();

//         } catch (pmError) {
//             console.error("Payment method error:", pmError);
//             return res.status(400).json({
//                 message: 'Invalid payment method. Please add a new card.',
//                 code: 'INVALID_PAYMENT_METHOD'
//             });
//         }

//         // ==================== FEE CALCULATION ====================
//         const bidAmountInCents = Math.round(acceptedBid.offerPrice * 100);

//         // CLIENT SIDE FEES
//         const clientPlatformFeeCents = Math.round(bidAmountInCents * CLIENT_PLATFORM_FEE_PERCENT);
//         const reservationFeeCents = RESERVATION_FEE_CENTS;
//         const clientTaxCents = Math.round(bidAmountInCents * CLIENT_TAX_PERCENT);
//         const totalClientPaysCents = bidAmountInCents + clientPlatformFeeCents + reservationFeeCents + clientTaxCents;

//         // TASKER SIDE FEES
//         const taskerPlatformFeeCents = Math.round(bidAmountInCents * TASKER_PLATFORM_FEE_PERCENT);
//         const taskerTaxCents = Math.round(bidAmountInCents * TASKER_TAX_PERCENT);
//         const taskerPayoutCents = bidAmountInCents - taskerPlatformFeeCents - taskerTaxCents;

//         // PLATFORM REVENUE
//         const applicationFeeCents = totalClientPaysCents - taskerPayoutCents;

//         console.log("💰 Payment Breakdown:");
//         console.log(`   Bid Amount: $${(bidAmountInCents / 100).toFixed(2)}`);
//         console.log(`   Client Pays: $${(totalClientPaysCents / 100).toFixed(2)}`);
//         console.log(`   Tasker Gets: $${(taskerPayoutCents / 100).toFixed(2)}`);
//         console.log(`   Platform Keeps: $${(applicationFeeCents / 100).toFixed(2)}`);

//         // Validation
//         if (totalClientPaysCents < 50) {
//             return res.status(400).json({
//                 message: 'Total amount too small. Minimum is $0.50 CAD',
//                 code: 'AMOUNT_TOO_SMALL'
//             });
//         }

//         if (taskerPayoutCents < 0) {
//             return res.status(400).json({
//                 message: 'Bid amount too small to cover fees',
//                 code: 'BID_TOO_SMALL'
//             });
//         }

//         // ==================== PAYMENT PHASE ====================
//         try {
//             paymentIntent = await stripe.paymentIntents.create({
//                 amount: totalClientPaysCents,
//                 currency: 'cad',
//                 customer: customerId,
//                 payment_method: paymentMethodId,
//                 capture_method: 'manual',

//                 description: `Task: ${task.taskTitle} - Bid: $${acceptedBid.offerPrice}`,

//                 application_fee_amount: applicationFeeCents,

//                 transfer_data: {
//                     destination: taskerStripeAccountId,
//                 },

//                 metadata: {
//                     taskId: task._id.toString(),
//                     taskerId: taskerId,
//                     clientId: client._id.toString(),
//                     bidAmount: (bidAmountInCents / 100).toString(),
//                     totalClientPays: (totalClientPaysCents / 100).toString(),
//                     taskerPayout: (taskerPayoutCents / 100).toString(),
//                     feeStructure: 'client-10-5-13_tasker-12-13',
//                 },

//                 automatic_payment_methods: {
//                     enabled: true,
//                     allow_redirects: 'never'
//                 },
//                 confirm: true,
//             });

//             console.log("✅ PaymentIntent created:", paymentIntent.id, "Status:", paymentIntent.status);

//         } catch (stripeError) {
//             console.error("❌ Stripe error:", stripeError);
//             return res.status(400).json({
//                 message: 'Payment authorization failed: ' + stripeError.message,
//                 code: 'STRIPE_ERROR'
//             });
//         }

//         if (paymentIntent.status !== 'requires_capture') {
//             try {
//                 await stripe.paymentIntents.cancel(paymentIntent.id);
//             } catch (e) {
//                 console.error("Failed to cancel PaymentIntent:", e);
//             }

//             return res.status(400).json({
//                 message: 'Payment authorization failed',
//                 status: paymentIntent.status,
//                 error: paymentIntent.last_payment_error?.message
//             });
//         }

//         // ==================== DATABASE UPDATE ====================
//         try {
//             const now = new Date();

//             // Update task
//             task.acceptedBy = taskerId;
//             task.status = "in progress";
//             task.paymentIntentId = paymentIntent.id;
//             task.stripeStatus = 'authorized';
//             task.acceptedBidAmount = acceptedBid.offerPrice;
//             task.acceptedBidMessage = acceptedBid.message || null;
//             task.acceptedAt = now;

//             // ⭐ Set payment object with all fields
//             task.payment = {
//                 paymentIntentId: paymentIntent.id,
//                 status: 'held',
//                 currency: 'cad',
//                 feeStructure: 'client-10-5-13_tasker-12-13',
//                 authorizedAt: now,

//                 // Bid amount
//                 bidAmount: bidAmountInCents / 100,
//                 bidAmountCents: bidAmountInCents,

//                 // Client fees
//                 clientPlatformFee: clientPlatformFeeCents / 100,
//                 clientPlatformFeeCents: clientPlatformFeeCents,
//                 reservationFee: reservationFeeCents / 100,
//                 reservationFeeCents: reservationFeeCents,
//                 clientTax: clientTaxCents / 100,
//                 clientTaxCents: clientTaxCents,
//                 totalClientPays: totalClientPaysCents / 100,
//                 totalClientPaysCents: totalClientPaysCents,

//                 // Tasker deductions
//                 taskerPlatformFee: taskerPlatformFeeCents / 100,
//                 taskerPlatformFeeCents: taskerPlatformFeeCents,
//                 taskerTax: taskerTaxCents / 100,
//                 taskerTaxCents: taskerTaxCents,
//                 taskerPayout: taskerPayoutCents / 100,
//                 taskerPayoutCents: taskerPayoutCents,

//                 // Platform revenue
//                 applicationFee: applicationFeeCents / 100,
//                 applicationFeeCents: applicationFeeCents,

//                 // Legacy fields
//                 grossAmount: totalClientPaysCents / 100,
//                 platformFee: applicationFeeCents / 100,
//             };

//             // Set accepted bid info
//             task.acceptedBid = {
//                 taskerId: acceptedBid.taskerId,
//                 offerPrice: acceptedBid.offerPrice,
//                 message: acceptedBid.message || null,
//                 acceptedAt: now
//             };

//             // Update bid status
//             const bidIndex = task.bids.findIndex(b => b.taskerId.toString() === taskerId);
//             if (bidIndex !== -1) {
//                 task.bids[bidIndex].status = 'accepted';
//             }

//             await task.save();
//             console.log("✅ Task updated successfully");

//         } catch (dbError) {
//             console.error("❌ Database error:", dbError);

//             try {
//                 await stripe.paymentIntents.cancel(paymentIntent.id);
//             } catch (cancelError) {
//                 console.error("Failed to cancel PaymentIntent:", cancelError);
//             }

//             return res.status(500).json({
//                 message: 'Failed to update task. Payment was not charged.',
//                 code: 'DATABASE_ERROR'
//             });
//         }

//         // ==================== NOTIFICATIONS ====================
//         const clientName = `${client.firstName} ${client.lastName}`;
//         const tasker = await User.findById(taskerId).select("firstName lastName");
//         const taskerName = tasker ? `${tasker.firstName} ${tasker.lastName}` : "The tasker";

//         try {
//             await createNotification(
//                 taskerId,
//                 "🎉 Your Bid Was Accepted!",
//                 `${clientName} accepted your bid of $${acceptedBid.offerPrice} for "${task.taskTitle}". You will receive $${(taskerPayoutCents / 100).toFixed(2)} upon completion.`,
//                 "bid-accepted",
//                 task._id
//             );

//             await createNotification(
//                 req.user.id,
//                 "Bid Accepted",
//                 `You accepted ${taskerName}'s bid of $${acceptedBid.offerPrice}. Total: $${(totalClientPaysCents / 100).toFixed(2)}.`,
//                 "bid-accept-confirmed",
//                 task._id
//             );
//         } catch (e) {
//             console.error("Notification error:", e);
//         }

//         // ==================== SUCCESS RESPONSE ====================
//         return res.status(200).json({
//             success: true,
//             message: "Bid accepted successfully",
//             task: {
//                 _id: task._id,
//                 status: task.status,
//                 acceptedBy: task.acceptedBy,
//             },
//             paymentBreakdown: {
//                 bidAmount: bidAmountInCents / 100,
//                 clientPlatformFee: clientPlatformFeeCents / 100,
//                 reservationFee: reservationFeeCents / 100,
//                 clientTax: clientTaxCents / 100,
//                 totalClientPays: totalClientPaysCents / 100,
//                 taskerPlatformFee: taskerPlatformFeeCents / 100,
//                 taskerTax: taskerTaxCents / 100,
//                 taskerPayout: taskerPayoutCents / 100,
//                 platformTotal: applicationFeeCents / 100,
//                 currency: 'CAD',
//                 status: 'authorized',
//             }
//         });

//     } catch (error) {
//         console.error("❌ Unexpected error:", error);

//         if (paymentIntent?.id) {
//             try {
//                 await stripe.paymentIntents.cancel(paymentIntent.id);
//             } catch (cancelError) {
//                 console.error("Failed to cancel PaymentIntent:", cancelError);
//             }
//         }

//         return res.status(500).json({
//             success: false,
//             error: "Failed to accept bid",
//             details: error.message
//         });
//     }
// };

export const acceptBidByClient = async (req, res) => {
    let paymentIntent = null;
    const { id: taskId } = req.params;
    const { taskerId, paymentMethodId: providedPaymentMethodId } = req.body;

    try {
        console.log("📥 Accept bid request:", { taskId, taskerId });

        // ==================== VALIDATION PHASE ====================
        const task = await Task.findById(taskId).populate('client');
        if (!task) {
            await logBidAcceptance({
                action: "BID_ACCEPTED",
                user: req.user,
                req,
                taskId,
                taskerId,
                status: "failure",
                metadata: {
                    errorMessage: "Task not found",
                    errorCode: "TASK_NOT_FOUND",
                },
            });

            return res.status(404).json({ error: "Task not found" });
        }

        if (task.client._id.toString() !== req.user.id) {
            await logBidAcceptance({
                action: "BID_ACCEPTED",
                user: req.user,
                req,
                taskId: task._id.toString(),
                taskTitle: task.taskTitle,
                taskerId,
                status: "failure",
                metadata: {
                    errorMessage: "Unauthorized - not the task owner",
                    errorCode: "UNAUTHORIZED",
                    taskOwnerId: task.client._id.toString(),
                    requesterId: req.user.id,
                },
            });

            return res.status(403).json({ error: "You are not authorized" });
        }

        if (task.status !== "pending") {
            await logBidAcceptance({
                action: "BID_ACCEPTED",
                user: req.user,
                req,
                taskId: task._id.toString(),
                taskTitle: task.taskTitle,
                taskerId,
                status: "failure",
                metadata: {
                    errorMessage: "Task already accepted or completed",
                    errorCode: "INVALID_STATUS",
                    currentStatus: task.status,
                },
            });

            return res.status(400).json({ error: "Task already accepted or completed" });
        }

        const acceptedBid = task.bids.find(bid => bid.taskerId.toString() === taskerId);
        if (!acceptedBid) {
            await logBidAcceptance({
                action: "BID_ACCEPTED",
                user: req.user,
                req,
                taskId: task._id.toString(),
                taskTitle: task.taskTitle,
                taskerId,
                status: "failure",
                metadata: {
                    errorMessage: "Bid not found for this tasker",
                    errorCode: "BID_NOT_FOUND",
                    totalBids: task.bids.length,
                },
            });

            return res.status(404).json({ error: "Bid not found for this tasker" });
        }

        // Get tasker details
        const tasker = await User.findById(taskerId).select("firstName lastName email");
        const taskerName = tasker ? `${tasker.firstName} ${tasker.lastName}` : "The tasker";

        // Validate tasker can receive payments
        let taskerStripeAccountId;
        try {
            taskerStripeAccountId = await validateTaskerCanReceivePayments(taskerId);
        } catch (connectError) {
            await logBidAcceptance({
                action: "BID_ACCEPTED",
                user: req.user,
                req,
                taskId: task._id.toString(),
                taskTitle: task.taskTitle,
                taskerId,
                taskerName,
                bidAmount: acceptedBid.offerPrice,
                status: "failure",
                metadata: {
                    errorMessage: connectError.message,
                    errorCode: "TASKER_PAYMENT_NOT_SETUP",
                    taskerEmail: tasker?.email,
                },
            });

            return res.status(400).json({
                error: connectError.message,
                code: 'TASKER_PAYMENT_NOT_SETUP',
            });
        }

        // Get client and validate payment method
        let client = await User.findById(task.client._id);
        let paymentMethodId = providedPaymentMethodId || client.defaultPaymentMethodId;

        if (!paymentMethodId) {
            await logBidAcceptance({
                action: "BID_ACCEPTED",
                user: { ...req.user, ...client.toObject() },
                req,
                taskId: task._id.toString(),
                taskTitle: task.taskTitle,
                taskerId,
                taskerName,
                bidAmount: acceptedBid.offerPrice,
                status: "failure",
                metadata: {
                    errorMessage: "No payment method provided",
                    errorCode: "NO_PAYMENT_METHOD",
                    clientEmail: client.email,
                },
            });

            return res.status(400).json({
                message: 'No payment method provided.',
                code: 'NO_PAYMENT_METHOD'
            });
        }

        // Verify payment method exists and get customer
        let customerId = client.stripeCustomerId;

        try {
            const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);

            if (!paymentMethod.customer) {
                if (!customerId) {
                    const customer = await stripe.customers.create({
                        email: client.email,
                        name: `${client.firstName} ${client.lastName}`,
                        metadata: { userId: client._id.toString() }
                    });
                    customerId = customer.id;
                }

                await stripe.paymentMethods.attach(paymentMethodId, {
                    customer: customerId,
                });
            } else {
                customerId = paymentMethod.customer;
            }

            client.stripeCustomerId = customerId;
            client.defaultPaymentMethodId = paymentMethodId;
            await client.save();

        } catch (pmError) {
            console.error("Payment method error:", pmError);

            await logBidAcceptance({
                action: "BID_ACCEPTED",
                user: { ...req.user, ...client.toObject() },
                req,
                taskId: task._id.toString(),
                taskTitle: task.taskTitle,
                taskerId,
                taskerName,
                bidAmount: acceptedBid.offerPrice,
                status: "failure",
                metadata: {
                    errorMessage: "Invalid payment method",
                    errorCode: "INVALID_PAYMENT_METHOD",
                    stripeError: pmError.message,
                },
            });

            return res.status(400).json({
                message: 'Invalid payment method. Please add a new card.',
                code: 'INVALID_PAYMENT_METHOD'
            });
        }

        // ==================== FEE CALCULATION ====================
        const bidAmountInCents = Math.round(acceptedBid.offerPrice * 100);

        // CLIENT SIDE FEES
        const clientPlatformFeeCents = Math.round(bidAmountInCents * CLIENT_PLATFORM_FEE_PERCENT);
        const reservationFeeCents = RESERVATION_FEE_CENTS;
        const clientTaxCents = Math.round(bidAmountInCents * CLIENT_TAX_PERCENT);
        const totalClientPaysCents = bidAmountInCents + clientPlatformFeeCents + reservationFeeCents + clientTaxCents;

        // TASKER SIDE FEES
        const taskerPlatformFeeCents = Math.round(bidAmountInCents * TASKER_PLATFORM_FEE_PERCENT);
        const taskerTaxCents = Math.round(bidAmountInCents * TASKER_TAX_PERCENT);
        const taskerPayoutCents = bidAmountInCents - taskerPlatformFeeCents - taskerTaxCents;

        // PLATFORM REVENUE
        const applicationFeeCents = totalClientPaysCents - taskerPayoutCents;

        console.log("💰 Payment Breakdown:");
        console.log(`   Bid Amount: $${(bidAmountInCents / 100).toFixed(2)}`);
        console.log(`   Client Pays: $${(totalClientPaysCents / 100).toFixed(2)}`);
        console.log(`   Tasker Gets: $${(taskerPayoutCents / 100).toFixed(2)}`);
        console.log(`   Platform Keeps: $${(applicationFeeCents / 100).toFixed(2)}`);

        // Validation
        if (totalClientPaysCents < 50) {
            await logBidAcceptance({
                action: "BID_ACCEPTED",
                user: { ...req.user, ...client.toObject() },
                req,
                taskId: task._id.toString(),
                taskTitle: task.taskTitle,
                taskerId,
                taskerName,
                bidAmount: acceptedBid.offerPrice,
                totalAmount: totalClientPaysCents,
                status: "failure",
                metadata: {
                    errorMessage: "Total amount too small",
                    errorCode: "AMOUNT_TOO_SMALL",
                    minimumRequired: 50,
                },
            });

            return res.status(400).json({
                message: 'Total amount too small. Minimum is $0.50 CAD',
                code: 'AMOUNT_TOO_SMALL'
            });
        }

        if (taskerPayoutCents < 0) {
            await logBidAcceptance({
                action: "BID_ACCEPTED",
                user: { ...req.user, ...client.toObject() },
                req,
                taskId: task._id.toString(),
                taskTitle: task.taskTitle,
                taskerId,
                taskerName,
                bidAmount: acceptedBid.offerPrice,
                taskerPayout: taskerPayoutCents,
                status: "failure",
                metadata: {
                    errorMessage: "Bid amount too small to cover fees",
                    errorCode: "BID_TOO_SMALL",
                },
            });

            return res.status(400).json({
                message: 'Bid amount too small to cover fees',
                code: 'BID_TOO_SMALL'
            });
        }

        // ==================== PAYMENT PHASE ====================
        try {
            paymentIntent = await stripe.paymentIntents.create({
                amount: totalClientPaysCents,
                currency: 'cad',
                customer: customerId,
                payment_method: paymentMethodId,
                capture_method: 'manual',
                description: `Task: ${task.taskTitle} - Bid: $${acceptedBid.offerPrice}`,
                application_fee_amount: applicationFeeCents,
                transfer_data: {
                    destination: taskerStripeAccountId,
                },
                metadata: {
                    taskId: task._id.toString(),
                    taskerId: taskerId,
                    clientId: client._id.toString(),
                    bidAmount: (bidAmountInCents / 100).toString(),
                    totalClientPays: (totalClientPaysCents / 100).toString(),
                    taskerPayout: (taskerPayoutCents / 100).toString(),
                    feeStructure: 'client-10-5-13_tasker-12-13',
                },
                automatic_payment_methods: {
                    enabled: true,
                    allow_redirects: 'never'
                },
                confirm: true,
            });

            console.log("✅ PaymentIntent created:", paymentIntent.id, "Status:", paymentIntent.status);

            // ✅ Log payment authorization
            await logPayment({
                action: "PAYMENT_AUTHORIZED",
                user: { ...req.user, ...client.toObject() },
                req,
                taskId: task._id.toString(),
                taskTitle: task.taskTitle,
                amount: totalClientPaysCents,
                paymentIntentId: paymentIntent.id,
                status: "success",
                metadata: {
                    bidAcceptance: true,
                    bidAmount: acceptedBid.offerPrice,
                    taskerId,
                    taskerName,
                    taskerPayout: taskerPayoutCents / 100,
                    applicationFee: applicationFeeCents / 100,
                    stripeAccountId: taskerStripeAccountId,
                },
            });

        } catch (stripeError) {
            console.error("❌ Stripe error:", stripeError);

            // ✅ Log payment failure
            await logPayment({
                action: "PAYMENT_FAILED",
                user: { ...req.user, ...client.toObject() },
                req,
                taskId: task._id.toString(),
                taskTitle: task.taskTitle,
                amount: totalClientPaysCents,
                status: "failure",
                metadata: {
                    errorMessage: stripeError.message,
                    errorCode: stripeError.code,
                    errorType: stripeError.type,
                    bidAcceptance: true,
                    bidAmount: acceptedBid.offerPrice,
                },
            });

            // Also log bid acceptance failure
            await logBidAcceptance({
                action: "BID_ACCEPTED",
                user: { ...req.user, ...client.toObject() },
                req,
                taskId: task._id.toString(),
                taskTitle: task.taskTitle,
                taskerId,
                taskerName,
                bidAmount: acceptedBid.offerPrice,
                totalAmount: totalClientPaysCents,
                status: "failure",
                metadata: {
                    errorMessage: "Payment authorization failed",
                    errorCode: "STRIPE_ERROR",
                    stripeError: stripeError.message,
                },
            });

            return res.status(400).json({
                message: 'Payment authorization failed: ' + stripeError.message,
                code: 'STRIPE_ERROR'
            });
        }

        if (paymentIntent.status !== 'requires_capture') {
            try {
                await stripe.paymentIntents.cancel(paymentIntent.id);
            } catch (e) {
                console.error("Failed to cancel PaymentIntent:", e);
            }

            await logBidAcceptance({
                action: "BID_ACCEPTED",
                user: { ...req.user, ...client.toObject() },
                req,
                taskId: task._id.toString(),
                taskTitle: task.taskTitle,
                taskerId,
                taskerName,
                bidAmount: acceptedBid.offerPrice,
                totalAmount: totalClientPaysCents,
                status: "failure",
                metadata: {
                    errorMessage: "Payment authorization failed - unexpected status",
                    paymentStatus: paymentIntent.status,
                    lastPaymentError: paymentIntent.last_payment_error?.message,
                },
            });

            return res.status(400).json({
                message: 'Payment authorization failed',
                status: paymentIntent.status,
                error: paymentIntent.last_payment_error?.message
            });
        }

        // ==================== DATABASE UPDATE ====================
        try {
            const now = new Date();

            // Update task
            task.acceptedBy = taskerId;
            task.status = "in progress";
            task.paymentIntentId = paymentIntent.id;
            task.stripeStatus = 'authorized';
            task.acceptedBidAmount = acceptedBid.offerPrice;
            task.acceptedBidMessage = acceptedBid.message || null;
            task.acceptedAt = now;

            // Set payment object
            task.payment = {
                paymentIntentId: paymentIntent.id,
                status: 'held',
                currency: 'cad',
                feeStructure: 'client-10-5-13_tasker-12-13',
                authorizedAt: now,
                bidAmount: bidAmountInCents / 100,
                bidAmountCents: bidAmountInCents,
                clientPlatformFee: clientPlatformFeeCents / 100,
                clientPlatformFeeCents: clientPlatformFeeCents,
                reservationFee: reservationFeeCents / 100,
                reservationFeeCents: reservationFeeCents,
                clientTax: clientTaxCents / 100,
                clientTaxCents: clientTaxCents,
                totalClientPays: totalClientPaysCents / 100,
                totalClientPaysCents: totalClientPaysCents,
                taskerPlatformFee: taskerPlatformFeeCents / 100,
                taskerPlatformFeeCents: taskerPlatformFeeCents,
                taskerTax: taskerTaxCents / 100,
                taskerTaxCents: taskerTaxCents,
                taskerPayout: taskerPayoutCents / 100,
                taskerPayoutCents: taskerPayoutCents,
                applicationFee: applicationFeeCents / 100,
                applicationFeeCents: applicationFeeCents,
            };

            // Set accepted bid info
            task.acceptedBid = {
                taskerId: acceptedBid.taskerId,
                offerPrice: acceptedBid.offerPrice,
                message: acceptedBid.message || null,
                acceptedAt: now
            };

            // Update bid status
            const bidIndex = task.bids.findIndex(b => b.taskerId.toString() === taskerId);
            if (bidIndex !== -1) {
                task.bids[bidIndex].status = 'accepted';
            }

            await task.save();
            console.log("✅ Task updated successfully");

        } catch (dbError) {
            console.error("❌ Database error:", dbError);

            try {
                await stripe.paymentIntents.cancel(paymentIntent.id);
            } catch (cancelError) {
                console.error("Failed to cancel PaymentIntent:", cancelError);
            }

            await logBidAcceptance({
                action: "BID_ACCEPTED",
                user: { ...req.user, ...client.toObject() },
                req,
                taskId: task._id.toString(),
                taskTitle: task.taskTitle,
                taskerId,
                taskerName,
                bidAmount: acceptedBid.offerPrice,
                totalAmount: totalClientPaysCents,
                status: "failure",
                metadata: {
                    errorMessage: "Database error - task not updated",
                    errorCode: "DATABASE_ERROR",
                    dbError: dbError.message,
                    paymentIntentCancelled: true,
                },
            });

            return res.status(500).json({
                message: 'Failed to update task. Payment was not charged.',
                code: 'DATABASE_ERROR'
            });
        }

        // ✅ Log successful bid acceptance
        await logBidAcceptance({
            action: "BID_ACCEPTED",
            user: { ...req.user, ...client.toObject() },
            req,
            taskId: task._id.toString(),
            taskTitle: task.taskTitle,
            bidId: acceptedBid._id?.toString(),
            taskerId,
            taskerName,
            bidAmount: acceptedBid.offerPrice,
            totalAmount: totalClientPaysCents,
            taskerPayout: taskerPayoutCents,
            status: "success",
            metadata: {
                // Payment details
                paymentIntentId: paymentIntent.id,
                clientPlatformFee: clientPlatformFeeCents / 100,
                reservationFee: reservationFeeCents / 100,
                clientTax: clientTaxCents / 100,
                taskerPlatformFee: taskerPlatformFeeCents / 100,
                taskerTax: taskerTaxCents / 100,
                applicationFee: applicationFeeCents / 100,

                // Task details
                previousStatus: "pending",
                newStatus: "in progress",
                totalBidsOnTask: task.bids.length,
                bidMessage: acceptedBid.message?.substring(0, 200),

                // User details
                clientEmail: client.email,
                taskerEmail: tasker?.email,
                taskerStripeAccountId,
            },
        });

        // Also log the bid being accepted (from bid perspective)
        await logBid({
            action: "BID_ACCEPTED",
            user: tasker,
            req,
            taskId: task._id.toString(),
            taskTitle: task.taskTitle,
            bidId: acceptedBid._id?.toString(),
            offerPrice: acceptedBid.offerPrice,
            status: "success",
            metadata: {
                acceptedBy: client._id.toString(),
                acceptedByName: `${client.firstName} ${client.lastName}`,
                taskerPayout: taskerPayoutCents / 100,
            },
        });

        // ==================== NOTIFICATIONS ====================
        const clientName = `${client.firstName} ${client.lastName}`;

        try {
            await createNotification(
                taskerId,
                "🎉 Your Bid Was Accepted!",
                `${clientName} accepted your bid of $${acceptedBid.offerPrice} for "${task.taskTitle}". You will receive $${(taskerPayoutCents / 100).toFixed(2)} upon completion.`,
                "bid-accepted",
                task._id
            );

            await createNotification(
                req.user.id,
                "Bid Accepted",
                `You accepted ${taskerName}'s bid of $${acceptedBid.offerPrice}. Total: $${(totalClientPaysCents / 100).toFixed(2)}.`,
                "bid-accept-confirmed",
                task._id
            );

            // Notify other bidders that they weren't selected
            if (task.bids && task.bids.length > 1) {
                const otherBidderIds = [...new Set(
                    task.bids
                        .map(bid => bid.taskerId.toString())
                        .filter(id => id !== taskerId)
                )];

                for (const bidderId of otherBidderIds) {
                    await createNotification(
                        bidderId,
                        "Bid Not Selected",
                        `Another bid was selected for "${task.taskTitle}". Keep bidding on other tasks!`,
                        "bid-not-selected",
                        task._id
                    );
                }
                console.log(`✅ Notified ${otherBidderIds.length} other bidders`);
            }
        } catch (e) {
            console.error("Notification error:", e);
        }

        // ==================== SUCCESS RESPONSE ====================
        return res.status(200).json({
            success: true,
            message: "Bid accepted successfully",
            task: {
                _id: task._id,
                status: task.status,
                acceptedBy: task.acceptedBy,
            },
            paymentBreakdown: {
                bidAmount: bidAmountInCents / 100,
                clientPlatformFee: clientPlatformFeeCents / 100,
                reservationFee: reservationFeeCents / 100,
                clientTax: clientTaxCents / 100,
                totalClientPays: totalClientPaysCents / 100,
                taskerPlatformFee: taskerPlatformFeeCents / 100,
                taskerTax: taskerTaxCents / 100,
                taskerPayout: taskerPayoutCents / 100,
                platformTotal: applicationFeeCents / 100,
                currency: 'CAD',
                status: 'authorized',
            }
        });

    } catch (error) {
        console.error("❌ Unexpected error:", error);

        if (paymentIntent?.id) {
            try {
                await stripe.paymentIntents.cancel(paymentIntent.id);
            } catch (cancelError) {
                console.error("Failed to cancel PaymentIntent:", cancelError);
            }
        }

        // ✅ Log unexpected error
        await logBidAcceptance({
            action: "BID_ACCEPTED",
            user: req.user,
            req,
            taskId,
            taskerId,
            status: "failure",
            metadata: {
                errorMessage: error.message,
                errorName: error.name,
                errorStack: error.stack?.substring(0, 500),
                paymentIntentCancelled: !!paymentIntent?.id,
            },
        });

        return res.status(500).json({
            success: false,
            error: "Failed to accept bid",
            details: error.message
        });
    }
};


// export const requestCompletionByTasker = async (req, res) => {
//     try {
//         const { id: taskId } = req.params;

//         const task = await Task.findById(taskId);
//         if (!task) return res.status(404).json({ error: "Task not found" });

//         if (task.status !== "in progress") {
//             return res.status(400).json({ error: "Task is not in progress" });
//         }

//         task.status = "requested";
//         await task.save();

//         // Create notification for the client (completion requested) - non-blocking
//         try {
//             // FIX: Get tasker details from database to ensure we have the name
//             const tasker = await User.findById(req.user.id).select("firstName lastName");

//             if (!tasker) {
//                 console.error("Tasker not found for notification");
//             }

//             const taskerName = tasker
//                 ? `${tasker.firstName} ${tasker.lastName}`
//                 : "The tasker";

//             // Debug: Log notification details
//             console.log("Creating completion request notification:", {
//                 clientId: task.client,
//                 taskerName,
//                 taskTitle: task.taskTitle,
//                 taskId: task._id
//             });

//             // Notify the client about completion request
//             await createNotification(
//                 task.client, // Client ID (task owner)
//                 "Completion Requested",
//                 `${taskerName} has requested completion for "${task.taskTitle}". Please review the work and approve to release payment.`,
//                 "completion-requested",
//                 task._id
//             );
//             console.log("✅ Notification created for client - completion request");

//         } catch (notifErr) {
//             console.error("❌ Failed to create client notification (non-blocking):", notifErr);
//         }

//         // Optional: Send confirmation notification to tasker
//         try {
//             await createNotification(
//                 req.user.id, // Tasker ID
//                 "Completion Request Sent",
//                 `Your completion request for "${task.taskTitle}" has been sent to the client. Waiting for approval.`,
//                 "completion-request-sent",
//                 task._id
//             );
//             console.log("✅ Confirmation notification sent to tasker");
//         } catch (notifErr) {
//             console.error("❌ Failed to create tasker confirmation notification:", notifErr);
//         }

//         res.status(200).json({ message: "Completion requested", task });
//     } catch (error) {
//         console.error("Error requesting completion:", error);
//         res.status(500).json({ error: "Failed to request completion", details: error.message });
//     }
// };


// Decline by tasker
// export const declineByTasker = async (req, res) => {
//     try {
//         const { id: taskId } = req.params;

//         const task = await Task.findById(taskId);
//         if (!task) return res.status(404).json({ error: "Task not found" });

//         if (task.status !== "in progress") {
//             return res.status(400).json({ error: "Task is not in progress" });
//         }

//         task.status = "pending";
//         await task.save();

//         // Create notification for the client (task declined) - non-blocking
//         try {
//             const tasker = await User.findById(req.user.id).select("firstName lastName");
//             await createNotification(
//                 task.client, // Client ID (task owner)
//                 "Task Declined",
//                 `Tasker "${tasker.firstName} ${tasker.lastName}" has declined "${task.taskTitle}". Please assign another tasker.`,
//                 "task-declined",
//                 task._id // Link to task
//             );
//             console.log("Notification created for task decline"); // Debug
//         } catch (notifErr) {
//             console.error("Failed to create notification (non-blocking):", notifErr); // Log but don't crash
//         }

//         res.status(200).json({ message: "Task Declined", task });
//     } catch (error) {
//         console.error("Error declining task:", error);
//         res.status(500).json({ error: "Failed to decline task", details: error.message });
//     }
// };


// export const declineByTasker = async (req, res) => {
//     try {
//         const { id: taskId } = req.params;

//         const task = await Task.findById(taskId);
//         if (!task) return res.status(404).json({ error: "Task not found" });

//         if (task.status !== "in progress") {
//             return res.status(400).json({ error: "Task is not in progress" });
//         }

//         const previousStripeStatus = task.stripeStatus;
//         task.status = "pending";
//         if (task.paymentIntentId && task.stripeStatus === 'authorized') {
//             const paymentIntent = await stripe.paymentIntents.cancel(task.paymentIntentId);
//             if (paymentIntent.status === 'canceled') {
//                 task.stripeStatus = 'canceled';
//             } else {
//                 return res.status(400).json({ message: 'Cancellation failed on decline' });
//             }
//         }
//         await task.save();

//         // Create notification...
//         try {
//             const tasker = await User.findById(req.user.id).select("firstName lastName");
//             await createNotification(
//                 task.client,
//                 "Task Declined",
//                 `Tasker "${tasker.firstName} ${tasker.lastName}" has declined "${task.taskTitle}". Funds released.${previousStripeStatus === 'authorized' ? ' Hold canceled.' : ''}`,
//                 "task-declined",
//                 task._id
//             );
//             console.log("Notification created for task decline");
//         } catch (notifErr) {
//             console.error("Failed to create notification (non-blocking):", notifErr);
//         }

//         res.status(200).json({ message: "Task Declined", task });
//     } catch (error) {
//         console.error("Error declining task:", error);
//         res.status(500).json({ error: "Failed to decline task", details: error.message });
//     }
// };

export const requestCompletionByTasker = async (req, res) => {
    const { id: taskId } = req.params;

    try {
        const task = await Task.findById(taskId);
        if (!task) {
            // ✅ Log failed completion request - task not found
            await logTaskCompletion({
                action: "COMPLETION_REQUESTED",
                user: req.user,
                req,
                taskId,
                status: "failure",
                metadata: {
                    errorMessage: "Task not found",
                    errorCode: "TASK_NOT_FOUND",
                },
            });

            return res.status(404).json({ error: "Task not found" });
        }

        if (task.status !== "in progress") {
            // ✅ Log failed completion request - wrong status
            await logTaskCompletion({
                action: "COMPLETION_REQUESTED",
                user: req.user,
                req,
                taskId: task._id.toString(),
                taskTitle: task.taskTitle,
                status: "failure",
                metadata: {
                    errorMessage: "Task is not in progress",
                    errorCode: "INVALID_STATUS",
                    currentStatus: task.status,
                },
            });

            return res.status(400).json({ error: "Task is not in progress" });
        }

        // Check if the requester is the assigned tasker
        if (task.acceptedBy?.toString() !== req.user.id) {
            await logTaskCompletion({
                action: "COMPLETION_REQUESTED",
                user: req.user,
                req,
                taskId: task._id.toString(),
                taskTitle: task.taskTitle,
                status: "failure",
                metadata: {
                    errorMessage: "Unauthorized - not the assigned tasker",
                    errorCode: "UNAUTHORIZED",
                    assignedTaskerId: task.acceptedBy?.toString(),
                    requesterId: req.user.id,
                },
            });

            return res.status(403).json({ error: "You are not authorized to request completion for this task" });
        }

        const previousStatus = task.status;
        task.status = "requested";
        task.completionRequestedAt = new Date();
        await task.save();

        // Get tasker details
        const tasker = await User.findById(req.user.id).select("firstName lastName email");
        const taskerName = tasker ? `${tasker.firstName} ${tasker.lastName}` : "The tasker";

        // ✅ Log successful completion request
        await logTaskCompletion({
            action: "COMPLETION_REQUESTED",
            user: { ...req.user, ...tasker?.toObject() },
            req,
            taskId: task._id.toString(),
            taskTitle: task.taskTitle,
            taskerId: req.user.id,
            taskerName,
            clientId: task.client.toString(),
            amount: task.totalAmount,
            status: "success",
            metadata: {
                previousStatus,
                newStatus: "requested",
                completionRequestedAt: task.completionRequestedAt,
                serviceTitle: task.serviceTitle,
                taskerEmail: tasker?.email,
                paymentIntentId: task.paymentIntentId,
            },
        });

        // Notify the client
        try {
            console.log("Creating completion request notification:", {
                clientId: task.client,
                taskerName,
                taskTitle: task.taskTitle,
                taskId: task._id
            });

            await createNotification(
                task.client,
                "Completion Requested",
                `${taskerName} has requested completion for "${task.taskTitle}". Please review the work and approve to release payment.`,
                "completion-requested",
                task._id
            );
            console.log("✅ Notification created for client - completion request");

        } catch (notifErr) {
            console.error("❌ Failed to create client notification (non-blocking):", notifErr);
        }

        // Confirmation notification to tasker
        try {
            await createNotification(
                req.user.id,
                "Completion Request Sent",
                `Your completion request for "${task.taskTitle}" has been sent to the client. Waiting for approval.`,
                "completion-request-sent",
                task._id
            );
            console.log("✅ Confirmation notification sent to tasker");
        } catch (notifErr) {
            console.error("❌ Failed to create tasker confirmation notification:", notifErr);
        }

        res.status(200).json({ message: "Completion requested", task });
    } catch (error) {
        console.error("Error requesting completion:", error);

        // ✅ Log unexpected error
        await logTaskCompletion({
            action: "COMPLETION_REQUESTED",
            user: req.user,
            req,
            taskId,
            status: "failure",
            metadata: {
                errorMessage: error.message,
                errorName: error.name,
                errorStack: error.stack?.substring(0, 500),
            },
        });

        res.status(500).json({ error: "Failed to request completion", details: error.message });
    }
};



export const declineByTasker = async (req, res) => {
    try {
        const { id: taskId } = req.params;

        const task = await Task.findById(taskId);
        if (!task) return res.status(404).json({ error: "Task not found" });

        if (task.status !== "in progress") {
            return res.status(400).json({ error: "Task is not in progress" });
        }

        const previousStripeStatus = task.stripeStatus;
        const previousAcceptedBy = task.acceptedBy; // Store before clearing

        task.status = "pending";
        task.acceptedBy = null; // Clear the assigned tasker so task can be reassigned

        if (task.paymentIntentId && task.stripeStatus === 'authorized') {
            const paymentIntent = await stripe.paymentIntents.cancel(task.paymentIntentId);
            if (paymentIntent.status === 'canceled') {
                task.stripeStatus = 'canceled';
                task.paymentIntentId = null; // Clear the payment intent
            } else {
                return res.status(400).json({ message: 'Cancellation failed on decline' });
            }
        }
        await task.save();

        // FIX: Get tasker details from database to ensure we have the name
        const tasker = await User.findById(req.user.id).select("firstName lastName");

        if (!tasker) {
            console.error("Tasker not found for notification");
        }

        const taskerName = tasker
            ? `${tasker.firstName} ${tasker.lastName}`
            : "The tasker";

        // Build payment status message
        let paymentMessage = "";
        if (previousStripeStatus === 'authorized') {
            paymentMessage = " The payment hold has been canceled and funds have been released.";
        }

        // Create notification for the client (task declined) - non-blocking
        try {
            // Debug: Log notification details
            console.log("Creating task decline notification:", {
                clientId: task.client,
                taskerName,
                taskTitle: task.taskTitle,
                taskId: task._id,
                previousStripeStatus
            });

            await createNotification(
                task.client, // Client ID (task owner)
                "Task Declined by Tasker",
                `${taskerName} has declined to continue with "${task.taskTitle}".${paymentMessage} Your task is now available for other taskers to accept.`,
                "task-declined",
                task._id
            );
            console.log("✅ Notification created for client - task decline");

        } catch (notifErr) {
            console.error("❌ Failed to create client notification (non-blocking):", notifErr);
        }

        // Send confirmation notification to tasker
        try {
            await createNotification(
                req.user.id, // Tasker ID
                "Task Declined Successfully",
                `You have declined the task "${task.taskTitle}". The client has been notified and the task is now available for other taskers.`,
                "task-decline-confirmed",
                task._id
            );
            console.log("✅ Confirmation notification sent to tasker");

        } catch (notifErr) {
            console.error("❌ Failed to create tasker confirmation notification:", notifErr);
        }

        // Optional: Notify other taskers who previously bid on this task
        try {
            if (task.bids && task.bids.length > 0) {
                // Get unique tasker IDs from bids (excluding the one who just declined)
                const otherBidderIds = [...new Set(
                    task.bids
                        .map(bid => bid.taskerId.toString())
                        .filter(id => id !== req.user.id)
                )];

                // Debug: Log other bidders
                console.log("Notifying other bidders:", otherBidderIds);

                // Send notification to each previous bidder
                for (const bidderId of otherBidderIds) {
                    await createNotification(
                        bidderId,
                        "Task Available Again",
                        `The task "${task.taskTitle}" is available again! The previous tasker has declined. Your bid is still active.`,
                        "task-available-again",
                        task._id
                    );
                }
                console.log(`✅ Notified ${otherBidderIds.length} previous bidders`);
            }
        } catch (notifErr) {
            console.error("❌ Failed to notify other bidders (non-blocking):", notifErr);
        }

        res.status(200).json({ message: "Task Declined", task });
    } catch (error) {
        console.error("Error declining task:", error);
        res.status(500).json({ error: "Failed to decline task", details: error.message });
    }
};



// Reply to comment
export const replyToComment = async (req, res) => {
    try {
        const { taskId, commentId } = req.params;
        const { message } = req.body;

        const task = await Task.findById(taskId);
        if (!task) return res.status(404).json({ error: "Task not found" });

        const comment = task.comments.id(commentId);
        if (!comment) return res.status(404).json({ error: "Comment not found" });

        const reply = {
            userId: req.user.id,
            role: req.user.currentRole, // "client" or "tasker"
            message,
            createdAt: new Date(),
        };

        comment.replies.push(reply);
        await task.save();

        // Create notification for the comment owner (new reply) - non-blocking
        try {
            const commenter = await User.findById(comment.userId).select("firstName lastName profilePicture");
            await createNotification(
                comment.userId, // Comment owner ID
                "New Reply to Your Comment",
                `"${req.user.firstName} ${req.user.lastName}" replied to your comment on "${task.taskTitle}": "${message.substring(0, 50)}..."`,
                "new-reply",
                task._id // Link to task
            );
            console.log("Notification created for new reply"); // Debug
        } catch (notifErr) {
            console.error("Failed to create notification (non-blocking):", notifErr); // Log but don't crash
        }

        res.status(200).json({ message: "Reply added", task });
    } catch (error) {

        console.error("Error replying to comment:", error);
        res.status(500).json({ error: "Failed to reply", details: error.message });
    }
};

// code of marks as read messages

// controllers/messageController.js

// controllers/messageController.js

/**
 * Mark messages as read - New simplified logic
 * Only marks messages from OTHER users as read (not your own messages)
 */
// controllers/messageController.js

export const markMessagesAsRead = async (req, res) => {
    // Return immediately for testing
    try {
        // Step 1: Log and validate
        const taskId = req.params.taskId;
        const userId = req.user?.id || req.user?._id;

        console.log(req)

        if (!taskId) {
            return res.status(400).json({ success: false, error: 'No taskId' });
        }

        if (!userId) {
            return res.status(401).json({ success: false, error: 'No userId' });
        }

        // Step 2: Import mongoose
        const mongoose = await import('mongoose');

        // Step 3: Validate ObjectId
        if (!mongoose.default.Types.ObjectId.isValid(taskId)) {
            return res.status(400).json({ success: false, error: 'Invalid taskId' });
        }

        // Step 4: Import Task model

        // Step 5: Direct MongoDB update using native driver
        // This bypasses Mongoose validation issues
        const result = await Task.collection.updateOne(
            { _id: new mongoose.default.Types.ObjectId(taskId) },
            {
                $set: {
                    'messages.$[elem].isRead': true,
                    'messages.$[elem].readAt': new Date()
                }
            },
            {
                arrayFilters: [
                    {
                        'elem.sender': { $ne: new mongoose.default.Types.ObjectId(userId) },
                        'elem.isRead': false
                    }
                ]
            }
        );

        return res.status(200).json({
            success: true,
            modifiedCount: result.modifiedCount,
            matchedCount: result.matchedCount
        });

    } catch (error) {
        console.error('markMessagesAsRead error:', error);
        return res.status(500).json({
            success: false,
            error: error.message,
            name: error.name
        });
    }
};

/**
 * Alternative: Mark messages as read using simple loop
 * Use this if the arrayFilters approach doesn't work
 */
export const markMessagesAsReadSimple = async (req, res) => {
    try {
        const { taskId } = req.params;
        const userId = req.user?.id || req.user?._id;

        if (!taskId || !userId) {
            return res.status(400).json({
                success: false,
                error: 'Missing taskId or userId'
            });
        }

        // Find the task with messages
        const task = await Task.findById(taskId).select('messages');

        if (!task) {
            return res.status(404).json({
                success: false,
                error: 'Task not found'
            });
        }

        if (!task.messages || task.messages.length === 0) {
            return res.status(200).json({
                success: true,
                updatedCount: 0,
                message: 'No messages to mark as read'
            });
        }

        const userIdStr = userId.toString();
        const now = new Date();
        const updateOperations = {};
        let updateCount = 0;

        // Build update operations for each message
        task.messages.forEach((msg, index) => {
            // Get sender ID as string
            const senderId = msg.sender?._id?.toString() || msg.sender?.toString();

            // Only mark as read if:
            // 1. Message is from someone else (not me)
            // 2. Message is not already read
            if (senderId && senderId !== userIdStr && msg.isRead === false) {
                updateOperations[`messages.${index}.isRead`] = true;
                updateOperations[`messages.${index}.readAt`] = now;
                updateCount++;
            }
        });

        // Apply updates if any
        if (updateCount > 0) {
            await Task.updateOne(
                { _id: taskId },
                { $set: updateOperations }
            );
        }

        return res.status(200).json({
            success: true,
            updatedCount: updateCount,
            message: `${updateCount} messages marked as read`
        });

    } catch (error) {
        console.error('markMessagesAsReadSimple error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to mark messages as read',
            details: error.message
        });
    }
};

/**
 * Get unread message count for a user in a task
 */
export const getUnreadCount = async (req, res) => {
    try {
        const { taskId } = req.params;
        const userId = req.user?.id || req.user?._id;

        if (!taskId || !userId) {
            return res.status(400).json({
                success: false,
                error: 'Missing taskId or userId'
            });
        }

        const task = await Task.findById(taskId).select('messages').lean();

        if (!task) {
            return res.status(404).json({
                success: false,
                error: 'Task not found'
            });
        }

        const userIdStr = userId.toString();
        let unreadCount = 0;

        (task.messages || []).forEach(msg => {
            const senderId = msg.sender?._id?.toString() || msg.sender?.toString();
            // Count unread messages from others
            if (senderId && senderId !== userIdStr && msg.isRead === false) {
                unreadCount++;
            }
        });

        return res.status(200).json({
            success: true,
            unreadCount,
            totalMessages: task.messages?.length || 0
        });

    } catch (error) {
        console.error('getUnreadCount error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to get unread count',
            details: error.message
        });
    }
};
// In your routes file






// controllers/taskController.js

// export const updateTaskStatusByClient = async (req, res) => {
//     try {
//         const { taskId } = req.params;
//         const { status } = req.body;

//         if (!["completed", "not completed"].includes(status)) {
//             return res.status(400).json({ error: "Invalid status value" });
//         }

//         const task = await Task.findById(taskId).populate('acceptedBy');
//         if (!task) return res.status(404).json({ error: "Task not found" });

//         if (task.client.toString() !== req.user.id) {
//             return res.status(403).json({ error: "You are not authorized to update this task status" });
//         }

//         const previousStatus = task.status;
//         task.status = status;

//         let stripeActionMsg = '';
//         const paymentAmount = task.totalAmount ? (task.totalAmount / 100).toFixed(2) : '0.00';

//         // ⭐ NEW: Get payment breakdown from task
//         const platformFee = task.payment?.platformFee || 0;
//         const taskerPayout = task.payment?.taskerPayout || 0;
//         const taskerPayoutFormatted = (taskerPayout / 100).toFixed(2);

//         const paymentIntentId = task.payment?.paymentIntentId || task.paymentIntentId;

//         if (paymentIntentId) {
//             if (status === "completed") {
//                 // ⭐ Capture the payment - Stripe automatically splits it!
//                 const paymentIntent = await stripe.paymentIntents.capture(paymentIntentId);

//                 if (paymentIntent.status === 'succeeded') {
//                     task.stripeStatus = 'captured';
//                     task.payment.status = 'captured';
//                     task.payment.capturedAt = new Date();

//                     // ⭐ The split happens automatically!
//                     // - $platformFee goes to your Stripe account
//                     // - $taskerPayout goes to tasker's connected account
//                     // - Stripe then auto-deposits to tasker's bank

//                     stripeActionMsg = `Payment of $${paymentAmount} has been captured. $${taskerPayoutFormatted} will be transferred to your account automatically.`;

//                     console.log("✅ Payment captured with automatic split:");
//                     console.log("  Platform Fee:", platformFee / 100);
//                     console.log("  Tasker Payout:", taskerPayout / 100);

//                 } else {
//                     return res.status(400).json({ message: 'Capture failed' });
//                 }

//             } else if (status === "not completed") {
//                 // Cancel and release hold
//                 const paymentIntent = await stripe.paymentIntents.cancel(paymentIntentId);

//                 if (paymentIntent.status === 'canceled') {
//                     task.stripeStatus = 'canceled';
//                     task.payment.status = 'cancelled';
//                     stripeActionMsg = 'The payment hold has been canceled and funds released.';
//                 } else {
//                     return res.status(400).json({ message: 'Cancellation failed' });
//                 }
//             }
//         }

//         await task.save();

//         // ⭐ Update tasker stats with earnings
//         if (status === "completed") {
//             const taskerId = task.acceptedBy?._id || task.acceptedBy;
//             await User.findByIdAndUpdate(taskerId, {
//                 $inc: {
//                     'stats.tasksCompleted': 1,
//                     'stats.totalEarnings': taskerPayout, // in cents
//                 }
//             });
//         }

//         // Notifications (your existing code with updated message)
//         const client = await User.findById(req.user.id).select("firstName lastName");
//         const clientName = client ? `${client.firstName} ${client.lastName}` : "The client";
//         const taskerId = task.acceptedBy?._id || task.acceptedBy;

//         try {
//             if (taskerId) {
//                 if (status === "completed") {
//                     await createNotification(
//                         taskerId,
//                         "🎉 Task Completed - Payment Released!",
//                         `${clientName} has approved your work for "${task.taskTitle}". $${taskerPayoutFormatted} has been released to your account and will be deposited to your bank automatically.`,
//                         "task-completed",
//                         task._id
//                     );
//                 } else if (status === "not completed") {
//                     await createNotification(
//                         taskerId,
//                         "Task Marked as Not Completed",
//                         `${clientName} has marked "${task.taskTitle}" as not completed. ${stripeActionMsg} Please contact the client for more details.`,
//                         "completion-declined",
//                         task._id
//                     );
//                 }
//             }
//         } catch (notifErr) {
//             console.error("❌ Failed to create tasker notification:", notifErr);
//         }

//         // Client notification
//         try {
//             let clientMsg = status === "completed"
//                 ? `You have approved the completion of "${task.taskTitle}". Payment of $${paymentAmount} has been processed.`
//                 : `You have marked "${task.taskTitle}" as not completed. ${stripeActionMsg}`;

//             await createNotification(
//                 req.user.id,
//                 status === "completed" ? "Task Approved Successfully" : "Task Marked as Incomplete",
//                 clientMsg,
//                 "status-update-confirmed",
//                 task._id
//             );
//         } catch (notifErr) {
//             console.error("❌ Failed to create client notification:", notifErr);
//         }

//         res.status(200).json({
//             message: `Task marked as ${status}`,
//             task,
//             paymentInfo: status === "completed" ? {
//                 captured: paymentAmount,
//                 platformFee: platformFee / 100,
//                 taskerPayout: taskerPayoutFormatted,
//             } : null
//         });

//     } catch (error) {
//         console.error("Error updating task status:", error);
//         res.status(500).json({ error: "Failed to update status", details: error.message });
//     }
// };

export const updateTaskStatusByClient = async (req, res) => {
    const { taskId } = req.params;
    const { status } = req.body;

    try {
        if (!["completed", "not completed"].includes(status)) {
            // ✅ Log invalid status
            await logTaskCompletion({
                action: status === "completed" ? "COMPLETION_APPROVED" : "COMPLETION_REJECTED",
                user: req.user,
                req,
                taskId,
                status: "failure",
                metadata: {
                    errorMessage: "Invalid status value",
                    errorCode: "INVALID_STATUS",
                    providedStatus: status,
                },
            });

            return res.status(400).json({ error: "Invalid status value" });
        }

        const task = await Task.findById(taskId).populate('acceptedBy');
        if (!task) {
            await logTaskCompletion({
                action: status === "completed" ? "COMPLETION_APPROVED" : "COMPLETION_REJECTED",
                user: req.user,
                req,
                taskId,
                status: "failure",
                metadata: {
                    errorMessage: "Task not found",
                    errorCode: "TASK_NOT_FOUND",
                },
            });

            return res.status(404).json({ error: "Task not found" });
        }

        if (task.client.toString() !== req.user.id) {
            await logTaskCompletion({
                action: status === "completed" ? "COMPLETION_APPROVED" : "COMPLETION_REJECTED",
                user: req.user,
                req,
                taskId: task._id.toString(),
                taskTitle: task.taskTitle,
                status: "failure",
                metadata: {
                    errorMessage: "Unauthorized - not the task owner",
                    errorCode: "UNAUTHORIZED",
                    taskOwnerId: task.client.toString(),
                    requesterId: req.user.id,
                },
            });

            return res.status(403).json({ error: "You are not authorized to update this task status" });
        }

        const previousStatus = task.status;
        task.status = status;

        let stripeActionMsg = '';
        const paymentAmount = task.totalAmount ? (task.totalAmount / 100).toFixed(2) : '0.00';

        // Get payment breakdown
        const platformFee = task.payment?.platformFee || task.payment?.applicationFee || 0;
        const taskerPayout = task.payment?.taskerPayout || task.payment?.taskerPayoutCents || 0;
        const taskerPayoutFormatted = (taskerPayout / 100).toFixed(2);

        const paymentIntentId = task.payment?.paymentIntentId || task.paymentIntentId;

        // Get client details
        const client = await User.findById(req.user.id).select("firstName lastName email");
        const clientName = client ? `${client.firstName} ${client.lastName}` : "The client";

        // Get tasker details
        const taskerId = task.acceptedBy?._id || task.acceptedBy;
        const taskerUser = typeof task.acceptedBy === 'object' ? task.acceptedBy : await User.findById(taskerId);
        const taskerName = taskerUser ? `${taskerUser.firstName} ${taskerUser.lastName}` : "The tasker";

        if (paymentIntentId) {
            if (status === "completed") {
                try {
                    // Capture the payment
                    const paymentIntent = await stripe.paymentIntents.capture(paymentIntentId);

                    if (paymentIntent.status === 'succeeded') {
                        task.stripeStatus = 'captured';
                        task.payment.status = 'captured';
                        task.payment.capturedAt = new Date();

                        stripeActionMsg = `Payment of $${paymentAmount} has been captured. $${taskerPayoutFormatted} will be transferred to tasker's account.`;

                        // ✅ Log successful payment capture
                        await logPayment({
                            action: "PAYMENT_CAPTURED",
                            user: { ...req.user, ...client?.toObject() },
                            req,
                            taskId: task._id.toString(),
                            taskTitle: task.taskTitle,
                            amount: task.totalAmount,
                            paymentIntentId,
                            status: "success",
                            metadata: {
                                platformFee: platformFee / 100,
                                taskerPayout: taskerPayout / 100,
                                taskerId: taskerId?.toString(),
                                taskerName,
                                capturedAt: task.payment.capturedAt,
                            },
                        });

                        console.log("✅ Payment captured with automatic split:");
                        console.log("  Platform Fee:", platformFee / 100);
                        console.log("  Tasker Payout:", taskerPayout / 100);

                    } else {
                        // ✅ Log failed payment capture
                        await logPayment({
                            action: "PAYMENT_CAPTURED",
                            user: { ...req.user, ...client?.toObject() },
                            req,
                            taskId: task._id.toString(),
                            taskTitle: task.taskTitle,
                            amount: task.totalAmount,
                            paymentIntentId,
                            status: "failure",
                            metadata: {
                                errorMessage: "Capture returned non-succeeded status",
                                paymentStatus: paymentIntent.status,
                            },
                        });

                        return res.status(400).json({ message: 'Capture failed' });
                    }
                } catch (stripeError) {
                    // ✅ Log Stripe error during capture
                    await logPayment({
                        action: "PAYMENT_CAPTURED",
                        user: { ...req.user, ...client?.toObject() },
                        req,
                        taskId: task._id.toString(),
                        taskTitle: task.taskTitle,
                        amount: task.totalAmount,
                        paymentIntentId,
                        status: "failure",
                        metadata: {
                            errorMessage: stripeError.message,
                            stripeErrorCode: stripeError.code,
                        },
                    });

                    return res.status(400).json({
                        message: 'Payment capture failed',
                        error: stripeError.message
                    });
                }

            } else if (status === "not completed") {
                try {
                    // Cancel and release hold
                    const paymentIntent = await stripe.paymentIntents.cancel(paymentIntentId);

                    if (paymentIntent.status === 'canceled') {
                        task.stripeStatus = 'canceled';
                        task.payment.status = 'cancelled';
                        task.payment.cancelledAt = new Date();
                        stripeActionMsg = 'The payment hold has been canceled and funds released.';

                        // ✅ Log payment cancellation
                        await logPayment({
                            action: "PAYMENT_FAILED",
                            user: { ...req.user, ...client?.toObject() },
                            req,
                            taskId: task._id.toString(),
                            taskTitle: task.taskTitle,
                            amount: task.totalAmount,
                            paymentIntentId,
                            status: "success",
                            metadata: {
                                reason: "Task marked as not completed by client",
                                cancelledAt: task.payment.cancelledAt,
                                taskerId: taskerId?.toString(),
                            },
                        });

                    } else {
                        return res.status(400).json({ message: 'Cancellation failed' });
                    }
                } catch (stripeError) {
                    // ✅ Log Stripe error during cancellation
                    await logPayment({
                        action: "PAYMENT_FAILED",
                        user: { ...req.user, ...client?.toObject() },
                        req,
                        taskId: task._id.toString(),
                        taskTitle: task.taskTitle,
                        amount: task.totalAmount,
                        paymentIntentId,
                        status: "failure",
                        metadata: {
                            errorMessage: stripeError.message,
                            stripeErrorCode: stripeError.code,
                            action: "cancel",
                        },
                    });

                    return res.status(400).json({
                        message: 'Payment cancellation failed',
                        error: stripeError.message
                    });
                }
            }
        }

        task.completedAt = status === "completed" ? new Date() : null;
        await task.save();

        // Update tasker stats with earnings
        if (status === "completed") {
            await User.findByIdAndUpdate(taskerId, {
                $inc: {
                    'stats.tasksCompleted': 1,
                    'stats.totalEarnings': taskerPayout,
                }
            });
        }

        // ✅ Log successful task completion/rejection
        await logTaskCompletion({
            action: status === "completed" ? "TASK_COMPLETED" : "TASK_NOT_COMPLETED",
            user: { ...req.user, ...client?.toObject() },
            req,
            taskId: task._id.toString(),
            taskTitle: task.taskTitle,
            taskerId: taskerId?.toString(),
            taskerName,
            clientId: req.user.id,
            clientName,
            amount: task.totalAmount,
            status: "success",
            metadata: {
                previousStatus,
                newStatus: status,
                paymentIntentId,
                paymentStatus: task.payment?.status,
                platformFee: platformFee / 100,
                taskerPayout: taskerPayout / 100,
                totalClientPaid: task.payment?.totalClientPays,
                serviceTitle: task.serviceTitle,
                completedAt: task.completedAt,
                taskerEmail: taskerUser?.email,
                clientEmail: client?.email,
            },
        });

        // Notifications
        try {
            if (taskerId) {
                if (status === "completed") {
                    await createNotification(
                        taskerId,
                        "🎉 Task Completed - Payment Released!",
                        `${clientName} has approved your work for "${task.taskTitle}". $${taskerPayoutFormatted} has been released to your account and will be deposited to your bank automatically.`,
                        "task-completed",
                        task._id
                    );
                } else if (status === "not completed") {
                    await createNotification(
                        taskerId,
                        "Task Marked as Not Completed",
                        `${clientName} has marked "${task.taskTitle}" as not completed. ${stripeActionMsg} Please contact the client for more details.`,
                        "completion-declined",
                        task._id
                    );
                }
            }
        } catch (notifErr) {
            console.error("❌ Failed to create tasker notification:", notifErr);
        }

        // Client notification
        try {
            let clientMsg = status === "completed"
                ? `You have approved the completion of "${task.taskTitle}". Payment of $${paymentAmount} has been processed.`
                : `You have marked "${task.taskTitle}" as not completed. ${stripeActionMsg}`;

            await createNotification(
                req.user.id,
                status === "completed" ? "Task Approved Successfully" : "Task Marked as Incomplete",
                clientMsg,
                "status-update-confirmed",
                task._id
            );
        } catch (notifErr) {
            console.error("❌ Failed to create client notification:", notifErr);
        }

        res.status(200).json({
            message: `Task marked as ${status}`,
            task,
            paymentInfo: status === "completed" ? {
                captured: paymentAmount,
                platformFee: platformFee / 100,
                taskerPayout: taskerPayoutFormatted,
            } : null
        });

    } catch (error) {
        console.error("Error updating task status:", error);

        // ✅ Log unexpected error
        await logTaskCompletion({
            action: status === "completed" ? "TASK_COMPLETED" : "TASK_NOT_COMPLETED",
            user: req.user,
            req,
            taskId,
            status: "failure",
            metadata: {
                errorMessage: error.message,
                errorName: error.name,
                errorStack: error.stack?.substring(0, 500),
                attemptedStatus: status,
            },
        });

        res.status(500).json({ error: "Failed to update status", details: error.message });
    }
};

// code of update messages 

export const updateMessage = async (req, res) => {
    try {
        const { taskId, messageId } = req.params;
        const { message } = req.body;
        const userId = req.user.id;

        if (!message || message.trim() === "") {
            return res.status(400).json({ error: "Message cannot be empty" });
        }

        const task = await Task.findById(taskId);
        if (!task) return res.status(404).json({ error: "Task not found" });

        const msg = task.messages.id(messageId);
        if (!msg) return res.status(404).json({ error: "Message not found" });

        // Only sender can edit their message
        if (msg.sender.toString() !== userId) {
            return res.status(403).json({ error: "You can only edit your own messages" });
        }

        // Optional: Don't allow editing after 15 minutes
        const timeDiff = (Date.now() - msg.createdAt) / (1000 * 60);
        if (timeDiff > 15) {
            return res.status(400).json({ error: "You can no longer edit this message" });
        }

        msg.message = message.trim();
        msg.edited = true; // optional flag if you want to show "edited"

        await task.save();

        res.status(200).json({ message: "Message updated", updatedMessage: msg });
    } catch (error) {
        console.error("Error updating message:", error);
        res.status(500).json({ error: "Failed to update message" });
    }
};





// ✅ 8. Update Task (Only by Client)
// export const updateTask = async (req, res) => {
//     try {
//         const taskId = req.params.id;

//         const task = await Task.findById(taskId);
//         if (!task) return res.status(404).json({ error: "Task not found" });

//         // if (task.client.toString() !== req.user.id) {
//         //     return res.status(403).json({ error: "Unauthorized to update this task" });
//         // }

//         const updatedTask = await Task.findByIdAndUpdate(taskId, req.body, { new: true });
//         res.status(200).json({ message: "Task updated", task: updatedTask });

//     } catch (error) {
//         res.status(500).json({ error: "Failed to update task", details: error.message });
//     }
// };

// // ✅ 9. Delete Task (Only by Client)
// export const deleteTask = async (req, res) => {
//     try {
//         const taskId = req.params.id;
//         const task = await Task.findById(taskId);
//         if (!task) return res.status(404).json({ error: "Task not found" });
//         if (task.client.toString() !== req.user.id) {
//             return res.status(403).json({ error: "Unauthorized to delete this task" });
//         }

//         await Task.findByIdAndDelete(taskId);
//         res.status(200).json({ message: "Task deleted successfully" });
//     } catch (error) {
//         res.status(500).json({ error: "Failed to delete task", details: error.message });
//     }
// };

export const updateTask = async (req, res) => {
    try {
        const taskId = req.params.id;

        const task = await Task.findById(taskId);
        if (!task) return res.status(404).json({ error: "Task not found" });

        // if (task.client.toString() !== req.user.id) {
        //     return res.status(403).json({ error: "Unauthorized to update this task" });
        // }

        const updatedTask = await Task.findByIdAndUpdate(taskId, req.body, { new: true });

        // Create notification for the tasker (task updated) - non-blocking
        if (updatedTask.acceptedBy) { // Only if a tasker is assigned
            try {
                const client = await User.findById(req.user.id).select("firstName lastName");
                await createNotification(
                    updatedTask.acceptedBy, // Tasker ID
                    "Task Updated",
                    `Client "${client.firstName} ${client.lastName}" has updated "${updatedTask.taskTitle}". Check the changes.`,
                    "task-updated",
                    updatedTask._id // Link to task
                );
                console.log("Notification created for task update"); // Debug
            } catch (notifErr) {
                console.error("Failed to create notification (non-blocking):", notifErr); // Log but don't crash
            }
        }

        res.status(200).json({ message: "Task updated", task: updatedTask });
    } catch (error) {
        console.error("Error updating task:", error);
        res.status(500).json({ error: "Failed to update task", details: error.message });
    }
};

// Delete task
// export const deleteTask = async (req, res) => {
//     try {
//         const taskId = req.params.id;
//         const task = await Task.findById(taskId);
//         if (!task) return res.status(404).json({ error: "Task not found" });
//         if (task.client.toString() !== req.user.id) {
//             return res.status(403).json({ error: "Unauthorized to delete this task" });
//         }

//         const deletedTask = await Task.findByIdAndDelete(taskId);

//         // Create notification for the tasker (if assigned) - non-blocking
//         if (task.acceptedBy) { // Only if a tasker was assigned
//             try {
//                 const client = await User.findById(req.user.id).select("firstName lastName");
//                 await createNotification(
//                     task.acceptedBy, // Tasker ID
//                     "Task Deleted",
//                     `Client "${client.firstName} ${client.lastName}" has deleted "${task.taskTitle}".`,
//                     "task-deleted",
//                     taskId // Link to task (even if deleted)
//                 );
//                 console.log("Notification created for task deletion"); // Debug
//             } catch (notifErr) {
//                 console.error("Failed to create notification (non-blocking):", notifErr); // Log but don't crash
//             }
//         }

//         res.status(200).json({ message: "Task deleted successfully" });
//     } catch (error) {
//         console.error("Error deleting task:", error);
//         res.status(500).json({ error: "Failed to delete task", details: error.message });
//     }
// };

export const deleteTask = async (req, res) => {
    try {
        const taskId = req.params.id;
        const task = await Task.findById(taskId);
        if (!task) return res.status(404).json({ error: "Task not found" });

        if (task.client.toString() !== req.user.id) {
            return res.status(403).json({ error: "Unauthorized to delete this task" });
        }

        // Store task details before deletion for notifications
        const taskTitle = task.taskTitle;
        const taskAcceptedBy = task.acceptedBy;
        const taskBids = task.bids || [];

        // FIX: Cancel payment hold if exists before deleting
        if (task.paymentIntentId && task.stripeStatus === 'authorized') {
            try {
                await stripe.paymentIntents.cancel(task.paymentIntentId);
                console.log("✅ Payment hold canceled for deleted task");
            } catch (stripeErr) {
                console.error("❌ Failed to cancel payment hold:", stripeErr);
                // Continue with deletion even if stripe fails
            }
        }

        // Delete the task
        await Task.findByIdAndDelete(taskId);

        // FIX: Get client details from database
        const client = await User.findById(req.user.id).select("firstName lastName");
        const clientName = client
            ? `${client.firstName} ${client.lastName}`
            : "The client";

        // Create notification for the assigned tasker (if exists)
        if (taskAcceptedBy) {
            try {
                // Debug: Log notification details
                console.log("Creating task deleted notification for assigned tasker:", {
                    taskerId: taskAcceptedBy,
                    clientName,
                    taskTitle
                });

                await createNotification(
                    taskAcceptedBy, // Tasker ID
                    "Task Has Been Deleted",
                    `${clientName} has deleted the task "${taskTitle}" that was assigned to you. Any payment hold has been released. We apologize for the inconvenience.`,
                    "task-deleted",
                    taskId
                );
                console.log("✅ Notification created for assigned tasker - task deleted");

            } catch (notifErr) {
                console.error("❌ Failed to create tasker notification (non-blocking):", notifErr);
            }
        }

        // Notify all bidders that the task has been deleted
        try {
            if (taskBids.length > 0) {
                // Get unique tasker IDs from bids (excluding the assigned tasker if any)
                const bidderIds = [...new Set(
                    taskBids
                        .map(bid => bid.taskerId.toString())
                        .filter(id => id !== (taskAcceptedBy ? taskAcceptedBy.toString() : ''))
                )];

                console.log("Notifying bidders about task deletion:", bidderIds);

                for (const bidderId of bidderIds) {
                    await createNotification(
                        bidderId,
                        "Task Deleted",
                        `The task "${taskTitle}" that you bid on has been deleted by the client. Keep looking for other opportunities!`,
                        "task-deleted-bidder",
                        taskId
                    );
                }
                console.log(`✅ Notified ${bidderIds.length} bidders about task deletion`);
            }
        } catch (notifErr) {
            console.error("❌ Failed to notify bidders (non-blocking):", notifErr);
        }

        // Send confirmation notification to client
        try {
            await createNotification(
                req.user.id, // Client ID
                "Task Deleted Successfully",
                `Your task "${taskTitle}" has been deleted successfully.${task.paymentIntentId ? ' Any payment hold has been released.' : ''}`,
                "task-delete-confirmed",
                taskId
            );
            console.log("✅ Confirmation notification sent to client");

        } catch (notifErr) {
            console.error("❌ Failed to create client confirmation notification:", notifErr);
        }

        res.status(200).json({ message: "Task deleted successfully" });
    } catch (error) {
        console.error("Error deleting task:", error);
        res.status(500).json({ error: "Failed to delete task", details: error.message });
    }
};

// auto delete
// Helper function to delete task (used by both API and cron job)
export const deleteTaskById = async (taskId, userId = null) => {
    const task = await Task.findById(taskId);
    if (!task) return false;

    // ✅ Only delete if task is NOT accepted/in-progress/completed
    if (task.status === 'accepted' || task.status === 'in-progress' || task.status === 'completed') {
        console.log(`[CRON] ⏭️ Skipping task "${task.taskTitle}" - Status: ${task.status}`);
        return false;
    }

    const taskTitle = task.taskTitle;
    const taskBids = task.bids || [];
    const clientId = task.client;

    // Cancel payment hold if exists
    if (task.paymentIntentId && task.stripeStatus === 'authorized') {
        try {
            await stripe.paymentIntents.cancel(task.paymentIntentId);
            console.log("✅ Payment hold canceled for expired task");
        } catch (stripeErr) {
            console.error("❌ Failed to cancel payment hold:", stripeErr);
        }
    }

    // Delete the task
    await Task.findByIdAndDelete(taskId);

    // Get client details
    const client = await User.findById(clientId).select("firstName lastName");
    const clientName = client ? `${client.firstName} ${client.lastName}` : "The client";

    // Notify all bidders
    if (taskBids.length > 0) {
        const bidderIds = [...new Set(
            taskBids.map(bid => bid.taskerId.toString())
        )];

        for (const bidderId of bidderIds) {
            try {
                await createNotification(
                    bidderId,
                    "Task Expired",
                    `The task "${taskTitle}" that you bid on has expired.`,
                    "task-expired-bidder",
                    taskId
                );
            } catch (err) {
                console.error("Notification error:", err);
            }
        }
    }

    // Notify client
    try {
        await createNotification(
            clientId,
            "Task Expired",
            `Your task "${taskTitle}" has expired and been removed.${task.paymentIntentId ? ' Any payment hold has been released.' : ''}`,
            "task-expired-client",
            taskId
        );
    } catch (err) {
        console.error("Notification error:", err);
    }

    return true;
};

// Delete task controller
export const deleteTaskAdnmin = async (req, res) => {
    try {
        const { id } = req.params;

        console.log(id)
        // Validate ObjectId
        if (!id.match(/^[0-9a-fA-F]{24}$/)) {
            return res.status(400).json({ error: "Invalid task ID" });
        }

        const deletedTask = await Task.findByIdAndDelete(id);

        if (!deletedTask) {
            return res.status(404).json({ error: "Task not found" });
        }

        res.status(200).json({
            message: "Task deleted successfully",
            deletedTask: deletedTask._id
        });
    } catch (error) {
        console.error('Error deleting task:', error);
        res.status(500).json({ error: "Failed to delete task" });
    }
};


export const bulkDeleteTasks = async (req, res) => {
    try {
        const { taskIds } = req.body;

        if (!Array.isArray(taskIds) || taskIds.length === 0) {
            return res.status(400).json({ error: "Task IDs array is required" });
        }

        // Validate all ObjectIds
        const invalidIds = taskIds.filter(id => !id.match(/^[0-9a-fA-F]{24}$/));
        if (invalidIds.length > 0) {
            return res.status(400).json({ error: "Invalid task IDs provided" });
        }

        const result = await Task.deleteMany({ _id: { $in: taskIds } });

        res.status(200).json({
            message: `${result.deletedCount} tasks deleted successfully`,
            deletedCount: result.deletedCount
        });
    } catch (error) {
        console.error('Error bulk deleting tasks:', error);
        res.status(500).json({ error: "Failed to delete tasks" });
    }
};


// code of delete messages 
export const deleteMessage = async (req, res) => {
    try {
        const { taskId, messageId } = req.params;
        const userId = req.user.id;

        const task = await Task.findById(taskId);
        if (!task) return res.status(404).json({ error: "Task not found" });

        const msgIndex = task.messages.findIndex(m => m._id.toString() === messageId);
        if (msgIndex === -1) return res.status(404).json({ error: "Message not found" });

        const message = task.messages[msgIndex];

        // Only sender can delete
        if (message.sender.toString() !== userId) {
            return res.status(403).json({ error: "You can only delete your own messages" });
        }

        // Option 1: Soft delete (recommended)
        message.isDeleted = true;
        message.message = "[This message was deleted]";
        message.isRead = true;

        // Option 2: Hard delete (uncomment if preferred)
        // task.messages.splice(msgIndex, 1);

        await task.save();

        res.status(200).json({ message: "Message deleted successfully" });
    } catch (error) {
        console.error("Error deleting message:", error);
        res.status(500).json({ error: "Failed to delete message" });
    }
};