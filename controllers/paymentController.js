// controllers/paymentController.js

import Stripe from 'stripe';
import Transaction from '../models/Transaction.js';
import Task from '../models/task.js';
import User from '../models/user.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ============================================================
// 1. CREATE PAYMENT INTENT (When client accepts bid)
// ============================================================
export const createPaymentIntent = async (req, res) => {
    try {
        const { taskId, bidId } = req.body;
        const client = req.user;

        const task = await Task.findById(taskId).populate('acceptedBid');
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        const bid = task.acceptedBid || task.bids.id(bidId);
        if (!bid) {
            return res.status(404).json({ error: 'Bid not found' });
        }

        const tasker = await User.findById(bid.tasker);
        if (!tasker) {
            return res.status(404).json({ error: 'Tasker not found' });
        }

        // Calculate amounts (in cents)
        const totalAmount = Math.round(bid.amount * 100);
        const platformFeePercent = 15;
        const platformFee = Math.round(totalAmount * (platformFeePercent / 100));
        const taskerEarnings = totalAmount - platformFee;

        // Check if tasker has Stripe Connect
        const hasStripeConnect = tasker.stripeConnectAccountId &&
            tasker.stripeConnectStatus === 'active';

        // Get or create Stripe customer
        let stripeCustomerId = client.stripeCustomerId;
        if (!stripeCustomerId) {
            const customer = await stripe.customers.create({
                email: client.email,
                name: `${client.firstName} ${client.lastName}`,
                metadata: { userId: client._id.toString() }
            });
            stripeCustomerId = customer.id;
            client.stripeCustomerId = stripeCustomerId;
            await client.save();
        }

        // Create Payment Intent with manual capture
        const paymentIntentData = {
            amount: totalAmount,
            currency: 'cad',
            customer: stripeCustomerId,
            capture_method: 'manual', // Important: Hold payment, capture later
            metadata: {
                taskId: task._id.toString(),
                taskerId: tasker._id.toString(),
                clientId: client._id.toString(),
                platformFee: platformFee.toString(),
                taskerEarnings: taskerEarnings.toString()
            },
            description: `Payment for task: ${task.title}`
        };

        // If tasker has Stripe Connect, set up for transfer
        if (hasStripeConnect) {
            paymentIntentData.transfer_group = `task_${task._id}`;
            paymentIntentData.on_behalf_of = tasker.stripeConnectAccountId;
        }

        const paymentIntent = await stripe.paymentIntents.create(paymentIntentData);

        // Create transaction record
        const transaction = new Transaction({
            type: 'bid_authorization',
            taskId: task._id,
            clientId: client._id,
            taskerId: tasker._id,
            stripePaymentIntentId: paymentIntent.id,
            stripeCustomerId,
            amounts: {
                total: totalAmount,
                platformFee,
                platformFeePercentage: platformFeePercent,
                taskerEarnings
            },
            currency: 'cad',
            status: 'pending',
            taskSnapshot: {
                title: task.title,
                description: task.description
            },
            clientSnapshot: {
                name: `${client.firstName} ${client.lastName}`,
                email: client.email
            },
            taskerSnapshot: {
                name: `${tasker.firstName} ${tasker.lastName}`,
                email: tasker.email,
                stripeConnectAccountId: tasker.stripeConnectAccountId
            },
            taskerPayout: {
                status: 'pending',
                payoutMethod: hasStripeConnect ? 'stripe_connect' : 'manual'
            }
        });

        await transaction.save();

        res.json({
            success: true,
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id,
            transactionId: transaction.transactionId,
            amounts: {
                total: (totalAmount / 100).toFixed(2),
                platformFee: (platformFee / 100).toFixed(2),
                taskerEarnings: (taskerEarnings / 100).toFixed(2)
            },
            taskerHasStripeConnect: hasStripeConnect
        });

    } catch (error) {
        console.error('Create payment intent error:', error);
        res.status(500).json({ error: error.message });
    }
};

// ============================================================
// 2. CONFIRM PAYMENT AUTHORIZATION
// ============================================================
export const confirmPaymentAuthorization = async (req, res) => {
    try {
        const { paymentIntentId, transactionId } = req.body;

        const transaction = await Transaction.findOne({
            $or: [
                { stripePaymentIntentId: paymentIntentId },
                { transactionId }
            ]
        });

        if (!transaction) {
            return res.status(404).json({ error: 'Transaction not found' });
        }

        // Verify with Stripe
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

        if (paymentIntent.status === 'requires_capture') {
            transaction.status = 'authorized';
            transaction.type = 'bid_authorization';
            transaction.statusHistory.push({
                status: 'authorized',
                changedAt: new Date(),
                reason: 'Payment authorized, awaiting task completion'
            });
            await transaction.save();

            // Update task status
            await Task.findByIdAndUpdate(transaction.taskId, {
                status: 'in_progress',
                paymentStatus: 'authorized'
            });

            return res.json({
                success: true,
                message: 'Payment authorized successfully',
                status: 'authorized',
                transactionId: transaction.transactionId
            });
        }

        res.status(400).json({
            error: 'Payment not in expected state',
            stripeStatus: paymentIntent.status
        });

    } catch (error) {
        console.error('Confirm authorization error:', error);
        res.status(500).json({ error: error.message });
    }
};

// ============================================================
// 3. CAPTURE PAYMENT AND AUTO-PAY TASKER (Main function!)
// ============================================================
export const captureAndPayoutTasker = async (req, res) => {
    try {
        const { taskId } = req.params;

        // Find transaction
        const transaction = await Transaction.findOne({ taskId })
            .populate('taskerId', 'firstName lastName email stripeConnectAccountId stripeConnectStatus');

        if (!transaction) {
            return res.status(404).json({ error: 'Transaction not found' });
        }

        if (transaction.status !== 'authorized') {
            return res.status(400).json({
                error: `Cannot capture. Current status: ${transaction.status}`
            });
        }

        const tasker = transaction.taskerId;
        const hasStripeConnect = tasker.stripeConnectAccountId &&
            tasker.stripeConnectStatus === 'active';

        // Step 1: Capture the payment
        console.log(`Capturing payment: ${transaction.stripePaymentIntentId}`);

        const paymentIntent = await stripe.paymentIntents.capture(
            transaction.stripePaymentIntentId
        );

        if (paymentIntent.status !== 'succeeded') {
            throw new Error(`Payment capture failed: ${paymentIntent.status}`);
        }

        // Update transaction - payment captured
        transaction.status = 'captured';
        transaction.type = 'bid_capture';
        transaction.stripeChargeId = paymentIntent.latest_charge;
        transaction.statusHistory.push({
            status: 'captured',
            changedAt: new Date(),
            reason: 'Payment captured successfully'
        });

        // Step 2: Transfer to tasker (if Stripe Connect)
        if (hasStripeConnect) {
            console.log(`Transferring to tasker Connect account: ${tasker.stripeConnectAccountId}`);

            try {
                const transfer = await stripe.transfers.create({
                    amount: transaction.amounts.taskerEarnings,
                    currency: transaction.currency,
                    destination: tasker.stripeConnectAccountId,
                    transfer_group: `task_${taskId}`,
                    source_transaction: paymentIntent.latest_charge,
                    metadata: {
                        transactionId: transaction.transactionId,
                        taskId: taskId.toString(),
                        taskerId: tasker._id.toString(),
                        type: 'tasker_payout'
                    },
                    description: `Payout for task: ${transaction.taskSnapshot?.title || taskId}`
                });

                // Update transaction with transfer details
                transaction.status = 'tasker_paid';
                transaction.type = 'tasker_payout';
                transaction.stripeTransferId = transfer.id;
                transaction.taskerPayout = {
                    status: 'completed',
                    processedDate: new Date(),
                    payoutMethod: 'stripe_connect',
                    stripeTransferId: transfer.id,
                    transferDetails: {
                        amount: transaction.amounts.taskerEarnings,
                        currency: transaction.currency,
                        destinationAccountId: tasker.stripeConnectAccountId,
                        transferGroup: `task_${taskId}`
                    }
                };
                transaction.statusHistory.push({
                    status: 'tasker_paid',
                    changedAt: new Date(),
                    reason: `Auto payout via Stripe Connect. Transfer ID: ${transfer.id}`
                });

                await transaction.save();

                // Update task
                await Task.findByIdAndUpdate(taskId, {
                    status: 'completed',
                    paymentStatus: 'paid',
                    completedAt: new Date()
                });

                console.log(`✅ Payment captured and tasker paid. Transfer: ${transfer.id}`);

                return res.json({
                    success: true,
                    message: 'Payment captured and tasker paid automatically',
                    transactionId: transaction.transactionId,
                    paymentStatus: 'tasker_paid',
                    capture: {
                        paymentIntentId: paymentIntent.id,
                        chargeId: paymentIntent.latest_charge,
                        amount: (transaction.amounts.total / 100).toFixed(2)
                    },
                    transfer: {
                        transferId: transfer.id,
                        amount: (transaction.amounts.taskerEarnings / 100).toFixed(2),
                        destination: tasker.stripeConnectAccountId
                    },
                    platformFee: (transaction.amounts.platformFee / 100).toFixed(2)
                });

            } catch (transferError) {
                console.error('Transfer failed:', transferError);

                // Payment captured but transfer failed
                transaction.status = 'captured';
                transaction.taskerPayout = {
                    status: 'failed',
                    payoutMethod: 'stripe_connect',
                    failureReason: transferError.message
                };
                transaction.statusHistory.push({
                    status: 'tasker_payout_failed',
                    changedAt: new Date(),
                    reason: `Transfer failed: ${transferError.message}`
                });
                await transaction.save();

                return res.status(500).json({
                    success: false,
                    message: 'Payment captured but transfer to tasker failed',
                    error: transferError.message,
                    transactionId: transaction.transactionId,
                    requiresManualPayout: true
                });
            }

        } else {
            // No Stripe Connect - requires manual payout
            transaction.taskerPayout = {
                status: 'pending',
                payoutMethod: 'manual',
                notes: 'Tasker does not have Stripe Connect. Manual payout required.'
            };
            transaction.statusHistory.push({
                status: 'captured',
                changedAt: new Date(),
                reason: 'Payment captured. Manual payout required - tasker not on Stripe Connect.'
            });

            await transaction.save();

            // Update task
            await Task.findByIdAndUpdate(taskId, {
                status: 'completed',
                paymentStatus: 'captured',
                completedAt: new Date()
            });

            console.log(`⚠️ Payment captured. Manual payout required for tasker.`);

            return res.json({
                success: true,
                message: 'Payment captured. Manual payout required.',
                transactionId: transaction.transactionId,
                paymentStatus: 'captured',
                capture: {
                    paymentIntentId: paymentIntent.id,
                    amount: (transaction.amounts.total / 100).toFixed(2)
                },
                taskerPayout: {
                    status: 'pending',
                    method: 'manual',
                    amount: (transaction.amounts.taskerEarnings / 100).toFixed(2)
                },
                requiresManualPayout: true,
                tasker: {
                    name: `${tasker.firstName} ${tasker.lastName}`,
                    email: tasker.email
                }
            });
        }

    } catch (error) {
        console.error('Capture and payout error:', error);
        res.status(500).json({ error: error.message });
    }
};

// ============================================================
// 4. MANUAL PAYOUT (For taskers without Stripe Connect)
// ============================================================
export const processManualPayout = async (req, res) => {
    try {
        const { transactionId } = req.params;
        const { referenceNumber, notes, payoutMethod } = req.body;
        const adminUser = req.user;

        const transaction = await Transaction.findOne({
            $or: [{ _id: transactionId }, { transactionId }]
        }).populate('taskerId');

        if (!transaction) {
            return res.status(404).json({ error: 'Transaction not found' });
        }

        if (transaction.status !== 'captured') {
            return res.status(400).json({
                error: `Cannot process payout. Status: ${transaction.status}`
            });
        }

        if (transaction.taskerPayout?.status === 'completed') {
            return res.status(400).json({ error: 'Payout already completed' });
        }

        // Update transaction
        transaction.status = 'tasker_paid';
        transaction.taskerPayout = {
            status: 'completed',
            processedDate: new Date(),
            processedBy: adminUser._id,
            payoutMethod: payoutMethod || 'manual',
            referenceNumber: referenceNumber || '',
            notes: notes || 'Manual payout processed by admin'
        };
        transaction.statusHistory.push({
            status: 'tasker_paid',
            changedAt: new Date(),
            changedBy: adminUser._id,
            reason: `Manual payout. Reference: ${referenceNumber || 'N/A'}`
        });

        await transaction.save();

        // Update task
        await Task.findByIdAndUpdate(transaction.taskId, {
            paymentStatus: 'paid'
        });

        res.json({
            success: true,
            message: 'Manual payout recorded successfully',
            transactionId: transaction.transactionId,
            payout: {
                amount: (transaction.amounts.taskerEarnings / 100).toFixed(2),
                method: payoutMethod || 'manual',
                referenceNumber,
                processedAt: new Date()
            }
        });

    } catch (error) {
        console.error('Manual payout error:', error);
        res.status(500).json({ error: error.message });
    }
};

// ============================================================
// 5. REFUND PAYMENT
// ============================================================
export const refundPayment = async (req, res) => {
    try {
        const { transactionId } = req.params;
        const { reason, amount } = req.body; // amount is optional for partial refunds
        const adminUser = req.user;

        const transaction = await Transaction.findOne({
            $or: [{ _id: transactionId }, { transactionId }]
        });

        if (!transaction) {
            return res.status(404).json({ error: 'Transaction not found' });
        }

        if (!['authorized', 'captured'].includes(transaction.status)) {
            return res.status(400).json({
                error: `Cannot refund. Status: ${transaction.status}`
            });
        }

        let refund;

        if (transaction.status === 'authorized') {
            // Cancel the authorization
            await stripe.paymentIntents.cancel(transaction.stripePaymentIntentId);

            transaction.status = 'cancelled';
            transaction.statusHistory.push({
                status: 'cancelled',
                changedAt: new Date(),
                changedBy: adminUser?._id,
                reason: reason || 'Authorization cancelled'
            });

        } else {
            // Refund the captured payment
            const refundData = {
                payment_intent: transaction.stripePaymentIntentId,
                reason: 'requested_by_customer',
                metadata: {
                    transactionId: transaction.transactionId,
                    adminId: adminUser?._id?.toString(),
                    reason: reason || 'Refund requested'
                }
            };

            // Partial refund
            if (amount && amount < transaction.amounts.total) {
                refundData.amount = Math.round(amount * 100);
            }

            refund = await stripe.refunds.create(refundData);

            transaction.status = 'refunded';
            transaction.stripeRefundId = refund.id;
            transaction.statusHistory.push({
                status: 'refunded',
                changedAt: new Date(),
                changedBy: adminUser?._id,
                reason: reason || 'Payment refunded'
            });

            // If transfer was made, reverse it
            if (transaction.stripeTransferId) {
                try {
                    await stripe.transfers.createReversal(transaction.stripeTransferId);
                    transaction.taskerPayout.status = 'cancelled';
                    transaction.taskerPayout.notes = 'Transfer reversed due to refund';
                } catch (reversalError) {
                    console.error('Transfer reversal failed:', reversalError);
                }
            }
        }

        await transaction.save();

        // Update task
        await Task.findByIdAndUpdate(transaction.taskId, {
            status: 'cancelled',
            paymentStatus: 'refunded'
        });

        res.json({
            success: true,
            message: transaction.status === 'cancelled' ? 'Authorization cancelled' : 'Payment refunded',
            transactionId: transaction.transactionId,
            refundId: refund?.id,
            status: transaction.status
        });

    } catch (error) {
        console.error('Refund error:', error);
        res.status(500).json({ error: error.message });
    }
};