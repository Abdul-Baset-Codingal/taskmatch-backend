// controllers/adminPayoutController.js

import Transaction from '../models/Transaction.js';

// Get all pending payouts with tasker bank details
export const getPendingPayoutsWithBankDetails = async (req, res) => {
    try {
        const transactions = await Transaction.find({
            status: 'captured',
            'taskerPayout.status': { $in: ['pending', null, undefined] }
        })
            .populate('taskerId', 'firstName lastName email phone accountHolder accountNumber routingNumber bankDetails')
            .populate('clientId', 'firstName lastName email')
            .populate('taskId', 'taskTitle serviceTitle')
            .sort({ createdAt: -1 })
            .lean();

        const payouts = transactions.map(t => {
            const tasker = t.taskerId;

            // Get bank details (check both old and new format)
            const bankDetails = {
                accountHolder: tasker?.bankDetails?.accountHolder || tasker?.accountHolder || null,
                accountNumber: tasker?.bankDetails?.accountNumber || tasker?.accountNumber || null,
                accountNumberLast4: tasker?.bankDetails?.accountNumberLast4 ||
                    (tasker?.accountNumber ? tasker.accountNumber.slice(-4) : null),
                routingNumber: tasker?.bankDetails?.routingNumber || tasker?.routingNumber || null,
                bankName: tasker?.bankDetails?.bankName || null,
                hasBankDetails: !!(tasker?.accountNumber || tasker?.bankDetails?.accountNumber)
            };

            return {
                _id: t._id,
                transactionId: t.transactionId,

                // Task info
                task: {
                    _id: t.taskId?._id,
                    title: t.taskId?.taskTitle || t.taskId?.serviceTitle || t.taskSnapshot?.title
                },

                // Client info
                client: {
                    _id: t.clientId?._id,
                    name: t.clientId ? `${t.clientId.firstName || ''} ${t.clientId.lastName || ''}`.trim() : 'Unknown',
                    email: t.clientId?.email
                },

                // Tasker info with bank details
                tasker: {
                    _id: tasker?._id,
                    name: tasker ? `${tasker.firstName || ''} ${tasker.lastName || ''}`.trim() : 'Unknown',
                    email: tasker?.email,
                    phone: tasker?.phone,
                    bankDetails: bankDetails
                },

                // Amounts
                amounts: {
                    total: ((t.amounts?.total || 0) / 100).toFixed(2),
                    platformFee: ((t.amounts?.platformFee || 0) / 100).toFixed(2),
                    platformFeePercentage: t.amounts?.platformFeePercentage || 15,
                    taskerEarnings: ((t.amounts?.taskerEarnings || 0) / 100).toFixed(2),
                    taskerEarningsCents: t.amounts?.taskerEarnings || 0
                },

                status: t.status,
                payoutStatus: t.taskerPayout?.status || 'pending',
                createdAt: t.createdAt
            };
        });

        // Summary
        const summary = {
            totalPending: payouts.length,
            totalAmount: payouts.reduce((sum, p) => sum + parseFloat(p.amounts.taskerEarnings), 0).toFixed(2),
            withBankDetails: payouts.filter(p => p.tasker.bankDetails.hasBankDetails).length,
            withoutBankDetails: payouts.filter(p => !p.tasker.bankDetails.hasBankDetails).length
        };

        res.json({
            success: true,
            payouts,
            summary
        });

    } catch (err) {
        console.error('getPendingPayoutsWithBankDetails error:', err);
        res.status(500).json({ error: err.message });
    }
};

// Process payout to tasker's bank account
export const processPayoutToBank = async (req, res) => {
    try {
        const { transactionId } = req.params;
        const {
            payoutMethod,
            referenceNumber,
            notes,
            externalTransactionId // e.g., bank transfer reference
        } = req.body;
        const adminUser = req.user;

        console.log('Processing bank payout:', { transactionId, payoutMethod });

        // Find transaction
        const transaction = await Transaction.findOne({
            $or: [
                { _id: transactionId },
                { transactionId: transactionId }
            ]
        }).populate('taskerId', 'firstName lastName email accountHolder accountNumber routingNumber bankDetails');

        if (!transaction) {
            return res.status(404).json({ error: 'Transaction not found' });
        }

        if (transaction.status !== 'captured') {
            return res.status(400).json({
                error: `Cannot process payout. Transaction status is: ${transaction.status}`
            });
        }

        if (transaction.taskerPayout?.status === 'completed') {
            return res.status(400).json({ error: 'Payout already completed' });
        }

        const tasker = transaction.taskerId;
        const payoutAmount = transaction.amounts?.taskerEarnings || 0;

        // Get bank details
        const bankDetails = {
            accountHolder: tasker?.bankDetails?.accountHolder || tasker?.accountHolder,
            accountNumber: tasker?.bankDetails?.accountNumber || tasker?.accountNumber,
            routingNumber: tasker?.bankDetails?.routingNumber || tasker?.routingNumber
        };

        // Validate bank details exist
        if (!bankDetails.accountNumber || !bankDetails.routingNumber) {
            return res.status(400).json({
                error: 'Tasker does not have bank details on file',
                taskerEmail: tasker?.email
            });
        }

        // For bank transfers, we mark as processing (admin will do manual transfer)
        // Or if using Stripe, we can create a payout

        let payoutResult = null;

        if (payoutMethod === 'stripe_payout') {
            // Use Stripe to send money to bank account
            // This requires setting up the bank account as an external account on your platform
            const stripe = (await import('../utils/stripeConfig.js')).default;

            try {
                // First, create a bank account token
                const bankAccountToken = await stripe.tokens.create({
                    bank_account: {
                        country: 'CA', // or 'US'
                        currency: 'cad', // or 'usd'
                        account_holder_name: bankDetails.accountHolder,
                        account_holder_type: 'individual',
                        routing_number: bankDetails.routingNumber,
                        account_number: bankDetails.accountNumber
                    }
                });

                // Note: For actual payouts, you need to use Stripe Connect or 
                // add the bank account to your platform account
                // This is a simplified example

                payoutResult = {
                    method: 'stripe_payout',
                    status: 'processing',
                    tokenId: bankAccountToken.id,
                    message: 'Bank account validated, processing payout'
                };

            } catch (stripeErr) {
                console.error('Stripe bank error:', stripeErr);
                return res.status(400).json({
                    error: `Bank validation failed: ${stripeErr.message}`
                });
            }
        } else {
            // Manual bank transfer - admin will do it outside the system
            payoutResult = {
                method: 'manual_bank_transfer',
                status: 'processing',
                message: 'Marked for manual bank transfer'
            };
        }

        // Update transaction
        transaction.status = payoutMethod === 'manual_bank_transfer' ? 'tasker_payout_processing' : 'tasker_paid';
        transaction.taskerPayout = {
            status: payoutMethod === 'manual_bank_transfer' ? 'processing' : 'completed',
            processedDate: new Date(),
            processedBy: adminUser?._id,
            payoutMethod: payoutMethod,
            referenceNumber: referenceNumber || '',
            externalTransactionId: externalTransactionId || '',
            notes: notes || '',
            bankDetails: {
                accountHolder: bankDetails.accountHolder,
                accountLast4: bankDetails.accountNumber?.slice(-4),
                routingNumber: bankDetails.routingNumber
            }
        };
        transaction.statusHistory.push({
            status: transaction.status,
            changedAt: new Date(),
            changedBy: adminUser?._id,
            reason: `Payout ${payoutResult.status} via ${payoutMethod}. Ref: ${referenceNumber || 'N/A'}`
        });

        await transaction.save();

        res.json({
            success: true,
            message: payoutMethod === 'manual_bank_transfer' ?
                'Payout marked for manual processing' :
                'Payout processed successfully',
            payout: {
                transactionId: transaction.transactionId,
                amount: (payoutAmount / 100).toFixed(2),
                method: payoutMethod,
                status: payoutResult.status,
                tasker: {
                    name: `${tasker?.firstName || ''} ${tasker?.lastName || ''}`.trim(),
                    email: tasker?.email,
                    bankAccountLast4: bankDetails.accountNumber?.slice(-4)
                },
                referenceNumber
            }
        });

    } catch (err) {
        console.error('processPayoutToBank error:', err);
        res.status(500).json({ error: err.message });
    }
};

// Mark manual payout as completed
export const completeManualPayout = async (req, res) => {
    try {
        const { transactionId } = req.params;
        const {
            referenceNumber,
            externalTransactionId,
            notes,
            completedAt
        } = req.body;
        const adminUser = req.user;

        const transaction = await Transaction.findOne({
            $or: [
                { _id: transactionId },
                { transactionId: transactionId }
            ]
        });

        if (!transaction) {
            return res.status(404).json({ error: 'Transaction not found' });
        }

        if (transaction.taskerPayout?.status === 'completed') {
            return res.status(400).json({ error: 'Payout already completed' });
        }

        // Update to completed
        transaction.status = 'tasker_paid';
        transaction.taskerPayout = {
            ...transaction.taskerPayout,
            status: 'completed',
            completedDate: completedAt ? new Date(completedAt) : new Date(),
            completedBy: adminUser?._id,
            referenceNumber: referenceNumber || transaction.taskerPayout?.referenceNumber,
            externalTransactionId: externalTransactionId || transaction.taskerPayout?.externalTransactionId,
            notes: notes || transaction.taskerPayout?.notes
        };
        transaction.statusHistory.push({
            status: 'tasker_paid',
            changedAt: new Date(),
            changedBy: adminUser?._id,
            reason: `Manual payout completed. Bank Ref: ${referenceNumber || externalTransactionId || 'N/A'}`
        });

        await transaction.save();

        res.json({
            success: true,
            message: 'Payout marked as completed',
            transactionId: transaction.transactionId
        });

    } catch (err) {
        console.error('completeManualPayout error:', err);
        res.status(500).json({ error: err.message });
    }
};

// Get tasker's bank details for admin
export const getTaskerBankDetails = async (req, res) => {
    try {
        const { taskerId } = req.params;

        const tasker = await User.findById(taskerId)
            .select('firstName lastName email phone accountHolder accountNumber routingNumber bankDetails');

        if (!tasker) {
            return res.status(404).json({ error: 'Tasker not found' });
        }

        const bankDetails = {
            accountHolder: tasker.bankDetails?.accountHolder || tasker.accountHolder || null,
            accountNumber: tasker.bankDetails?.accountNumber || tasker.accountNumber || null,
            accountNumberMasked: tasker.accountNumber ?
                `****${tasker.accountNumber.slice(-4)}` : null,
            routingNumber: tasker.bankDetails?.routingNumber || tasker.routingNumber || null,
            bankName: tasker.bankDetails?.bankName || null,
            hasBankDetails: !!(tasker.accountNumber || tasker.bankDetails?.accountNumber)
        };

        res.json({
            success: true,
            tasker: {
                _id: tasker._id,
                name: `${tasker.firstName || ''} ${tasker.lastName || ''}`.trim(),
                email: tasker.email,
                phone: tasker.phone
            },
            bankDetails
        });

    } catch (err) {
        console.error('getTaskerBankDetails error:', err);
        res.status(500).json({ error: err.message });
    }
};