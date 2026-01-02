// // controllers/adminPaymentController.js
// import Transaction from '../models/Transaction.js';
// import User from '../models/user.js';
// import Task from '../models/task.js';
// import PlatformSettings from '../models/PlatformSettings.js';

// // ==================== DASHBOARD OVERVIEW ====================
// // controllers/adminPaymentController.js

// // Helper function to generate transaction ID
// const generateTransactionId = () => {
//     const date = new Date();
//     const year = date.getFullYear().toString().slice(-2);
//     const month = String(date.getMonth() + 1).padStart(2, '0');
//     const day = String(date.getDate()).padStart(2, '0');
//     const timestamp = Date.now().toString().slice(-6);
//     const random = Math.random().toString(36).substring(2, 6).toUpperCase();

//     return `TXN-${year}${month}${day}-${timestamp}-${random}`;
// };


// export const getPaymentDashboard = async (req, res) => {
//     try {
//         const now = new Date();
//         const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
//         const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
//         const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

//         // Get summary statistics
//         const [
//             pendingPayouts,
//             thisMonthStats,
//             lastMonthStats,
//             recentTransactions,
//             payoutsByStatus
//         ] = await Promise.all([
//             // Pending payouts to taskers
//             Transaction.aggregate([
//                 {
//                     $match: {
//                         status: 'captured',
//                         'taskerPayout.status': 'pending'
//                     }
//                 },
//                 {
//                     $group: {
//                         _id: null,
//                         count: { $sum: 1 },
//                         totalAmount: { $sum: '$amounts.taskerEarnings' }
//                     }
//                 }
//             ]),

//             // This month's statistics
//             Transaction.aggregate([
//                 {
//                     $match: {
//                         status: { $in: ['captured', 'tasker_paid'] },
//                         createdAt: { $gte: startOfMonth }
//                     }
//                 },
//                 {
//                     $group: {
//                         _id: null,
//                         totalRevenue: { $sum: '$amounts.total' },
//                         platformFees: { $sum: '$amounts.platformFee' },
//                         taskerPayouts: { $sum: '$amounts.taskerEarnings' },
//                         transactionCount: { $sum: 1 }
//                     }
//                 }
//             ]),

//             // Last month's statistics
//             Transaction.aggregate([
//                 {
//                     $match: {
//                         status: { $in: ['captured', 'tasker_paid'] },
//                         createdAt: {
//                             $gte: startOfLastMonth,
//                             $lte: endOfLastMonth
//                         }
//                     }
//                 },
//                 {
//                     $group: {
//                         _id: null,
//                         totalRevenue: { $sum: '$amounts.total' },
//                         platformFees: { $sum: '$amounts.platformFee' }
//                     }
//                 }
//             ]),

//             // Recent transactions
//             Transaction.find()
//                 .sort({ createdAt: -1 })
//                 .limit(10)
//                 .populate('clientId', 'firstName lastName email')
//                 .populate('taskerId', 'firstName lastName email')
//                 .populate('taskId', 'taskTitle'),

//             // Payouts by status
//             Transaction.aggregate([
//                 {
//                     $match: {
//                         status: { $in: ['captured', 'tasker_payout_pending', 'tasker_payout_processing', 'tasker_paid'] }
//                     }
//                 },
//                 {
//                     $group: {
//                         _id: '$taskerPayout.status',
//                         count: { $sum: 1 },
//                         totalAmount: { $sum: '$amounts.taskerEarnings' }
//                     }
//                 }
//             ])
//         ]);

//         const thisMonth = thisMonthStats[0] || { totalRevenue: 0, platformFees: 0, taskerPayouts: 0, transactionCount: 0 };
//         const lastMonth = lastMonthStats[0] || { totalRevenue: 0, platformFees: 0 };
//         const pending = pendingPayouts[0] || { count: 0, totalAmount: 0 };

//         // Calculate growth percentages
//         const revenueGrowth = lastMonth.totalRevenue > 0
//             ? ((thisMonth.totalRevenue - lastMonth.totalRevenue) / lastMonth.totalRevenue * 100).toFixed(1)
//             : 0;

//         res.json({
//             success: true,
//             dashboard: {
//                 summary: {
//                     pendingPayoutsCount: pending.count,
//                     pendingPayoutsAmount: (pending.totalAmount / 100).toFixed(2),

//                     thisMonth: {
//                         totalRevenue: (thisMonth.totalRevenue / 100).toFixed(2),
//                         platformFees: (thisMonth.platformFees / 100).toFixed(2),
//                         taskerPayouts: (thisMonth.taskerPayouts / 100).toFixed(2),
//                         transactionCount: thisMonth.transactionCount
//                     },

//                     lastMonth: {
//                         totalRevenue: (lastMonth.totalRevenue / 100).toFixed(2),
//                         platformFees: (lastMonth.platformFees / 100).toFixed(2)
//                     },

//                     growth: {
//                         revenue: revenueGrowth
//                     }
//                 },

//                 payoutsByStatus: payoutsByStatus.map(item => ({
//                     status: item._id || 'unknown',
//                     count: item.count,
//                     totalAmount: (item.totalAmount / 100).toFixed(2)
//                 })),

//                 recentTransactions: recentTransactions.map(t => ({
//                     transactionId: t.transactionId,
//                     type: t.type,
//                     status: t.status,
//                     amounts: {
//                         total: (t.amounts.total / 100).toFixed(2),
//                         platformFee: (t.amounts.platformFee / 100).toFixed(2),
//                         taskerEarnings: (t.amounts.taskerEarnings / 100).toFixed(2)
//                     },
//                     client: t.clientId ? {
//                         name: `${t.clientId.firstName || ''} ${t.clientId.lastName || ''}`.trim(),
//                         email: t.clientId.email
//                     } : t.clientSnapshot,
//                     tasker: t.taskerId ? {
//                         name: `${t.taskerId.firstName || ''} ${t.taskerId.lastName || ''}`.trim(),
//                         email: t.taskerId.email
//                     } : t.taskerSnapshot,
//                     task: t.taskId?.taskTitle || t.taskSnapshot?.title,
//                     createdAt: t.createdAt
//                 }))
//             }
//         });

//     } catch (err) {
//         console.error("getPaymentDashboard error:", err);
//         res.status(500).json({ error: err.message });
//     }
// };

// // ==================== PENDING PAYOUTS ====================

// export const getPendingPayouts = async (req, res) => {
//     try {
//         const {
//             page = 1,
//             limit = 20,
//             sortBy = 'createdAt',
//             sortOrder = 'desc',
//             taskerId,
//             minAmount,
//             maxAmount
//         } = req.query;

//         // Build query
//         const query = {
//             status: 'captured',
//             'taskerPayout.status': 'pending'
//         };

//         if (taskerId) {
//             query.taskerId = taskerId;
//         }

//         if (minAmount || maxAmount) {
//             query['amounts.taskerEarnings'] = {};
//             if (minAmount) query['amounts.taskerEarnings'].$gte = parseFloat(minAmount) * 100;
//             if (maxAmount) query['amounts.taskerEarnings'].$lte = parseFloat(maxAmount) * 100;
//         }

//         const skip = (parseInt(page) - 1) * parseInt(limit);
//         const sortOptions = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

//         const [payouts, totalCount] = await Promise.all([
//             Transaction.find(query)
//                 .sort(sortOptions)
//                 .skip(skip)
//                 .limit(parseInt(limit))
//                 .populate('clientId', 'firstName lastName email')
//                 .populate('taskerId', 'firstName lastName email phone stripeConnectAccountId')
//                 .populate('taskId', 'taskTitle status'),

//             Transaction.countDocuments(query)
//         ]);

//         // Group by tasker for summary
//         const taskerSummary = await Transaction.aggregate([
//             { $match: query },
//             {
//                 $group: {
//                     _id: '$taskerId',
//                     totalEarnings: { $sum: '$amounts.taskerEarnings' },
//                     transactionCount: { $sum: 1 }
//                 }
//             },
//             {
//                 $lookup: {
//                     from: 'users',
//                     localField: '_id',
//                     foreignField: '_id',
//                     as: 'tasker'
//                 }
//             },
//             { $unwind: '$tasker' },
//             {
//                 $project: {
//                     taskerId: '$_id',
//                     taskerName: {
//                         $concat: [
//                             { $ifNull: ['$tasker.firstName', ''] },
//                             ' ',
//                             { $ifNull: ['$tasker.lastName', ''] }
//                         ]
//                     },
//                     taskerEmail: '$tasker.email',
//                     stripeConnectAccountId: '$tasker.stripeConnectAccountId',
//                     totalEarnings: 1,
//                     transactionCount: 1
//                 }
//             },
//             { $sort: { totalEarnings: -1 } }
//         ]);

//         res.json({
//             success: true,
//             payouts: payouts.map(p => ({
//                 _id: p._id,
//                 transactionId: p.transactionId,
//                 taskId: p.taskId?._id,
//                 taskTitle: p.taskId?.taskTitle || p.taskSnapshot?.title,

//                 client: {
//                     id: p.clientId?._id,
//                     name: `${p.clientId?.firstName || ''} ${p.clientId?.lastName || ''}`.trim(),
//                     email: p.clientId?.email
//                 },

//                 tasker: {
//                     id: p.taskerId?._id,
//                     name: `${p.taskerId?.firstName || ''} ${p.taskerId?.lastName || ''}`.trim(),
//                     email: p.taskerId?.email,
//                     hasStripeConnect: !!p.taskerId?.stripeConnectAccountId
//                 },

//                 amounts: {
//                     total: (p.amounts.total / 100).toFixed(2),
//                     platformFee: (p.amounts.platformFee / 100).toFixed(2),
//                     platformFeePercentage: p.amounts.platformFeePercentage,
//                     taskerEarnings: (p.amounts.taskerEarnings / 100).toFixed(2)
//                 },

//                 payoutStatus: p.taskerPayout.status,
//                 scheduledDate: p.taskerPayout.scheduledDate,

//                 createdAt: p.createdAt,
//                 stripePaymentIntentId: p.stripePaymentIntentId
//             })),

//             taskerSummary: taskerSummary.map(t => ({
//                 ...t,
//                 totalEarnings: (t.totalEarnings / 100).toFixed(2)
//             })),

//             pagination: {
//                 currentPage: parseInt(page),
//                 totalPages: Math.ceil(totalCount / parseInt(limit)),
//                 totalCount,
//                 hasNext: skip + payouts.length < totalCount,
//                 hasPrev: parseInt(page) > 1
//             }
//         });

//     } catch (err) {
//         console.error("getPendingPayouts error:", err);
//         res.status(500).json({ error: err.message });
//     }
// };

// // ==================== ALL TRANSACTIONS ====================

// export const getAllTransactions = async (req, res) => {
//     try {
//         const {
//             page = 1,
//             limit = 20,
//             status,
//             type,
//             clientId,
//             taskerId,
//             taskId,
//             startDate,
//             endDate,
//             minAmount,
//             maxAmount,
//             search,
//             sortBy = 'createdAt',
//             sortOrder = 'desc'
//         } = req.query;

//         // Build query
//         const query = {};

//         if (status) query.status = status;
//         if (type) query.type = type;
//         if (clientId) query.clientId = clientId;
//         if (taskerId) query.taskerId = taskerId;
//         if (taskId) query.taskId = taskId;

//         if (startDate || endDate) {
//             query.createdAt = {};
//             if (startDate) query.createdAt.$gte = new Date(startDate);
//             if (endDate) query.createdAt.$lte = new Date(endDate);
//         }

//         if (minAmount || maxAmount) {
//             query['amounts.total'] = {};
//             if (minAmount) query['amounts.total'].$gte = parseFloat(minAmount) * 100;
//             if (maxAmount) query['amounts.total'].$lte = parseFloat(maxAmount) * 100;
//         }

//         if (search) {
//             query.$or = [
//                 { transactionId: { $regex: search, $options: 'i' } },
//                 { stripePaymentIntentId: { $regex: search, $options: 'i' } },
//                 { 'clientSnapshot.name': { $regex: search, $options: 'i' } },
//                 { 'taskerSnapshot.name': { $regex: search, $options: 'i' } },
//                 { 'taskSnapshot.title': { $regex: search, $options: 'i' } }
//             ];
//         }

//         const skip = (parseInt(page) - 1) * parseInt(limit);
//         const sortOptions = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

//         const [transactions, totalCount, aggregateStats] = await Promise.all([
//             Transaction.find(query)
//                 .sort(sortOptions)
//                 .skip(skip)
//                 .limit(parseInt(limit))
//                 .populate('clientId', 'firstName lastName email')
//                 .populate('taskerId', 'firstName lastName email')
//                 .populate('taskId', 'taskTitle'),

//             Transaction.countDocuments(query),

//             Transaction.aggregate([
//                 { $match: query },
//                 {
//                     $group: {
//                         _id: null,
//                         totalRevenue: { $sum: '$amounts.total' },
//                         totalPlatformFees: { $sum: '$amounts.platformFee' },
//                         totalTaskerEarnings: { $sum: '$amounts.taskerEarnings' }
//                     }
//                 }
//             ])
//         ]);

//         const stats = aggregateStats[0] || {
//             totalRevenue: 0,
//             totalPlatformFees: 0,
//             totalTaskerEarnings: 0
//         };

//         res.json({
//             success: true,
//             transactions: transactions.map(t => ({
//                 _id: t._id,
//                 transactionId: t.transactionId,
//                 type: t.type,
//                 status: t.status,

//                 amounts: {
//                     total: (t.amounts.total / 100).toFixed(2),
//                     platformFee: (t.amounts.platformFee / 100).toFixed(2),
//                     platformFeePercentage: t.amounts.platformFeePercentage,
//                     taskerEarnings: (t.amounts.taskerEarnings / 100).toFixed(2)
//                 },

//                 client: t.clientId ? {
//                     id: t.clientId._id,
//                     name: `${t.clientId.firstName || ''} ${t.clientId.lastName || ''}`.trim(),
//                     email: t.clientId.email
//                 } : t.clientSnapshot,

//                 tasker: t.taskerId ? {
//                     id: t.taskerId._id,
//                     name: `${t.taskerId.firstName || ''} ${t.taskerId.lastName || ''}`.trim(),
//                     email: t.taskerId.email
//                 } : t.taskerSnapshot,

//                 task: {
//                     id: t.taskId?._id,
//                     title: t.taskId?.taskTitle || t.taskSnapshot?.title
//                 },

//                 taskerPayout: t.taskerPayout,
//                 stripePaymentIntentId: t.stripePaymentIntentId,

//                 createdAt: t.createdAt,
//                 updatedAt: t.updatedAt
//             })),

//             summary: {
//                 totalRevenue: (stats.totalRevenue / 100).toFixed(2),
//                 totalPlatformFees: (stats.totalPlatformFees / 100).toFixed(2),
//                 totalTaskerEarnings: (stats.totalTaskerEarnings / 100).toFixed(2)
//             },

//             pagination: {
//                 currentPage: parseInt(page),
//                 totalPages: Math.ceil(totalCount / parseInt(limit)),
//                 totalCount,
//                 hasNext: skip + transactions.length < totalCount,
//                 hasPrev: parseInt(page) > 1
//             }
//         });

//     } catch (err) {
//         console.error("getAllTransactions error:", err);
//         res.status(500).json({ error: err.message });
//     }
// };

// // ==================== SINGLE TRANSACTION DETAILS ====================

// export const getTransactionDetails = async (req, res) => {
//     try {
//         const { transactionId } = req.params;

//         const transaction = await Transaction.findOne({
//             $or: [
//                 { _id: transactionId },
//                 { transactionId: transactionId }
//             ]
//         })
//             .populate('clientId', 'firstName lastName email phone stripeCustomerId')
//             .populate('taskerId', 'firstName lastName email phone stripeConnectAccountId')
//             .populate('taskId')
//             .populate('statusHistory.changedBy', 'firstName lastName email')
//             .populate('adminNotes.addedBy', 'firstName lastName email')
//             .populate('taskerPayout.processedBy', 'firstName lastName email');

//         if (!transaction) {
//             return res.status(404).json({ error: 'Transaction not found' });
//         }

//         // Get Stripe details if available
//         let stripeDetails = null;
//         if (transaction.stripePaymentIntentId) {
//             try {
//                 const stripe = (await import('../utils/stripeConfig.js')).default;
//                 stripeDetails = await stripe.paymentIntents.retrieve(
//                     transaction.stripePaymentIntentId,
//                     { expand: ['payment_method', 'charges'] }
//                 );
//             } catch (e) {
//                 console.log('Could not fetch Stripe details:', e.message);
//             }
//         }

//         res.json({
//             success: true,
//             transaction: {
//                 ...transaction.toObject(),
//                 amounts: {
//                     total: (transaction.amounts.total / 100).toFixed(2),
//                     platformFee: (transaction.amounts.platformFee / 100).toFixed(2),
//                     platformFeePercentage: transaction.amounts.platformFeePercentage,
//                     taskerEarnings: (transaction.amounts.taskerEarnings / 100).toFixed(2)
//                 }
//             },
//             stripeDetails: stripeDetails ? {
//                 id: stripeDetails.id,
//                 status: stripeDetails.status,
//                 amount: stripeDetails.amount,
//                 paymentMethod: stripeDetails.payment_method ? {
//                     type: stripeDetails.payment_method.type,
//                     card: stripeDetails.payment_method.card ? {
//                         brand: stripeDetails.payment_method.card.brand,
//                         last4: stripeDetails.payment_method.card.last4,
//                         expMonth: stripeDetails.payment_method.card.exp_month,
//                         expYear: stripeDetails.payment_method.card.exp_year
//                     } : null
//                 } : null,
//                 charges: stripeDetails.charges?.data || []
//             } : null
//         });

//     } catch (err) {
//         console.error("getTransactionDetails error:", err);
//         res.status(500).json({ error: err.message });
//     }
// };

// // ==================== TASKER EARNINGS ====================

// export const getTaskerEarnings = async (req, res) => {
//     try {
//         const { taskerId } = req.params;
//         const { startDate, endDate } = req.query;

//         const tasker = await User.findById(taskerId);
//         if (!tasker) {
//             return res.status(404).json({ error: 'Tasker not found' });
//         }

//         const query = { taskerId };
//         if (startDate || endDate) {
//             query.createdAt = {};
//             if (startDate) query.createdAt.$gte = new Date(startDate);
//             if (endDate) query.createdAt.$lte = new Date(endDate);
//         }

//         const [transactions, stats] = await Promise.all([
//             Transaction.find(query)
//                 .sort({ createdAt: -1 })
//                 .populate('taskId', 'taskTitle')
//                 .populate('clientId', 'firstName lastName'),

//             Transaction.aggregate([
//                 { $match: query },
//                 {
//                     $group: {
//                         _id: '$status',
//                         totalEarnings: { $sum: '$amounts.taskerEarnings' },
//                         count: { $sum: 1 }
//                     }
//                 }
//             ])
//         ]);

//         // Calculate totals
//         let totalEarned = 0;
//         let totalPending = 0;
//         let totalPaid = 0;

//         stats.forEach(s => {
//             if (s._id === 'tasker_paid') {
//                 totalPaid = s.totalEarnings;
//             } else if (['captured', 'tasker_payout_pending', 'tasker_payout_processing'].includes(s._id)) {
//                 totalPending += s.totalEarnings;
//             }
//             totalEarned += s.totalEarnings;
//         });

//         res.json({
//             success: true,
//             tasker: {
//                 id: tasker._id,
//                 name: `${tasker.firstName || ''} ${tasker.lastName || ''}`.trim(),
//                 email: tasker.email,
//                 hasStripeConnect: !!tasker.stripeConnectAccountId
//             },
//             earnings: {
//                 total: (totalEarned / 100).toFixed(2),
//                 pending: (totalPending / 100).toFixed(2),
//                 paid: (totalPaid / 100).toFixed(2)
//             },
//             transactions: transactions.map(t => ({
//                 transactionId: t.transactionId,
//                 taskTitle: t.taskId?.taskTitle || t.taskSnapshot?.title,
//                 clientName: t.clientId ?
//                     `${t.clientId.firstName || ''} ${t.clientId.lastName || ''}`.trim() :
//                     t.clientSnapshot?.name,
//                 amount: (t.amounts.taskerEarnings / 100).toFixed(2),
//                 status: t.status,
//                 payoutStatus: t.taskerPayout?.status,
//                 createdAt: t.createdAt
//             })),
//             byStatus: stats.map(s => ({
//                 status: s._id,
//                 count: s.count,
//                 totalEarnings: (s.totalEarnings / 100).toFixed(2)
//             }))
//         });

//     } catch (err) {
//         console.error("getTaskerEarnings error:", err);
//         res.status(500).json({ error: err.message });
//     }
// };



// // controllers/adminPaymentController.js (continued)

// // ==================== PROCESS SINGLE PAYOUT ====================

// export const processTaskerPayout = async (req, res) => {
//     try {
//         const { transactionId } = req.params;
//         const { payoutMethod, notes } = req.body;
//         const adminUser = req.user;
//         const stripe = (await import('../utils/stripeConfig.js')).default;

//         const transaction = await Transaction.findOne({
//             $or: [{ _id: transactionId }, { transactionId: transactionId }]
//         }).populate('taskerId');

//         if (!transaction) {
//             return res.status(404).json({ error: 'Transaction not found' });
//         }

//         if (transaction.taskerPayout.status !== 'pending') {
//             return res.status(400).json({
//                 error: `Payout already ${transaction.taskerPayout.status}`
//             });
//         }

//         const tasker = transaction.taskerId;
//         let stripeTransferId = null;

//         // Process based on payout method
//         if (payoutMethod === 'stripe_connect' && tasker.stripeConnectAccountId) {
//             // Use Stripe Connect for instant payout
//             const transfer = await stripe.transfers.create({
//                 amount: transaction.amounts.taskerEarnings,
//                 currency: transaction.currency,
//                 destination: tasker.stripeConnectAccountId,
//                 transfer_group: transaction.transactionId,
//                 metadata: {
//                     transactionId: transaction.transactionId,
//                     taskId: transaction.taskId.toString(),
//                     taskerId: tasker._id.toString()
//                 }
//             });

//             stripeTransferId = transfer.id;
//             console.log('Stripe transfer created:', stripeTransferId);
//         }

//         // Update transaction
//         transaction.status = 'tasker_paid';
//         transaction.stripeTransferId = stripeTransferId;
//         transaction.taskerPayout = {
//             status: 'completed',
//             processedDate: new Date(),
//             processedBy: adminUser._id,
//             payoutMethod: payoutMethod,
//             notes: notes
//         };
//         transaction.statusHistory.push({
//             status: 'tasker_paid',
//             changedAt: new Date(),
//             changedBy: adminUser._id,
//             reason: `Payout processed via ${payoutMethod}`
//         });

//         await transaction.save();

//         // Send notification to tasker
//         // await sendPayoutNotification(tasker, transaction);

//         res.json({
//             success: true,
//             message: 'Payout processed successfully',
//             transaction: {
//                 transactionId: transaction.transactionId,
//                 amount: (transaction.amounts.taskerEarnings / 100).toFixed(2),
//                 payoutMethod,
//                 stripeTransferId
//             }
//         });

//     } catch (err) {
//         console.error("processTaskerPayout error:", err);

//         // Update transaction with failure
//         try {
//             await Transaction.findByIdAndUpdate(transactionId, {
//                 $set: {
//                     'taskerPayout.status': 'failed',
//                     'taskerPayout.failureReason': err.message
//                 },
//                 $push: {
//                     statusHistory: {
//                         status: 'payout_failed',
//                         changedAt: new Date(),
//                         reason: err.message
//                     }
//                 }
//             });
//         } catch (updateErr) {
//             console.error('Failed to update transaction status:', updateErr);
//         }

//         res.status(400).json({ error: err.message });
//     }
// };

// // ==================== BULK PAYOUT PROCESSING ====================

// export const processBulkPayouts = async (req, res) => {
//     try {
//         const { transactionIds, payoutMethod } = req.body;
//         const adminUser = req.user;
//         const stripe = (await import('../utils/stripeConfig.js')).default;

//         console.log(req.body)

//         if (!transactionIds || !Array.isArray(transactionIds) || transactionIds.length === 0) {
//             return res.status(400).json({ error: 'No transactions provided' });
//         }

//         const results = {
//             successful: [],
//             failed: []
//         };

//         for (const txnId of transactionIds) {
//             try {
//                 const transaction = await Transaction.findOne({
//                     $or: [{ _id: txnId }, { transactionId: txnId }]
//                 }).populate('taskerId');

//                 if (!transaction) {
//                     results.failed.push({
//                         transactionId: txnId,
//                         error: 'Transaction not found'
//                     });
//                     continue;
//                 }

//                 if (transaction.taskerPayout.status !== 'pending') {
//                     results.failed.push({
//                         transactionId: txnId,
//                         error: `Already ${transaction.taskerPayout.status}`
//                     });
//                     continue;
//                 }

//                 const tasker = transaction.taskerId;
//                 let stripeTransferId = null;

//                 if (payoutMethod === 'stripe_connect' && tasker.stripeConnectAccountId) {
//                     const transfer = await stripe.transfers.create({
//                         amount: transaction.amounts.taskerEarnings,
//                         currency: transaction.currency,
//                         destination: tasker.stripeConnectAccountId,
//                         transfer_group: `BULK-${Date.now()}`
//                     });
//                     stripeTransferId = transfer.id;
//                 }

//                 // Update transaction
//                 transaction.status = 'tasker_paid';
//                 transaction.stripeTransferId = stripeTransferId;
//                 transaction.taskerPayout = {
//                     status: 'completed',
//                     processedDate: new Date(),
//                     processedBy: adminUser._id,
//                     payoutMethod: payoutMethod
//                 };
//                 transaction.statusHistory.push({
//                     status: 'tasker_paid',
//                     changedAt: new Date(),
//                     changedBy: adminUser._id,
//                     reason: 'Bulk payout processed'
//                 });

//                 await transaction.save();

//                 results.successful.push({
//                     transactionId: transaction.transactionId,
//                     amount: (transaction.amounts.taskerEarnings / 100).toFixed(2),
//                     taskerId: tasker._id,
//                     taskerName: `${tasker.firstName || ''} ${tasker.lastName || ''}`.trim()
//                 });

//             } catch (txnError) {
//                 results.failed.push({
//                     transactionId: txnId,
//                     error: txnError.message
//                 });
//             }
//         }

//         res.json({
//             success: true,
//             results: {
//                 totalProcessed: transactionIds.length,
//                 successful: results.successful.length,
//                 failed: results.failed.length,
//                 details: results
//             }
//         });

//     } catch (err) {
//         console.error("processBulkPayouts error:", err);
//         res.status(500).json({ error: err.message });
//     }
// };

// // ==================== PAYOUT BY TASKER ====================

// export const processPayoutByTasker = async (req, res) => {
//     try {
//         const { taskerId } = req.params;
//         const { payoutMethod } = req.body;
//         const adminUser = req.user;

//         // Find all pending payouts for this tasker
//         const transactions = await Transaction.find({
//             taskerId: taskerId,
//             status: 'captured',
//             'taskerPayout.status': 'pending'
//         });

//         if (transactions.length === 0) {
//             return res.status(404).json({ error: 'No pending payouts found for this tasker' });
//         }

//         const transactionIds = transactions.map(t => t._id.toString());

//         // Use bulk payout logic
//         req.body = { transactionIds, payoutMethod };
//         return processBulkPayouts(req, res);

//     } catch (err) {
//         console.error("processPayoutByTasker error:", err);
//         res.status(500).json({ error: err.message });
//     }
// };

// // ==================== PLATFORM SETTINGS ====================

// export const getPlatformSettings = async (req, res) => {
//     try {
//         const settings = await PlatformSettings.getSettings();
//         res.json({ success: true, settings });
//         console.log(req)
//     } catch (err) {
//         console.error("getPlatformSettings error:", err);
//         res.status(500).json({ error: err.message });
//     }
// };

// export const updatePlatformSettings = async (req, res) => {
//     try {
//         const { platformFeePercentage, minimumPayoutAmount, payoutSchedule, payoutDay } = req.body;
//         const adminUser = req.user;

//         console.log(req.user)

//         const update = {
//             $set: {
//                 'value.platformFeePercentage': platformFeePercentage,
//                 'value.minimumPayoutAmount': minimumPayoutAmount,
//                 'value.payoutSchedule': payoutSchedule,
//                 'value.payoutDay': payoutDay,
//                 updatedBy: adminUser._id
//             }
//         };

//         await PlatformSettings.findOneAndUpdate(
//             { key: 'payment_settings' },
//             update,
//             { upsert: true }
//         );

//         res.json({
//             success: true,
//             message: 'Settings updated successfully'
//         });

//     } catch (err) {
//         console.error("updatePlatformSettings error:", err);
//         res.status(500).json({ error: err.message });
//     }
// };

// // ==================== REFUND TRANSACTION ====================

// export const refundTransaction = async (req, res) => {
//     try {
//         const { transactionId } = req.params;
//         const { reason, amount } = req.body; // amount is optional for partial refund
//         const adminUser = req.user;
//         const stripe = (await import('../utils/stripeConfig.js')).default;

//         const transaction = await Transaction.findOne({
//             $or: [{ _id: transactionId }, { transactionId: transactionId }]
//         });

//         if (!transaction) {
//             return res.status(404).json({ error: 'Transaction not found' });
//         }

//         if (!['authorized', 'captured'].includes(transaction.status)) {
//             return res.status(400).json({
//                 error: `Cannot refund transaction with status: ${transaction.status}`
//             });
//         }

//         const refundAmount = amount ? Math.round(amount * 100) : transaction.amounts.total;

//         let refund;
//         if (transaction.status === 'authorized') {
//             // Cancel the authorization
//             await stripe.paymentIntents.cancel(transaction.stripePaymentIntentId);
//         } else {
//             // Refund captured payment
//             refund = await stripe.refunds.create({
//                 payment_intent: transaction.stripePaymentIntentId,
//                 amount: refundAmount,
//                 reason: 'requested_by_customer'
//             });
//         }

//         // Update transaction
//         transaction.status = 'refunded';
//         transaction.taskerPayout.status = 'cancelled';
//         transaction.statusHistory.push({
//             status: 'refunded',
//             changedAt: new Date(),
//             changedBy: adminUser._id,
//             reason: reason || 'Refund requested'
//         });

//         await transaction.save();

//         res.json({
//             success: true,
//             message: 'Refund processed successfully',
//             refund: refund ? {
//                 id: refund.id,
//                 amount: (refund.amount / 100).toFixed(2),
//                 status: refund.status
//             } : { status: 'authorization_cancelled' }
//         });

//     } catch (err) {
//         console.error("refundTransaction error:", err);
//         res.status(400).json({ error: err.message });
//     }
// };

// // ==================== ANALYTICS ====================

// export const getPaymentAnalytics = async (req, res) => {
//     try {
//         const { startDate, endDate, groupBy = 'day' } = req.query;

//         const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
//         const end = endDate ? new Date(endDate) : new Date();

//         let dateFormat;
//         switch (groupBy) {
//             case 'month':
//                 dateFormat = { $dateToString: { format: '%Y-%m', date: '$createdAt' } };
//                 break;
//             case 'week':
//                 dateFormat = { $dateToString: { format: '%Y-W%V', date: '$createdAt' } };
//                 break;
//             default:
//                 dateFormat = { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } };
//         }

//         const analytics = await Transaction.aggregate([
//             {
//                 $match: {
//                     createdAt: { $gte: start, $lte: end },
//                     status: { $in: ['captured', 'tasker_paid'] }
//                 }
//             },
//             {
//                 $group: {
//                     _id: dateFormat,
//                     totalRevenue: { $sum: '$amounts.total' },
//                     platformFees: { $sum: '$amounts.platformFee' },
//                     taskerPayouts: { $sum: '$amounts.taskerEarnings' },
//                     transactionCount: { $sum: 1 }
//                 }
//             },
//             { $sort: { _id: 1 } }
//         ]);

//         // Top taskers by earnings
//         const topTaskers = await Transaction.aggregate([
//             {
//                 $match: {
//                     createdAt: { $gte: start, $lte: end },
//                     status: { $in: ['captured', 'tasker_paid'] }
//                 }
//             },
//             {
//                 $group: {
//                     _id: '$taskerId',
//                     totalEarnings: { $sum: '$amounts.taskerEarnings' },
//                     taskCount: { $sum: 1 }
//                 }
//             },
//             { $sort: { totalEarnings: -1 } },
//             { $limit: 10 },
//             {
//                 $lookup: {
//                     from: 'users',
//                     localField: '_id',
//                     foreignField: '_id',
//                     as: 'tasker'
//                 }
//             },
//             { $unwind: '$tasker' }
//         ]);

//         res.json({
//             success: true,
//             analytics: {
//                 timeline: analytics.map(a => ({
//                     date: a._id,
//                     totalRevenue: (a.totalRevenue / 100).toFixed(2),
//                     platformFees: (a.platformFees / 100).toFixed(2),
//                     taskerPayouts: (a.taskerPayouts / 100).toFixed(2),
//                     transactionCount: a.transactionCount
//                 })),
//                 topTaskers: topTaskers.map(t => ({
//                     id: t._id,
//                     name: `${t.tasker.firstName || ''} ${t.tasker.lastName || ''}`.trim(),
//                     email: t.tasker.email,
//                     totalEarnings: (t.totalEarnings / 100).toFixed(2),
//                     taskCount: t.taskCount
//                 }))
//             }
//         });

//     } catch (err) {
//         console.error("getPaymentAnalytics error:", err);
//         res.status(500).json({ error: err.message });
//     }
// };


// // controllers/adminPaymentController.js


// // Get Stripe payments with enriched tasker data from database
// export const getStripePaymentsWithTaskerData = async (req, res) => {
//     try {
//         const stripe = (await import('../utils/stripeConfig.js')).default;
//         const { limit = 50 } = req.query;

//         console.log('Fetching Stripe payments with tasker data...');

//         // Fetch payment intents from Stripe
//         const paymentIntents = await stripe.paymentIntents.list({
//             limit: parseInt(limit),
//             expand: ['data.customer', 'data.payment_method']
//         });

//         console.log(`Found ${paymentIntents.data.length} payment intents`);

//         // Enrich each payment with tasker data
//         const enrichedPayments = await Promise.all(
//             paymentIntents.data.map(async (pi) => {
//                 try {
//                     // ========== EXTRACT TASK ID ==========
//                     let taskId = pi.metadata?.taskId;

//                     // If not in metadata, try to extract from description
//                     if (!taskId && pi.description) {
//                         // Try multiple patterns
//                         const patterns = [
//                             /Task\s+([a-f0-9]{24})/i,
//                             /task[:\s]+([a-f0-9]{24})/i,
//                             /([a-f0-9]{24})/
//                         ];

//                         for (const pattern of patterns) {
//                             const match = pi.description.match(pattern);
//                             if (match) {
//                                 taskId = match[1];
//                                 break;
//                             }
//                         }
//                     }

//                     console.log(`Payment ${pi.id}: taskId = ${taskId || 'NOT FOUND'}`);

//                     let taskData = null;
//                     let taskerData = null;
//                     let clientData = null;
//                     let bidData = null;

//                     if (taskId) {
//                         // Fetch task with populated data
//                         // FIXED: Using correct field names from your schema
//                         const task = await Task.findById(taskId)
//                             .populate('client', 'firstName lastName email phone') // Changed from userId to client
//                             .populate('acceptedBy', 'firstName lastName email phone stripeConnectAccountId'); // Changed from assignedTo to acceptedBy

//                         console.log(`Task found: ${task ? 'YES' : 'NO'}`);

//                         if (task) {
//                             console.log('Task details:', {
//                                 title: task.taskTitle,
//                                 status: task.status,
//                                 clientId: task.client?._id,
//                                 acceptedById: task.acceptedBy?._id,
//                                 bidsCount: task.bids?.length || 0
//                             });

//                             taskData = {
//                                 _id: task._id,
//                                 title: task.taskTitle || task.serviceTitle,
//                                 description: task.taskDescription?.substring(0, 200),
//                                 status: task.status,
//                                 budget: task.price,
//                                 totalAmount: task.totalAmount,
//                                 createdAt: task.createdAt
//                             };

//                             // ========== CLIENT (task poster) ==========
//                             // FIXED: Using 'client' instead of 'userId'
//                             if (task.client) {
//                                 clientData = {
//                                     _id: task.client._id,
//                                     name: `${task.client.firstName || ''} ${task.client.lastName || ''}`.trim() || 'Unknown',
//                                     email: task.client.email,
//                                     phone: task.client.phone
//                                 };
//                                 console.log('Client found:', clientData.name);
//                             }

//                             // ========== TASKER (accepted the task) ==========
//                             // FIXED: Using 'acceptedBy' instead of 'assignedTo'
//                             if (task.acceptedBy) {
//                                 taskerData = {
//                                     _id: task.acceptedBy._id,
//                                     name: `${task.acceptedBy.firstName || ''} ${task.acceptedBy.lastName || ''}`.trim() || 'Unknown',
//                                     email: task.acceptedBy.email,
//                                     phone: task.acceptedBy.phone,
//                                     hasStripeConnect: !!task.acceptedBy.stripeConnectAccountId,
//                                     stripeConnectAccountId: task.acceptedBy.stripeConnectAccountId
//                                 };
//                                 console.log('Tasker found from acceptedBy:', taskerData.name);
//                             }

//                             // ========== FIND FROM BIDS ==========
//                             // If no acceptedBy, look through bids
//                             if (!taskerData && task.bids && task.bids.length > 0) {
//                                 console.log(`Checking ${task.bids.length} bids...`);

//                                 // Get the first bid (or you could find accepted bid if you have status)
//                                 // Your bids schema uses 'taskerId' not 'bidderId'
//                                 for (const bid of task.bids) {
//                                     if (bid.taskerId) {
//                                         // Fetch the tasker details
//                                         const bidder = await User.findById(bid.taskerId)
//                                             .select('firstName lastName email phone stripeConnectAccountId');

//                                         if (bidder) {
//                                             taskerData = {
//                                                 _id: bidder._id,
//                                                 name: `${bidder.firstName || ''} ${bidder.lastName || ''}`.trim() || 'Unknown',
//                                                 email: bidder.email,
//                                                 phone: bidder.phone,
//                                                 hasStripeConnect: !!bidder.stripeConnectAccountId,
//                                                 stripeConnectAccountId: bidder.stripeConnectAccountId
//                                             };

//                                             bidData = {
//                                                 _id: bid._id,
//                                                 amount: bid.offerPrice,
//                                                 message: bid.message,
//                                                 taskerId: bid.taskerId,
//                                                 taskerName: taskerData.name,
//                                                 createdAt: bid.createdAt
//                                             };

//                                             console.log('Tasker found from bids:', taskerData.name);
//                                             break; // Found a tasker, stop looking
//                                         }
//                                     }
//                                 }
//                             }

//                             // ========== CHECK METADATA FOR TASKER ID ==========
//                             if (!taskerData && pi.metadata?.taskerId) {
//                                 console.log('Checking metadata for taskerId:', pi.metadata.taskerId);
//                                 const tasker = await User.findById(pi.metadata.taskerId)
//                                     .select('firstName lastName email phone stripeConnectAccountId');

//                                 if (tasker) {
//                                     taskerData = {
//                                         _id: tasker._id,
//                                         name: `${tasker.firstName || ''} ${tasker.lastName || ''}`.trim() || 'Unknown',
//                                         email: tasker.email,
//                                         phone: tasker.phone,
//                                         hasStripeConnect: !!tasker.stripeConnectAccountId,
//                                         stripeConnectAccountId: tasker.stripeConnectAccountId
//                                     };
//                                     console.log('Tasker found from metadata:', taskerData.name);
//                                 }
//                             }

//                             // ========== USE METADATA NAME/EMAIL AS FALLBACK ==========
//                             if (!taskerData && (pi.metadata?.taskerName || pi.metadata?.taskerEmail)) {
//                                 taskerData = {
//                                     name: pi.metadata.taskerName || 'Unknown',
//                                     email: pi.metadata.taskerEmail || '',
//                                     hasStripeConnect: false
//                                 };
//                                 console.log('Tasker from metadata name/email:', taskerData.name);
//                             }
//                         }
//                     } else {
//                         console.log('No taskId found for payment:', pi.id);
//                     }

//                     // ========== CALCULATE AMOUNTS ==========
//                     const platformFeePercentage = 15;
//                     const totalAmount = pi.amount;
//                     const platformFee = Math.round(totalAmount * (platformFeePercentage / 100));
//                     const taskerEarnings = totalAmount - platformFee;

//                     // Check if exists in database
//                     const existsInDb = await Transaction.exists({ stripePaymentIntentId: pi.id });

//                     return {
//                         // Stripe data
//                         id: pi.id,
//                         amount: (pi.amount / 100).toFixed(2),
//                         amountCents: pi.amount,
//                         currency: pi.currency.toUpperCase(),
//                         status: pi.status,
//                         description: pi.description,
//                         created: new Date(pi.created * 1000).toISOString(),

//                         // Payment breakdown
//                         breakdown: {
//                             total: (totalAmount / 100).toFixed(2),
//                             platformFee: (platformFee / 100).toFixed(2),
//                             platformFeePercentage: platformFeePercentage,
//                             taskerEarnings: (taskerEarnings / 100).toFixed(2)
//                         },

//                         // Stripe customer (who paid)
//                         stripeCustomer: {
//                             id: pi.customer?.id || pi.customer,
//                             email: pi.customer?.email || 'N/A',
//                             name: pi.customer?.name || 'N/A'
//                         },

//                         // Card info
//                         paymentMethod: pi.payment_method ? {
//                             type: pi.payment_method.type,
//                             brand: pi.payment_method.card?.brand,
//                             last4: pi.payment_method.card?.last4
//                         } : null,

//                         // Metadata
//                         metadata: pi.metadata,

//                         // Enriched data from database
//                         taskId: taskId,
//                         task: taskData,
//                         client: clientData,
//                         tasker: taskerData,
//                         bid: bidData,

//                         // Status flags
//                         canCapture: pi.status === 'requires_capture',
//                         canRefund: pi.status === 'succeeded',
//                         hasTaskerData: !!taskerData,
//                         hasClientData: !!clientData,

//                         // Check if already in local database
//                         existsInDatabase: !!existsInDb
//                     };
//                 } catch (err) {
//                     console.error(`Error enriching payment ${pi.id}:`, err.message);
//                     return {
//                         id: pi.id,
//                         amount: (pi.amount / 100).toFixed(2),
//                         currency: pi.currency.toUpperCase(),
//                         status: pi.status,
//                         description: pi.description,
//                         created: new Date(pi.created * 1000).toISOString(),
//                         error: err.message,
//                         stripeCustomer: {
//                             email: pi.customer?.email || 'N/A'
//                         },
//                         hasTaskerData: false,
//                         hasClientData: false
//                     };
//                 }
//             })
//         );

//         // Summary statistics
//         const summary = {
//             total: enrichedPayments.length,
//             succeeded: enrichedPayments.filter(p => p.status === 'succeeded').length,
//             uncaptured: enrichedPayments.filter(p => p.status === 'requires_capture').length,
//             canceled: enrichedPayments.filter(p => p.status === 'canceled').length,
//             withTaskerData: enrichedPayments.filter(p => p.hasTaskerData).length,
//             withClientData: enrichedPayments.filter(p => p.hasClientData).length,
//             withoutTaskerData: enrichedPayments.filter(p => !p.hasTaskerData).length,
//             totalAmount: enrichedPayments
//                 .filter(p => ['succeeded', 'requires_capture'].includes(p.status))
//                 .reduce((sum, p) => sum + parseFloat(p.amount), 0)
//                 .toFixed(2),
//             totalTaskerEarnings: enrichedPayments
//                 .filter(p => ['succeeded', 'requires_capture'].includes(p.status) && p.breakdown)
//                 .reduce((sum, p) => sum + parseFloat(p.breakdown.taskerEarnings), 0)
//                 .toFixed(2)
//         };

//         console.log('\n========== SUMMARY ==========');
//         console.log('Total payments:', summary.total);
//         console.log('With tasker data:', summary.withTaskerData);
//         console.log('With client data:', summary.withClientData);
//         console.log('Without tasker data:', summary.withoutTaskerData);
//         console.log('==============================\n');

//         res.json({
//             success: true,
//             payments: enrichedPayments,
//             summary: summary
//         });

//     } catch (err) {
//         console.error('getStripePaymentsWithTaskerData error:', err);
//         res.status(500).json({ error: err.message });
//     }
// };

// // Sync Stripe payments to local database with full tasker data
// // controllers/adminPaymentController.js

// export const syncStripeToDatabase = async (req, res) => {
//     try {
//         const stripe = (await import('../utils/stripeConfig.js')).default;

//         console.log('Starting full sync from Stripe...');

//         const paymentIntents = await stripe.paymentIntents.list({
//             limit: 100,
//             expand: ['data.customer']
//         });

//         const results = {
//             synced: [],
//             updated: [],
//             skipped: [],
//             errors: []
//         };

//         const platformFeePercentage = 15;

//         for (const pi of paymentIntents.data) {
//             try {
//                 // Extract taskId
//                 let taskId = pi.metadata?.taskId;
//                 if (!taskId && pi.description) {
//                     const match = pi.description.match(/([a-f0-9]{24})/i);
//                     if (match) taskId = match[1];
//                 }

//                 if (!taskId) {
//                     results.skipped.push({
//                         id: pi.id,
//                         reason: 'No taskId found'
//                     });
//                     continue;
//                 }

//                 // Check if already exists
//                 const existing = await Transaction.findOne({ stripePaymentIntentId: pi.id });

//                 // Fetch task and related data
//                 // FIXED: Using correct field names
//                 const task = await Task.findById(taskId)
//                     .populate('client', 'firstName lastName email')  // Changed from userId
//                     .populate('acceptedBy', 'firstName lastName email stripeConnectAccountId');  // Changed from assignedTo

//                 if (!task) {
//                     results.skipped.push({
//                         id: pi.id,
//                         reason: 'Task not found in database'
//                     });
//                     continue;
//                 }

//                 // Find tasker - from acceptedBy or from bids or from metadata
//                 let tasker = task.acceptedBy;
//                 let taskerId = task.acceptedBy?._id;

//                 // If no acceptedBy, check bids
//                 if (!tasker && task.bids && task.bids.length > 0) {
//                     for (const bid of task.bids) {
//                         if (bid.taskerId) {
//                             tasker = await User.findById(bid.taskerId)
//                                 .select('firstName lastName email stripeConnectAccountId');
//                             if (tasker) {
//                                 taskerId = tasker._id;
//                                 break;
//                             }
//                         }
//                     }
//                 }

//                 // Check metadata
//                 if (!tasker && pi.metadata?.taskerId) {
//                     tasker = await User.findById(pi.metadata.taskerId);
//                     taskerId = pi.metadata.taskerId;
//                 }

//                 if (!tasker) {
//                     results.skipped.push({
//                         id: pi.id,
//                         reason: 'No tasker found for this task'
//                     });
//                     continue;
//                 }

//                 // Calculate amounts
//                 const totalAmountCents = pi.amount;
//                 const platformFeeCents = Math.round(totalAmountCents * (platformFeePercentage / 100));
//                 const taskerEarningsCents = totalAmountCents - platformFeeCents;

//                 // Determine status
//                 let status = 'pending';
//                 let payoutStatus = 'pending';

//                 switch (pi.status) {
//                     case 'requires_capture':
//                         status = 'authorized';
//                         break;
//                     case 'succeeded':
//                         status = 'captured';
//                         break;
//                     case 'canceled':
//                         status = 'cancelled';
//                         payoutStatus = 'cancelled';
//                         break;
//                 }

//                 // In syncStripeToDatabase function, update the create section:

//                 // Create new transaction
//                 const transactionId = `TXN-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

//                 const transaction = new Transaction({
//                     transactionId: transactionId,  // Explicitly set
//                     type: 'bid_authorization',
//                     taskId: taskId,
//                     clientId: task.client?._id,
//                     taskerId: taskerId,
//                     stripePaymentIntentId: pi.id,
//                     stripeCustomerId: pi.customer?.id || pi.customer,
//                     amounts: {
//                         total: totalAmountCents,
//                         platformFee: platformFeeCents,
//                         platformFeePercentage: platformFeePercentage,
//                         taskerEarnings: taskerEarningsCents
//                     },
//                     currency: pi.currency,
//                     status: status,
//                     taskerPayout: {
//                         status: payoutStatus,
//                         scheduledDate: status === 'captured' ?
//                             new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : null
//                     },
//                     taskSnapshot: {
//                         title: task.taskTitle || task.serviceTitle || '',
//                         description: task.taskDescription?.substring(0, 500) || ''
//                     },
//                     clientSnapshot: {
//                         name: task.client ?
//                             `${task.client.firstName || ''} ${task.client.lastName || ''}`.trim() :
//                             pi.customer?.name || 'Unknown',
//                         email: task.client?.email || pi.customer?.email || ''
//                     },
//                     taskerSnapshot: {
//                         name: `${tasker.firstName || ''} ${tasker.lastName || ''}`.trim() || 'Unknown',
//                         email: tasker.email || '',
//                         stripeConnectAccountId: tasker.stripeConnectAccountId || null
//                     },
//                     statusHistory: [{
//                         status: status,
//                         changedAt: new Date(pi.created * 1000),
//                         reason: 'Synced from Stripe'
//                     }]
//                 });

//                 await transaction.save();

//                 results.synced.push({
//                     id: pi.id,
//                     transactionId: transaction.transactionId,
//                     taskerEmail: tasker.email,
//                     amount: (totalAmountCents / 100).toFixed(2),
//                     taskerEarnings: (taskerEarningsCents / 100).toFixed(2)
//                 });

//                 if (existing) {
//                     // Update existing
//                     await Transaction.findByIdAndUpdate(existing._id, {
//                         $set: transactionData,
//                         $push: {
//                             statusHistory: {
//                                 status: status,
//                                 changedAt: new Date(),
//                                 reason: 'Re-synced from Stripe'
//                             }
//                         }
//                     });

//                     results.updated.push({
//                         id: pi.id,
//                         transactionId: existing.transactionId,
//                         taskerEmail: tasker.email
//                     });
//                 } else {
//                     // Create new
//                     const transaction = await Transaction.create({
//                         ...transactionData,
//                         statusHistory: [{
//                             status: status,
//                             changedAt: new Date(pi.created * 1000),
//                             reason: 'Synced from Stripe'
//                         }]
//                     });

//                     results.synced.push({
//                         id: pi.id,
//                         transactionId: transaction.transactionId,
//                         taskerEmail: tasker.email,
//                         amount: (totalAmountCents / 100).toFixed(2),
//                         taskerEarnings: (taskerEarningsCents / 100).toFixed(2)
//                     });
//                 }

//             } catch (err) {
//                 console.error(`Error processing ${pi.id}:`, err.message);
//                 results.errors.push({
//                     id: pi.id,
//                     error: err.message
//                 });
//             }
//         }

//         res.json({
//             success: true,
//             message: 'Sync completed',
//             results: {
//                 total: paymentIntents.data.length,
//                 synced: results.synced.length,
//                 updated: results.updated.length,
//                 skipped: results.skipped.length,
//                 errors: results.errors.length,
//                 details: results
//             }
//         });

//     } catch (err) {
//         console.error('syncStripeToDatabase error:', err);
//         res.status(500).json({ error: err.message });
//     }
// };

// // Get pending payouts with full tasker details
// export const getPendingPayoutsWithTaskerDetails = async (req, res) => {
//     try {
//         const payouts = await Transaction.find({
//             status: { $in: ['captured', 'authorized'] },
//             'taskerPayout.status': 'pending'
//         })
//             .populate('clientId', 'firstName lastName email phone')
//             .populate('taskerId', 'firstName lastName email phone stripeConnectAccountId')
//             .populate('taskId', 'taskTitle status')
//             .sort({ createdAt: -1 });

//         // Group by tasker
//         const taskerGroups = {};

//         payouts.forEach(payout => {
//             const taskerId = payout.taskerId?._id?.toString() || payout.taskerSnapshot?.email || 'unknown';

//             if (!taskerGroups[taskerId]) {
//                 taskerGroups[taskerId] = {
//                     tasker: payout.taskerId ? {
//                         _id: payout.taskerId._id,
//                         name: `${payout.taskerId.firstName || ''} ${payout.taskerId.lastName || ''}`.trim(),
//                         email: payout.taskerId.email,
//                         phone: payout.taskerId.phone,
//                         hasStripeConnect: !!payout.taskerId.stripeConnectAccountId
//                     } : {
//                         name: payout.taskerSnapshot?.name || 'Unknown',
//                         email: payout.taskerSnapshot?.email || 'Unknown',
//                         hasStripeConnect: !!payout.taskerSnapshot?.stripeConnectAccountId
//                     },
//                     transactions: [],
//                     totalEarnings: 0,
//                     transactionCount: 0
//                 };
//             }

//             const earnings = payout.amounts?.taskerEarnings || 0;
//             taskerGroups[taskerId].transactions.push({
//                 _id: payout._id,
//                 transactionId: payout.transactionId,
//                 taskTitle: payout.taskId?.taskTitle || payout.taskSnapshot?.title,
//                 client: payout.clientId ? {
//                     name: `${payout.clientId.firstName || ''} ${payout.clientId.lastName || ''}`.trim(),
//                     email: payout.clientId.email
//                 } : payout.clientSnapshot,
//                 amounts: {
//                     total: (payout.amounts?.total / 100).toFixed(2),
//                     platformFee: (payout.amounts?.platformFee / 100).toFixed(2),
//                     taskerEarnings: (earnings / 100).toFixed(2)
//                 },
//                 status: payout.status,
//                 createdAt: payout.createdAt
//             });
//             taskerGroups[taskerId].totalEarnings += earnings;
//             taskerGroups[taskerId].transactionCount += 1;
//         });

//         // Convert to array and format
//         const groupedPayouts = Object.values(taskerGroups).map(group => ({
//             ...group,
//             totalEarnings: (group.totalEarnings / 100).toFixed(2)
//         }));

//         // Also return flat list
//         const flatPayouts = payouts.map(p => ({
//             _id: p._id,
//             transactionId: p.transactionId,
//             stripePaymentIntentId: p.stripePaymentIntentId,

//             task: {
//                 _id: p.taskId?._id,
//                 title: p.taskId?.taskTitle || p.taskSnapshot?.title
//             },

//             client: p.clientId ? {
//                 _id: p.clientId._id,
//                 name: `${p.clientId.firstName || ''} ${p.clientId.lastName || ''}`.trim(),
//                 email: p.clientId.email
//             } : p.clientSnapshot,

//             tasker: p.taskerId ? {
//                 _id: p.taskerId._id,
//                 name: `${p.taskerId.firstName || ''} ${p.taskerId.lastName || ''}`.trim(),
//                 email: p.taskerId.email,
//                 phone: p.taskerId.phone,
//                 hasStripeConnect: !!p.taskerId.stripeConnectAccountId
//             } : p.taskerSnapshot,

//             amounts: {
//                 total: (p.amounts?.total / 100).toFixed(2),
//                 platformFee: (p.amounts?.platformFee / 100).toFixed(2),
//                 platformFeePercentage: p.amounts?.platformFeePercentage,
//                 taskerEarnings: (p.amounts?.taskerEarnings / 100).toFixed(2)
//             },

//             status: p.status,
//             payoutStatus: p.taskerPayout?.status,
//             createdAt: p.createdAt
//         }));

//         res.json({
//             success: true,
//             summary: {
//                 totalPayouts: payouts.length,
//                 totalTaskers: Object.keys(taskerGroups).length,
//                 totalPendingAmount: payouts
//                     .reduce((sum, p) => sum + (p.amounts?.taskerEarnings || 0), 0) / 100
//             },
//             groupedByTasker: groupedPayouts,
//             payouts: flatPayouts
//         });

//     } catch (err) {
//         console.error('getPendingPayoutsWithTaskerDetails error:', err);
//         res.status(500).json({ error: err.message });
//     }
// };



// // controllers/adminPaymentController.js

// // Add this function to capture a payment
// // controllers/adminPaymentController.js

// export const capturePayment = async (req, res) => {
//     try {
//         const { taskId } = req.params;
//         const { paymentIntentId } = req.body;
//         const stripe = (await import('../utils/stripeConfig.js')).default;

//         console.log('Capturing payment:', { taskId, paymentIntentId });

//         if (!paymentIntentId) {
//             return res.status(400).json({ error: 'Payment Intent ID is required' });
//         }

//         // Get the payment intent from Stripe
//         const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

//         if (paymentIntent.status !== 'requires_capture') {
//             return res.status(400).json({
//                 error: `Cannot capture payment. Current status: ${paymentIntent.status}`
//             });
//         }

//         // Capture the payment
//         const capturedPayment = await stripe.paymentIntents.capture(paymentIntentId);

//         console.log('Payment captured:', capturedPayment.id, 'Status:', capturedPayment.status);

//         if (capturedPayment.status !== 'succeeded') {
//             return res.status(400).json({
//                 error: `Capture failed. Status: ${capturedPayment.status}`
//             });
//         }

//         // Update task in database
//         await Task.findByIdAndUpdate(
//             taskId,
//             {
//                 $set: {
//                     stripeStatus: 'captured',
//                     'paymentInfo.status': 'captured',
//                     'paymentInfo.capturedAt': new Date()
//                 }
//             },
//             { new: true }
//         );

//         // Update or create transaction record
//         let transaction = await Transaction.findOne({ stripePaymentIntentId: paymentIntentId });

//         if (transaction) {
//             // Update existing transaction
//             transaction.status = 'captured';
//             transaction.taskerPayout = {
//                 status: 'pending',
//                 scheduledDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
//             };
//             transaction.statusHistory.push({
//                 status: 'captured',
//                 changedAt: new Date(),
//                 reason: 'Payment captured by admin'
//             });
//             await transaction.save();
//             console.log('Transaction updated:', transaction.transactionId);
//         } else {
//             // Create new transaction
//             const platformFeePercentage = 15;
//             const totalAmount = capturedPayment.amount;
//             const platformFee = Math.round(totalAmount * (platformFeePercentage / 100));
//             const taskerEarnings = totalAmount - platformFee;

//             // Get task details with correct field names
//             const taskDetails = await Task.findById(taskId)
//                 .populate('client', 'firstName lastName email')
//                 .populate('acceptedBy', 'firstName lastName email stripeConnectAccountId');

//             let taskerId = taskDetails?.acceptedBy?._id;
//             let taskerSnapshot = { name: 'Unknown', email: '' };

//             if (taskDetails?.acceptedBy) {
//                 taskerSnapshot = {
//                     name: `${taskDetails.acceptedBy.firstName || ''} ${taskDetails.acceptedBy.lastName || ''}`.trim() || 'Unknown',
//                     email: taskDetails.acceptedBy.email || '',
//                     stripeConnectAccountId: taskDetails.acceptedBy.stripeConnectAccountId || null
//                 };
//             } else if (taskDetails?.bids?.length > 0) {
//                 // Get tasker from bids
//                 const firstBid = taskDetails.bids[0];
//                 if (firstBid.taskerId) {
//                     const tasker = await User.findById(firstBid.taskerId);
//                     if (tasker) {
//                         taskerId = tasker._id;
//                         taskerSnapshot = {
//                             name: `${tasker.firstName || ''} ${tasker.lastName || ''}`.trim() || 'Unknown',
//                             email: tasker.email || '',
//                             stripeConnectAccountId: tasker.stripeConnectAccountId || null
//                         };
//                     }
//                 }
//             }

//             // Generate transaction ID manually as a backup
//             const transactionId = `TXN-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

//             transaction = new Transaction({
//                 transactionId: transactionId,  // Explicitly set
//                 type: 'bid_authorization',
//                 taskId: taskId,
//                 clientId: taskDetails?.client?._id || null,
//                 taskerId: taskerId || null,
//                 stripePaymentIntentId: paymentIntentId,
//                 stripeCustomerId: capturedPayment.customer,
//                 amounts: {
//                     total: totalAmount,
//                     platformFee: platformFee,
//                     platformFeePercentage: platformFeePercentage,
//                     taskerEarnings: taskerEarnings
//                 },
//                 currency: capturedPayment.currency,
//                 status: 'captured',
//                 taskerPayout: {
//                     status: 'pending',
//                     scheduledDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
//                 },
//                 taskSnapshot: {
//                     title: taskDetails?.taskTitle || taskDetails?.serviceTitle || 'Unknown Task',
//                     description: taskDetails?.taskDescription?.substring(0, 500) || ''
//                 },
//                 clientSnapshot: {
//                     name: taskDetails?.client ?
//                         `${taskDetails.client.firstName || ''} ${taskDetails.client.lastName || ''}`.trim() :
//                         'Unknown',
//                     email: taskDetails?.client?.email || ''
//                 },
//                 taskerSnapshot: taskerSnapshot,
//                 statusHistory: [{
//                     status: 'captured',
//                     changedAt: new Date(),
//                     reason: 'Payment captured by admin'
//                 }]
//             });

//             await transaction.save();
//             console.log('New transaction created:', transaction.transactionId);
//         }

//         res.json({
//             success: true,
//             message: 'Payment captured successfully',
//             paymentIntent: {
//                 id: capturedPayment.id,
//                 status: capturedPayment.status,
//                 amount: (capturedPayment.amount / 100).toFixed(2),
//                 currency: capturedPayment.currency
//             },
//             transactionId: transaction?.transactionId
//         });

//     } catch (err) {
//         console.error('capturePayment error:', err);

//         if (err.type === 'StripeInvalidRequestError') {
//             return res.status(400).json({ error: err.message });
//         }

//         res.status(500).json({ error: err.message });
//     }
// };

// // Cancel/Release an authorized payment
// export const cancelPayment = async (req, res) => {
//     try {
//         const { taskId } = req.params;
//         const { paymentIntentId, reason } = req.body;
//         const stripe = (await import('../utils/stripeConfig.js')).default;

//         console.log('Canceling payment:', { taskId, paymentIntentId, reason });

//         if (!paymentIntentId) {
//             return res.status(400).json({ error: 'Payment Intent ID is required' });
//         }

//         // Cancel the payment intent
//         const canceledPayment = await stripe.paymentIntents.cancel(paymentIntentId, {
//             cancellation_reason: 'requested_by_customer'
//         });

//         console.log('Payment canceled:', canceledPayment.id);

//         // Update task
//         await Task.findByIdAndUpdate(taskId, {
//             $set: {
//                 stripeStatus: 'canceled',
//                 'paymentInfo.status': 'canceled',
//                 'paymentInfo.canceledAt': new Date()
//             }
//         });

//         // Update transaction if exists
//         await Transaction.findOneAndUpdate(
//             { stripePaymentIntentId: paymentIntentId },
//             {
//                 $set: {
//                     status: 'cancelled',
//                     'taskerPayout.status': 'cancelled'
//                 },
//                 $push: {
//                     statusHistory: {
//                         status: 'cancelled',
//                         changedAt: new Date(),
//                         reason: reason || 'Canceled by admin'
//                     }
//                 }
//             }
//         );

//         res.json({
//             success: true,
//             message: 'Payment canceled successfully',
//             paymentIntent: {
//                 id: canceledPayment.id,
//                 status: canceledPayment.status
//             }
//         });

//     } catch (err) {
//         console.error('cancelPayment error:', err);
//         res.status(500).json({ error: err.message });
//     }
// };



// controllers/adminPaymentController.js

import mongoose from 'mongoose';
import Transaction from '../models/Transaction.js';
import Task from '../models/task.js';
import User from '../models/user.js';
import PlatformSettings from '../models/PlatformSettings.js';

// Helper to check if string is valid ObjectId
const isValidObjectId = (id) => {
    if (!id || typeof id !== 'string') return false;
    return mongoose.Types.ObjectId.isValid(id) &&
        (new mongoose.Types.ObjectId(id)).toString() === id;
};

// Helper to generate transaction ID
const generateTransactionId = () => {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `TXN-${year}${month}${day}-${timestamp}-${random}`;
};

// ==================== DASHBOARD ====================
export const getPaymentDashboard = async (req, res) => {
    try {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

        const [
            pendingPayouts,
            thisMonthStats,
            lastMonthStats,
            recentTransactions,
            payoutsByStatus
        ] = await Promise.all([
            // Pending payouts
            Transaction.aggregate([
                {
                    $match: {
                        status: { $in: ['captured', 'authorized'] },
                        'taskerPayout.status': { $in: ['pending', null, undefined] }
                    }
                },
                {
                    $group: {
                        _id: null,
                        count: { $sum: 1 },
                        totalAmount: { $sum: '$amounts.taskerEarnings' }
                    }
                }
            ]),

            // This month stats
            Transaction.aggregate([
                {
                    $match: {
                        status: { $in: ['captured', 'tasker_paid'] },
                        createdAt: { $gte: startOfMonth }
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalRevenue: { $sum: '$amounts.total' },
                        platformFees: { $sum: '$amounts.platformFee' },
                        taskerPayouts: { $sum: '$amounts.taskerEarnings' },
                        transactionCount: { $sum: 1 }
                    }
                }
            ]),

            // Last month stats
            Transaction.aggregate([
                {
                    $match: {
                        status: { $in: ['captured', 'tasker_paid'] },
                        createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth }
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalRevenue: { $sum: '$amounts.total' },
                        platformFees: { $sum: '$amounts.platformFee' }
                    }
                }
            ]),

            // Recent transactions
            Transaction.find()
                .sort({ createdAt: -1 })
                .limit(10)
                .populate('clientId', 'firstName lastName email')
                .populate('taskerId', 'firstName lastName email')
                .populate('taskId', 'taskTitle')
                .lean(),

            // Payouts by status
            Transaction.aggregate([
                {
                    $match: {
                        status: { $in: ['captured', 'tasker_payout_processing', 'tasker_paid'] }
                    }
                },
                {
                    $group: {
                        _id: '$taskerPayout.status',
                        count: { $sum: 1 },
                        totalAmount: { $sum: '$amounts.taskerEarnings' }
                    }
                }
            ])
        ]);

        const thisMonth = thisMonthStats[0] || { totalRevenue: 0, platformFees: 0, taskerPayouts: 0, transactionCount: 0 };
        const lastMonth = lastMonthStats[0] || { totalRevenue: 0, platformFees: 0 };
        const pending = pendingPayouts[0] || { count: 0, totalAmount: 0 };

        const revenueGrowth = lastMonth.totalRevenue > 0
            ? ((thisMonth.totalRevenue - lastMonth.totalRevenue) / lastMonth.totalRevenue * 100)
            : 0;

        res.json({
            success: true,
            dashboard: {
                summary: {
                    pendingPayoutsCount: pending.count,
                    pendingPayoutsAmount: (pending.totalAmount / 100).toFixed(2),
                    thisMonth: {
                        totalRevenue: (thisMonth.totalRevenue / 100).toFixed(2),
                        platformFees: (thisMonth.platformFees / 100).toFixed(2),
                        taskerPayouts: (thisMonth.taskerPayouts / 100).toFixed(2),
                        transactionCount: thisMonth.transactionCount
                    },
                    lastMonth: {
                        totalRevenue: (lastMonth.totalRevenue / 100).toFixed(2),
                        platformFees: (lastMonth.platformFees / 100).toFixed(2)
                    },
                    growth: {
                        revenue: parseFloat(revenueGrowth.toFixed(1))
                    }
                },
                payoutsByStatus: (payoutsByStatus || []).map(item => ({
                    status: item._id || 'pending',
                    count: item.count,
                    totalAmount: (item.totalAmount / 100).toFixed(2)
                })),
                recentTransactions: (recentTransactions || []).map(t => ({
                    transactionId: t.transactionId,
                    type: t.type,
                    status: t.status,
                    amounts: {
                        total: ((t.amounts?.total || 0) / 100).toFixed(2),
                        platformFee: ((t.amounts?.platformFee || 0) / 100).toFixed(2),
                        taskerEarnings: ((t.amounts?.taskerEarnings || 0) / 100).toFixed(2)
                    },
                    client: t.clientId ? {
                        name: `${t.clientId.firstName || ''} ${t.clientId.lastName || ''}`.trim(),
                        email: t.clientId.email
                    } : t.clientSnapshot,
                    tasker: t.taskerId ? {
                        name: `${t.taskerId.firstName || ''} ${t.taskerId.lastName || ''}`.trim(),
                        email: t.taskerId.email
                    } : t.taskerSnapshot,
                    task: t.taskId?.taskTitle || t.taskSnapshot?.title,
                    createdAt: t.createdAt
                }))
            }
        });

    } catch (err) {
        console.error('getPaymentDashboard error:', err);
        res.status(500).json({ error: err.message });
    }
};

// ==================== STRIPE PAYMENTS ====================
export const getStripePaymentsWithTaskerData = async (req, res) => {
    try {
        const stripe = (await import('../utils/stripeConfig.js')).default;
        const { limit = 50 } = req.query;

        const paymentIntents = await stripe.paymentIntents.list({
            limit: parseInt(limit),
            expand: ['data.customer', 'data.payment_method']
        });

        const enrichedPayments = await Promise.all(
            paymentIntents.data.map(async (pi) => {
                try {
                    let taskId = pi.metadata?.taskId;
                    if (!taskId && pi.description) {
                        const patterns = [/Task\s+([a-f0-9]{24})/i, /([a-f0-9]{24})/];
                        for (const pattern of patterns) {
                            const match = pi.description.match(pattern);
                            if (match) { taskId = match[1]; break; }
                        }
                    }

                    let taskData = null, taskerData = null, clientData = null;

                    if (taskId) {
                        const task = await Task.findById(taskId)
                            .populate('client', 'firstName lastName email phone')
                            .populate('acceptedBy', 'firstName lastName email phone stripeConnectAccountId accountHolder accountNumber routingNumber');

                        if (task) {
                            taskData = {
                                _id: task._id,
                                title: task.taskTitle || task.serviceTitle,
                                status: task.status,
                                budget: task.price
                            };

                            if (task.client) {
                                clientData = {
                                    _id: task.client._id,
                                    name: `${task.client.firstName || ''} ${task.client.lastName || ''}`.trim(),
                                    email: task.client.email
                                };
                            }

                            if (task.acceptedBy) {
                                taskerData = {
                                    _id: task.acceptedBy._id,
                                    name: `${task.acceptedBy.firstName || ''} ${task.acceptedBy.lastName || ''}`.trim(),
                                    email: task.acceptedBy.email,
                                    hasBankDetails: !!(task.acceptedBy.accountNumber || task.acceptedBy.routingNumber)
                                };
                            }

                            // Check bids if no acceptedBy
                            if (!taskerData && task.bids?.length > 0) {
                                for (const bid of task.bids) {
                                    if (bid.taskerId) {
                                        const bidder = await User.findById(bid.taskerId).select('firstName lastName email accountNumber routingNumber');
                                        if (bidder) {
                                            taskerData = {
                                                _id: bidder._id,
                                                name: `${bidder.firstName || ''} ${bidder.lastName || ''}`.trim(),
                                                email: bidder.email,
                                                hasBankDetails: !!(bidder.accountNumber || bidder.routingNumber)
                                            };
                                            break;
                                        }
                                    }
                                }
                            }
                        }
                    }

                    const platformFeePercentage = 15;
                    const totalAmount = pi.amount;
                    const platformFee = Math.round(totalAmount * (platformFeePercentage / 100));
                    const taskerEarnings = totalAmount - platformFee;

                    return {
                        id: pi.id,
                        amount: (pi.amount / 100).toFixed(2),
                        currency: pi.currency.toUpperCase(),
                        status: pi.status,
                        description: pi.description,
                        created: new Date(pi.created * 1000).toISOString(),
                        breakdown: {
                            total: (totalAmount / 100).toFixed(2),
                            platformFee: (platformFee / 100).toFixed(2),
                            platformFeePercentage,
                            taskerEarnings: (taskerEarnings / 100).toFixed(2)
                        },
                        stripeCustomer: {
                            id: pi.customer?.id || pi.customer,
                            email: pi.customer?.email || 'N/A'
                        },
                        taskId,
                        task: taskData,
                        client: clientData,
                        tasker: taskerData,
                        canCapture: pi.status === 'requires_capture',
                        hasTaskerData: !!taskerData,
                        existsInDatabase: await Transaction.exists({ stripePaymentIntentId: pi.id })
                    };
                } catch (err) {
                    return {
                        id: pi.id,
                        amount: (pi.amount / 100).toFixed(2),
                        currency: pi.currency.toUpperCase(),
                        status: pi.status,
                        error: err.message
                    };
                }
            })
        );

        const summary = {
            total: enrichedPayments.length,
            succeeded: enrichedPayments.filter(p => p.status === 'succeeded').length,
            uncaptured: enrichedPayments.filter(p => p.status === 'requires_capture').length,
            withTaskerData: enrichedPayments.filter(p => p.hasTaskerData).length,
            totalAmount: enrichedPayments
                .filter(p => ['succeeded', 'requires_capture'].includes(p.status))
                .reduce((sum, p) => sum + parseFloat(p.amount), 0).toFixed(2)
        };

        res.json({ success: true, payments: enrichedPayments, summary });

    } catch (err) {
        console.error('getStripePaymentsWithTaskerData error:', err);
        res.status(500).json({ error: err.message });
    }
};

export const syncStripeToDatabase = async (req, res) => {
    try {
        const stripe = (await import('../utils/stripeConfig.js')).default;
        const paymentIntents = await stripe.paymentIntents.list({ limit: 100 });

        const results = { synced: [], updated: [], skipped: [], errors: [] };
        const platformFeePercentage = 15;

        for (const pi of paymentIntents.data) {
            try {
                let taskId = pi.metadata?.taskId;
                if (!taskId && pi.description) {
                    const match = pi.description.match(/([a-f0-9]{24})/i);
                    if (match) taskId = match[1];
                }

                if (!taskId) {
                    results.skipped.push({ id: pi.id, reason: 'No taskId' });
                    continue;
                }

                const existing = await Transaction.findOne({ stripePaymentIntentId: pi.id });

                const task = await Task.findById(taskId)
                    .populate('client', 'firstName lastName email')
                    .populate('acceptedBy', 'firstName lastName email');

                if (!task) {
                    results.skipped.push({ id: pi.id, reason: 'Task not found' });
                    continue;
                }

                let tasker = task.acceptedBy;
                let taskerId = task.acceptedBy?._id;

                if (!tasker && task.bids?.length > 0) {
                    for (const bid of task.bids) {
                        if (bid.taskerId) {
                            tasker = await User.findById(bid.taskerId);
                            if (tasker) { taskerId = tasker._id; break; }
                        }
                    }
                }

                if (!tasker) {
                    results.skipped.push({ id: pi.id, reason: 'No tasker' });
                    continue;
                }

                const totalAmountCents = pi.amount;
                const platformFeeCents = Math.round(totalAmountCents * (platformFeePercentage / 100));
                const taskerEarningsCents = totalAmountCents - platformFeeCents;

                let status = 'pending';
                if (pi.status === 'requires_capture') status = 'authorized';
                else if (pi.status === 'succeeded') status = 'captured';
                else if (pi.status === 'canceled') status = 'cancelled';

                const transactionData = {
                    type: 'bid_authorization',
                    taskId,
                    clientId: task.client?._id,
                    taskerId,
                    stripePaymentIntentId: pi.id,
                    stripeCustomerId: pi.customer?.id || pi.customer,
                    amounts: {
                        total: totalAmountCents,
                        platformFee: platformFeeCents,
                        platformFeePercentage,
                        taskerEarnings: taskerEarningsCents
                    },
                    currency: pi.currency,
                    status,
                    taskerPayout: { status: status === 'cancelled' ? 'cancelled' : 'pending' },
                    taskSnapshot: { title: task.taskTitle || task.serviceTitle || '' },
                    clientSnapshot: {
                        name: task.client ? `${task.client.firstName || ''} ${task.client.lastName || ''}`.trim() : 'Unknown',
                        email: task.client?.email || ''
                    },
                    taskerSnapshot: {
                        name: `${tasker.firstName || ''} ${tasker.lastName || ''}`.trim(),
                        email: tasker.email || ''
                    }
                };

                if (existing) {
                    await Transaction.findByIdAndUpdate(existing._id, { $set: transactionData });
                    results.updated.push({ id: pi.id, transactionId: existing.transactionId });
                } else {
                    const transaction = new Transaction({
                        ...transactionData,
                        transactionId: generateTransactionId(),
                        statusHistory: [{ status, changedAt: new Date(pi.created * 1000), reason: 'Synced from Stripe' }]
                    });
                    await transaction.save();
                    results.synced.push({ id: pi.id, transactionId: transaction.transactionId });
                }

            } catch (err) {
                results.errors.push({ id: pi.id, error: err.message });
            }
        }

        res.json({
            success: true,
            results: {
                total: paymentIntents.data.length,
                synced: results.synced.length,
                updated: results.updated.length,
                skipped: results.skipped.length,
                errors: results.errors.length,
                details: results
            }
        });

    } catch (err) {
        console.error('syncStripeToDatabase error:', err);
        res.status(500).json({ error: err.message });
    }
};

// ==================== PENDING PAYOUTS WITH BANK DETAILS ====================
export const getPendingPayoutsWithTaskerDetails = async (req, res) => {
    try {
        const transactions = await Transaction.find({
            status: 'captured',
            'taskerPayout.status': { $in: ['pending', 'processing', null, undefined] }
        })
            .populate('taskerId', 'firstName lastName email phone accountHolder accountNumber routingNumber bankDetails')
            .populate('clientId', 'firstName lastName email')
            .populate('taskId', 'taskTitle serviceTitle')
            .sort({ createdAt: -1 })
            .lean();

        const payouts = transactions.map(t => {
            const tasker = t.taskerId;
            const bankDetails = {
                accountHolder: tasker?.bankDetails?.accountHolder || tasker?.accountHolder || null,
                accountNumber: tasker?.bankDetails?.accountNumber || tasker?.accountNumber || null,
                accountNumberLast4: tasker?.accountNumber ? tasker.accountNumber.slice(-4) : null,
                routingNumber: tasker?.bankDetails?.routingNumber || tasker?.routingNumber || null,
                hasBankDetails: !!(tasker?.accountNumber || tasker?.bankDetails?.accountNumber)
            };

            return {
                _id: t._id,
                transactionId: t.transactionId,
                task: {
                    _id: t.taskId?._id,
                    title: t.taskId?.taskTitle || t.taskId?.serviceTitle || t.taskSnapshot?.title
                },
                client: {
                    _id: t.clientId?._id,
                    name: t.clientId ? `${t.clientId.firstName || ''} ${t.clientId.lastName || ''}`.trim() : 'Unknown',
                    email: t.clientId?.email
                },
                tasker: {
                    _id: tasker?._id,
                    name: tasker ? `${tasker.firstName || ''} ${tasker.lastName || ''}`.trim() : 'Unknown',
                    email: tasker?.email,
                    phone: tasker?.phone,
                    bankDetails
                },
                amounts: {
                    total: ((t.amounts?.total || 0) / 100).toFixed(2),
                    platformFee: ((t.amounts?.platformFee || 0) / 100).toFixed(2),
                    platformFeePercentage: t.amounts?.platformFeePercentage || 15,
                    taskerEarnings: ((t.amounts?.taskerEarnings || 0) / 100).toFixed(2)
                },
                status: t.status,
                payoutStatus: t.taskerPayout?.status || 'pending',
                createdAt: t.createdAt
            };
        });

        const summary = {
            totalPending: payouts.length,
            totalAmount: payouts.reduce((sum, p) => sum + parseFloat(p.amounts.taskerEarnings), 0).toFixed(2),
            withBankDetails: payouts.filter(p => p.tasker.bankDetails.hasBankDetails).length,
            withoutBankDetails: payouts.filter(p => !p.tasker.bankDetails.hasBankDetails).length
        };

        res.json({ success: true, payouts, summary });

    } catch (err) {
        console.error('getPendingPayoutsWithTaskerDetails error:', err);
        res.status(500).json({ error: err.message });
    }
};

// ==================== PROCESS PAYOUT ====================
export const processTaskerPayout = async (req, res) => {
    try {
        const { transactionId } = req.params;
        const { payoutMethod, referenceNumber, notes } = req.body;
        const adminUser = req.user;
        console.log("reqqqqq paramsssss" ,req.params)
        console.log("reqqqqq bodyyyyyyy",req.body)
        console.log("reqqqqq paramsssss " ,req.user)

        if (!transactionId || transactionId === 'bulk') {
            return res.status(400).json({ error: 'Invalid transaction ID' });
        }

        let query;
        if (isValidObjectId(transactionId)) {
            query = { $or: [{ _id: transactionId }, { transactionId }] };
        } else {
            query = { transactionId };
        }

        const transaction = await Transaction.findOne(query)
            .populate('taskerId', 'firstName lastName email accountHolder accountNumber routingNumber');

        if (!transaction) {
            return res.status(404).json({ error: 'Transaction not found' });
        }

        if (transaction.status !== 'captured') {
            return res.status(400).json({ error: `Cannot process. Status: ${transaction.status}` });
        }

        if (transaction.taskerPayout?.status === 'completed') {
            return res.status(400).json({ error: 'Payout already completed' });
        }

        const tasker = transaction.taskerId;
        const payoutAmount = transaction.amounts?.taskerEarnings || 0;

        // Update transaction
        transaction.status = 'tasker_payout_processing';
        transaction.taskerPayout = {
            status: 'processing',
            processedDate: new Date(),
            processedBy: adminUser?._id,
            payoutMethod: payoutMethod || 'manual_bank_transfer',
            referenceNumber: referenceNumber || '',
            notes: notes || '',
            bankDetails: {
                accountHolder: tasker?.accountHolder,
                accountLast4: tasker?.accountNumber?.slice(-4),
                routingNumber: tasker?.routingNumber
            }
        };
        transaction.statusHistory.push({
            status: 'tasker_payout_processing',
            changedAt: new Date(),
            changedBy: adminUser?._id,
            reason: `Payout processing. Ref: ${referenceNumber || 'N/A'}`
        });

        await transaction.save();

        res.json({
            success: true,
            message: 'Payout marked for processing',
            payout: {
                transactionId: transaction.transactionId,
                amount: (payoutAmount / 100).toFixed(2),
                method: payoutMethod,
                tasker: {
                    name: `${tasker?.firstName || ''} ${tasker?.lastName || ''}`.trim(),
                    email: tasker?.email,
                    bankAccountLast4: tasker?.accountNumber?.slice(-4)
                }
            }
        });

    } catch (err) {
        console.error('processTaskerPayout error:', err);
        res.status(500).json({ error: err.message });
    }
};

// ==================== COMPLETE MANUAL PAYOUT ====================
export const completeManualPayout = async (req, res) => {
    try {
        const { transactionId } = req.params;
        const { referenceNumber, notes } = req.body;
        const adminUser = req.user;

        let query;
        if (isValidObjectId(transactionId)) {
            query = { $or: [{ _id: transactionId }, { transactionId }] };
        } else {
            query = { transactionId };
        }

        const transaction = await Transaction.findOne(query);

        if (!transaction) {
            return res.status(404).json({ error: 'Transaction not found' });
        }

        if (transaction.taskerPayout?.status === 'completed') {
            return res.status(400).json({ error: 'Already completed' });
        }

        transaction.status = 'tasker_paid';
        transaction.taskerPayout = {
            ...transaction.taskerPayout,
            status: 'completed',
            completedDate: new Date(),
            completedBy: adminUser?._id,
            referenceNumber: referenceNumber || transaction.taskerPayout?.referenceNumber,
            notes: notes || transaction.taskerPayout?.notes
        };
        transaction.statusHistory.push({
            status: 'tasker_paid',
            changedAt: new Date(),
            changedBy: adminUser?._id,
            reason: `Payout completed. Ref: ${referenceNumber || 'N/A'}`
        });

        await transaction.save();

        res.json({
            success: true,
            message: 'Payout completed',
            transactionId: transaction.transactionId
        });

    } catch (err) {
        console.error('completeManualPayout error:', err);
        res.status(500).json({ error: err.message });
    }
};

// ==================== BULK PAYOUTS ====================
export const processBulkPayouts = async (req, res) => {
    try {
        const { transactionIds, payoutMethod } = req.body;
        const adminUser = req.user;

        if (!transactionIds?.length) {
            return res.status(400).json({ error: 'No transactions provided' });
        }

        const results = { successful: [], failed: [], skipped: [] };

        for (const txnId of transactionIds) {
            try {
                let query;
                if (isValidObjectId(txnId)) {
                    query = { $or: [{ _id: txnId }, { transactionId: txnId }] };
                } else {
                    query = { transactionId: txnId };
                }

                const transaction = await Transaction.findOne(query)
                    .populate('taskerId', 'firstName lastName email accountNumber');

                if (!transaction) {
                    results.skipped.push({ transactionId: txnId, reason: 'Not found' });
                    continue;
                }

                if (transaction.status !== 'captured') {
                    results.skipped.push({ transactionId: txnId, reason: `Status: ${transaction.status}` });
                    continue;
                }

                transaction.status = 'tasker_payout_processing';
                transaction.taskerPayout = {
                    status: 'processing',
                    processedDate: new Date(),
                    processedBy: adminUser?._id,
                    payoutMethod: payoutMethod || 'manual_bank_transfer'
                };
                transaction.statusHistory.push({
                    status: 'tasker_payout_processing',
                    changedAt: new Date(),
                    reason: 'Bulk payout'
                });

                await transaction.save();

                results.successful.push({
                    transactionId: transaction.transactionId,
                    amount: ((transaction.amounts?.taskerEarnings || 0) / 100).toFixed(2),
                    taskerEmail: transaction.taskerId?.email
                });

            } catch (err) {
                results.failed.push({ transactionId: txnId, error: err.message });
            }
        }

        res.json({
            success: true,
            results: {
                total: transactionIds.length,
                successful: results.successful.length,
                failed: results.failed.length,
                skipped: results.skipped.length,
                details: results
            }
        });

    } catch (err) {
        console.error('processBulkPayouts error:', err);
        res.status(500).json({ error: err.message });
    }
};

// ==================== CAPTURE PAYMENT ====================
export const capturePayment = async (req, res) => {
    try {
        const { taskId } = req.params;
        const { paymentIntentId } = req.body;
        const stripe = (await import('../utils/stripeConfig.js')).default;

        if (!paymentIntentId) {
            return res.status(400).json({ error: 'Payment Intent ID required' });
        }

        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

        if (paymentIntent.status !== 'requires_capture') {
            return res.status(400).json({ error: `Cannot capture. Status: ${paymentIntent.status}` });
        }

        const capturedPayment = await stripe.paymentIntents.capture(paymentIntentId);

        await Task.findByIdAndUpdate(taskId, {
            $set: { stripeStatus: 'captured', 'paymentInfo.status': 'captured', 'paymentInfo.capturedAt': new Date() }
        });

        let transaction = await Transaction.findOne({ stripePaymentIntentId: paymentIntentId });

        if (transaction) {
            transaction.status = 'captured';
            transaction.taskerPayout = { status: 'pending' };
            transaction.statusHistory.push({ status: 'captured', changedAt: new Date(), reason: 'Payment captured' });
            await transaction.save();
        } else {
            // Create new transaction
            const platformFeePercentage = 15;
            const totalAmount = capturedPayment.amount;
            const platformFee = Math.round(totalAmount * (platformFeePercentage / 100));
            const taskerEarnings = totalAmount - platformFee;

            const task = await Task.findById(taskId).populate('client').populate('acceptedBy');

            transaction = new Transaction({
                transactionId: generateTransactionId(),
                type: 'bid_authorization',
                taskId,
                clientId: task?.client?._id,
                taskerId: task?.acceptedBy?._id,
                stripePaymentIntentId: paymentIntentId,
                amounts: { total: totalAmount, platformFee, platformFeePercentage, taskerEarnings },
                currency: capturedPayment.currency,
                status: 'captured',
                taskerPayout: { status: 'pending' },
                statusHistory: [{ status: 'captured', changedAt: new Date() }]
            });
            await transaction.save();
        }

        res.json({
            success: true,
            message: 'Payment captured',
            transactionId: transaction?.transactionId
        });

    } catch (err) {
        console.error('capturePayment error:', err);
        res.status(500).json({ error: err.message });
    }
};

// ==================== CANCEL PAYMENT ====================
export const cancelPayment = async (req, res) => {
    try {
        const { taskId } = req.params;
        const { paymentIntentId } = req.body;
        const stripe = (await import('../utils/stripeConfig.js')).default;

        await stripe.paymentIntents.cancel(paymentIntentId);

        await Task.findByIdAndUpdate(taskId, { $set: { stripeStatus: 'canceled' } });

        await Transaction.findOneAndUpdate(
            { stripePaymentIntentId: paymentIntentId },
            { $set: { status: 'cancelled', 'taskerPayout.status': 'cancelled' } }
        );

        res.json({ success: true, message: 'Payment canceled' });

    } catch (err) {
        console.error('cancelPayment error:', err);
        res.status(500).json({ error: err.message });
    }
};

// ==================== TRANSACTIONS ====================
export const getAllTransactions = async (req, res) => {
    try {
        const { page = 1, limit = 20, status, search } = req.query;
        const query = {};

        if (status) query.status = status;
        if (search) {
            query.$or = [
                { transactionId: { $regex: search, $options: 'i' } },
                { 'clientSnapshot.email': { $regex: search, $options: 'i' } },
                { 'taskerSnapshot.email': { $regex: search, $options: 'i' } }
            ];
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [transactions, totalCount] = await Promise.all([
            Transaction.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .populate('clientId', 'firstName lastName email')
                .populate('taskerId', 'firstName lastName email')
                .lean(),
            Transaction.countDocuments(query)
        ]);

        res.json({
            success: true,
            transactions: transactions.map(t => ({
                ...t,
                amounts: {
                    total: ((t.amounts?.total || 0) / 100).toFixed(2),
                    platformFee: ((t.amounts?.platformFee || 0) / 100).toFixed(2),
                    platformFeePercentage: t.amounts?.platformFeePercentage,
                    taskerEarnings: ((t.amounts?.taskerEarnings || 0) / 100).toFixed(2)
                }
            })),
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalCount / parseInt(limit)),
                totalCount
            }
        });

    } catch (err) {
        console.error('getAllTransactions error:', err);
        res.status(500).json({ error: err.message });
    }
};

export const getTransactionDetails = async (req, res) => {
    try {
        const { transactionId } = req.params;

        const transaction = await Transaction.findOne({
            $or: [{ _id: isValidObjectId(transactionId) ? transactionId : null }, { transactionId }]
        })
            .populate('clientId', 'firstName lastName email phone')
            .populate('taskerId', 'firstName lastName email phone accountHolder accountNumber routingNumber')
            .populate('taskId');

        if (!transaction) {
            return res.status(404).json({ error: 'Transaction not found' });
        }

        res.json({ success: true, transaction });

    } catch (err) {
        console.error('getTransactionDetails error:', err);
        res.status(500).json({ error: err.message });
    }
};

// ==================== REFUND ====================
export const refundTransaction = async (req, res) => {
    try {
        const { transactionId } = req.params;
        const { reason } = req.body;
        const stripe = (await import('../utils/stripeConfig.js')).default;

        const transaction = await Transaction.findOne({
            $or: [{ _id: isValidObjectId(transactionId) ? transactionId : null }, { transactionId }]
        });

        if (!transaction) {
            return res.status(404).json({ error: 'Transaction not found' });
        }

        if (transaction.status === 'authorized') {
            await stripe.paymentIntents.cancel(transaction.stripePaymentIntentId);
        } else if (transaction.status === 'captured') {
            await stripe.refunds.create({ payment_intent: transaction.stripePaymentIntentId });
        } else {
            return res.status(400).json({ error: `Cannot refund. Status: ${transaction.status}` });
        }

        transaction.status = 'refunded';
        transaction.taskerPayout = { status: 'cancelled' };
        transaction.statusHistory.push({
            status: 'refunded',
            changedAt: new Date(),
            reason: reason || 'Refund processed'
        });

        await transaction.save();

        res.json({ success: true, message: 'Refund processed' });

    } catch (err) {
        console.error('refundTransaction error:', err);
        res.status(500).json({ error: err.message });
    }
};

// ==================== TASKER EARNINGS & BANK DETAILS ====================
export const getTaskerEarnings = async (req, res) => {
    try {
        const { taskerId } = req.params;

        const transactions = await Transaction.find({ taskerId })
            .sort({ createdAt: -1 })
            .populate('taskId', 'taskTitle');

        const totalEarned = transactions
            .filter(t => t.taskerPayout?.status === 'completed')
            .reduce((sum, t) => sum + (t.amounts?.taskerEarnings || 0), 0);

        const totalPending = transactions
            .filter(t => ['pending', 'processing'].includes(t.taskerPayout?.status))
            .reduce((sum, t) => sum + (t.amounts?.taskerEarnings || 0), 0);

        res.json({
            success: true,
            earnings: {
                total: (totalEarned / 100).toFixed(2),
                pending: (totalPending / 100).toFixed(2)
            },
            transactions: transactions.map(t => ({
                transactionId: t.transactionId,
                taskTitle: t.taskId?.taskTitle || t.taskSnapshot?.title,
                amount: ((t.amounts?.taskerEarnings || 0) / 100).toFixed(2),
                status: t.taskerPayout?.status,
                createdAt: t.createdAt
            }))
        });

    } catch (err) {
        console.error('getTaskerEarnings error:', err);
        res.status(500).json({ error: err.message });
    }
};

export const getTaskerBankDetails = async (req, res) => {
    try {
        const { taskerId } = req.params;

        const tasker = await User.findById(taskerId)
            .select('firstName lastName email phone accountHolder accountNumber routingNumber');

        if (!tasker) {
            return res.status(404).json({ error: 'Tasker not found' });
        }

        res.json({
            success: true,
            tasker: {
                _id: tasker._id,
                name: `${tasker.firstName || ''} ${tasker.lastName || ''}`.trim(),
                email: tasker.email,
                phone: tasker.phone
            },
            bankDetails: {
                accountHolder: tasker.accountHolder,
                accountNumberMasked: tasker.accountNumber ? `****${tasker.accountNumber.slice(-4)}` : null,
                routingNumber: tasker.routingNumber,
                hasBankDetails: !!(tasker.accountNumber && tasker.routingNumber)
            }
        });

    } catch (err) {
        console.error('getTaskerBankDetails error:', err);
        res.status(500).json({ error: err.message });
    }
};

// ==================== SETTINGS ====================
export const getPlatformSettings = async (req, res) => {
    try {
        const settings = await PlatformSettings.getSettings();
        res.json({ success: true, settings });
    } catch (err) {
        console.error('getPlatformSettings error:', err);
        res.status(500).json({ error: err.message });
    }
};

export const updatePlatformSettings = async (req, res) => {
    try {
        const { platformFeePercentage, minimumPayoutAmount, holdPeriodDays } = req.body;

        await PlatformSettings.findOneAndUpdate(
            { key: 'payment_settings' },
            {
                $set: {
                    value: {
                        platformFeePercentage: platformFeePercentage ?? 15,
                        minimumPayoutAmount: minimumPayoutAmount ?? 2500,
                        holdPeriodDays: holdPeriodDays ?? 7,
                        updatedAt: new Date()
                    }
                }
            },
            { upsert: true }
        );

        res.json({ success: true, message: 'Settings updated' });

    } catch (err) {
        console.error('updatePlatformSettings error:', err);
        res.status(500).json({ error: err.message });
    }
};

// ==================== ANALYTICS ====================
export const getPaymentAnalytics = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const end = endDate ? new Date(endDate) : new Date();

        const analytics = await Transaction.aggregate([
            {
                $match: {
                    createdAt: { $gte: start, $lte: end },
                    status: { $in: ['captured', 'tasker_paid'] }
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                    totalRevenue: { $sum: '$amounts.total' },
                    platformFees: { $sum: '$amounts.platformFee' },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        res.json({
            success: true,
            analytics: analytics.map(a => ({
                date: a._id,
                totalRevenue: (a.totalRevenue / 100).toFixed(2),
                platformFees: (a.platformFees / 100).toFixed(2),
                transactionCount: a.count
            }))
        });

    } catch (err) {
        console.error('getPaymentAnalytics error:', err);
        res.status(500).json({ error: err.message });
    }
};