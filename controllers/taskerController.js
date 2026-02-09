import Stripe from 'stripe';
import mongoose from "mongoose";
import BookingTasker from "../models/bookingTasker.js";
import RequestQuote from "../models/requestQuote.js";
import User from "../models/user.js";
import { createNotification } from "./notificationHelper.js";
import { validateTaskerCanReceivePayments, calculateFees } from "../utils/stripeConnect.js";
import { logBooking, logPayment, logActivity, logQuoteRequest } from "../utils/activityLogger.js";
import { addEarningToWallet } from './walletController.js';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);



// CLIENT SIDE
const CLIENT_PLATFORM_FEE_PERCENT = 0.10;  // 10%
const RESERVATION_FEE_CENTS = 500;          // $5 flat fee
const CLIENT_TAX_PERCENT = 0.13;            // 13% HST on service amount

// TASKER SIDE
const TASKER_PLATFORM_FEE_PERCENT = 0.12;  // 12%
const TASKER_TAX_PERCENT = 0.13;            // 13% tax

/**
 * Calculate double-sided fees for bookings
 * Client: 10% platform fee + $5 reservation + 13% HST
 * Tasker: 12% platform fee + 13% tax deducted
 */
const calculateBookingFees = (serviceAmountInCents) => {
    // ─── CLIENT SIDE FEES (Added to service amount) ───
    const clientPlatformFee = Math.round(serviceAmountInCents * CLIENT_PLATFORM_FEE_PERCENT);
    const reservationFee = RESERVATION_FEE_CENTS;
    const clientTax = Math.round(serviceAmountInCents * CLIENT_TAX_PERCENT);
    const totalClientPays = serviceAmountInCents + clientPlatformFee + reservationFee + clientTax;

    // ─── TASKER SIDE FEES (Deducted from service amount) ───
    const taskerPlatformFee = Math.round(serviceAmountInCents * TASKER_PLATFORM_FEE_PERCENT);
    const taskerTax = Math.round(serviceAmountInCents * TASKER_TAX_PERCENT);
    const taskerPayout = serviceAmountInCents - taskerPlatformFee - taskerTax;

    // ─── PLATFORM REVENUE ───
    const applicationFee = totalClientPays - taskerPayout;

    return {
        serviceAmountInCents,

        // Client fees
        clientPlatformFee,
        reservationFee,
        clientTax,
        totalClientPays,

        // Tasker deductions
        taskerPlatformFee,
        taskerTax,
        taskerPayout,

        // Platform
        applicationFee,

        // Percentages for display
        clientPlatformFeePercent: CLIENT_PLATFORM_FEE_PERCENT * 100,
        clientTaxPercent: CLIENT_TAX_PERCENT * 100,
        taskerPlatformFeePercent: TASKER_PLATFORM_FEE_PERCENT * 100,
        taskerTaxPercent: TASKER_TAX_PERCENT * 100,
    };
};

/**
 * Helper function to get day name from date
 */
const getDayNameFromDate = (date) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[date.getDay()];
};


// const createBooking = async (req, res) => {
//     let paymentIntent = null;
//     const { taskerId, service, date, dayOfWeek, paymentMethodId: providedPaymentMethodId } = req.body;
//     const clientId = req.user?.id;

//     try {
//         console.log('=== CREATE BOOKING REQUEST ===');
//         console.log('Raw Request Body:', JSON.stringify(req.body, null, 2));

//         // ==================== BASIC VALIDATIONS ====================

//         if (!clientId) {
//             await logBooking({
//                 action: "BOOKING_CREATED",
//                 user: null,
//                 req,
//                 serviceTitle: service?.title,
//                 taskerId,
//                 status: "failure",
//                 metadata: {
//                     errorMessage: "Unauthorized: User not authenticated",
//                     errorCode: "UNAUTHORIZED",
//                 },
//             });

//             return res.status(401).json({ message: "Unauthorized: User not authenticated" });
//         }

//         if (!mongoose.Types.ObjectId.isValid(taskerId) || !mongoose.Types.ObjectId.isValid(clientId)) {
//             await logBooking({
//                 action: "BOOKING_CREATED",
//                 user: req.user,
//                 req,
//                 serviceTitle: service?.title,
//                 taskerId,
//                 status: "failure",
//                 metadata: {
//                     errorMessage: "Invalid tasker or client ID",
//                     errorCode: "INVALID_IDS",
//                     providedTaskerId: taskerId,
//                     providedClientId: clientId,
//                 },
//             });

//             return res.status(400).json({ message: "Invalid tasker or client ID" });
//         }

//         if (!service || !service.title || !service.description || !service.hourlyRate || !service.estimatedDuration) {
//             await logBooking({
//                 action: "BOOKING_CREATED",
//                 user: req.user,
//                 req,
//                 taskerId,
//                 status: "failure",
//                 metadata: {
//                     errorMessage: "Service details are required",
//                     errorCode: "MISSING_SERVICE_DETAILS",
//                     providedService: service,
//                 },
//             });

//             return res.status(400).json({ message: "Service details are required" });
//         }

//         if (!date) {
//             await logBooking({
//                 action: "BOOKING_CREATED",
//                 user: req.user,
//                 req,
//                 serviceTitle: service.title,
//                 taskerId,
//                 status: "failure",
//                 metadata: {
//                     errorMessage: "Booking date and time are required",
//                     errorCode: "MISSING_DATE",
//                 },
//             });

//             return res.status(400).json({ message: "Booking date and time are required" });
//         }

//         // ==================== VALIDATE USERS ====================

//         const tasker = await User.findById(taskerId);
//         if (!tasker || tasker.currentRole !== "tasker") {
//             await logBooking({
//                 action: "BOOKING_CREATED",
//                 user: req.user,
//                 req,
//                 serviceTitle: service.title,
//                 taskerId,
//                 status: "failure",
//                 metadata: {
//                     errorMessage: "Tasker not found or invalid role",
//                     errorCode: "INVALID_TASKER",
//                     taskerExists: !!tasker,
//                     taskerRole: tasker?.currentRole,
//                 },
//             });

//             return res.status(400).json({ message: "Tasker not found or invalid role" });
//         }

//         const client = await User.findById(clientId).select('+address');
//         if (!client || client.currentRole !== "client") {
//             await logBooking({
//                 action: "BOOKING_CREATED",
//                 user: req.user,
//                 req,
//                 serviceTitle: service.title,
//                 taskerId,
//                 taskerName: `${tasker.firstName} ${tasker.lastName}`,
//                 status: "failure",
//                 metadata: {
//                     errorMessage: "Client not found or invalid role",
//                     errorCode: "INVALID_CLIENT",
//                 },
//             });

//             return res.status(400).json({ message: "Client not found or invalid role" });
//         }

//         // ==================== VALIDATE TASKER CAN RECEIVE PAYMENTS ====================

//         let taskerStripeAccountId;
//         try {
//             taskerStripeAccountId = await validateTaskerCanReceivePayments(taskerId);
//             console.log('✅ Tasker Stripe Connect validated:', taskerStripeAccountId);
//         } catch (connectError) {
//             await logBooking({
//                 action: "BOOKING_CREATED",
//                 user: { ...req.user, ...client.toObject() },
//                 req,
//                 serviceTitle: service.title,
//                 taskerId: tasker._id.toString(),
//                 taskerName: `${tasker.firstName} ${tasker.lastName}`,
//                 status: "failure",
//                 metadata: {
//                     errorMessage: connectError.message,
//                     errorCode: "TASKER_PAYMENT_NOT_SETUP",
//                     taskerEmail: tasker.email,
//                 },
//             });

//             return res.status(400).json({
//                 message: connectError.message,
//                 code: 'TASKER_PAYMENT_NOT_SETUP',
//             });
//         }

//         // ==================== HANDLE PAYMENT METHOD ====================

//         let paymentMethodId = providedPaymentMethodId;
//         let customerId = client.stripeCustomerId;

//         console.log("=== PAYMENT METHOD DEBUG ===");
//         console.log("Provided Payment Method ID:", providedPaymentMethodId);
//         console.log("Client's stored stripeCustomerId:", customerId);

//         if (!paymentMethodId) {
//             paymentMethodId = client.defaultPaymentMethod || client.defaultPaymentMethodId;
//         }

//         if (!paymentMethodId) {
//             await logBooking({
//                 action: "BOOKING_CREATED",
//                 user: { ...req.user, ...client.toObject() },
//                 req,
//                 serviceTitle: service.title,
//                 taskerId: tasker._id.toString(),
//                 taskerName: `${tasker.firstName} ${tasker.lastName}`,
//                 status: "failure",
//                 metadata: {
//                     errorMessage: "No payment method provided",
//                     errorCode: "NO_PAYMENT_METHOD",
//                     clientEmail: client.email,
//                 },
//             });

//             return res.status(400).json({
//                 message: 'No payment method provided. Please add a card.',
//                 code: 'NO_PAYMENT_METHOD',
//             });
//         }

//         // STEP 1: Ensure we have a Stripe Customer
//         if (!customerId) {
//             console.log("Creating new Stripe Customer for client...");
//             try {
//                 const customerName = `${client.firstName} ${client.lastName}`.trim();
//                 const customer = await stripe.customers.create({
//                     email: client.email,
//                     name: customerName,
//                     phone: client.phone || undefined,
//                     description: `Client - ${customerName}`,
//                     metadata: {
//                         userId: client._id.toString(),
//                         platform: 'taskallo',
//                         userType: 'client',
//                     },
//                 });
//                 customerId = customer.id;
//                 client.stripeCustomerId = customerId;
//                 await client.save();
//                 console.log("✅ Created new Stripe Customer:", customerId);
//             } catch (customerError) {
//                 console.error("❌ Failed to create Stripe Customer:", customerError);

//                 await logBooking({
//                     action: "BOOKING_CREATED",
//                     user: { ...req.user, ...client.toObject() },
//                     req,
//                     serviceTitle: service.title,
//                     taskerId: tasker._id.toString(),
//                     taskerName: `${tasker.firstName} ${tasker.lastName}`,
//                     status: "failure",
//                     metadata: {
//                         errorMessage: "Failed to create Stripe customer",
//                         errorCode: "CUSTOMER_CREATION_FAILED",
//                         stripeError: customerError.message,
//                     },
//                 });

//                 return res.status(400).json({
//                     message: 'Failed to set up payment. Please try again.',
//                     code: 'CUSTOMER_CREATION_FAILED',
//                 });
//             }
//         }

//         // STEP 2: Retrieve and validate payment method
//         let paymentMethod;
//         try {
//             paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
//             console.log("✅ Payment method retrieved:", paymentMethodId);
//         } catch (pmRetrieveError) {
//             console.error("❌ Failed to retrieve payment method:", pmRetrieveError);

//             client.defaultPaymentMethod = null;
//             client.defaultPaymentMethodId = null;
//             await client.save();

//             await logBooking({
//                 action: "BOOKING_CREATED",
//                 user: { ...req.user, ...client.toObject() },
//                 req,
//                 serviceTitle: service.title,
//                 taskerId: tasker._id.toString(),
//                 taskerName: `${tasker.firstName} ${tasker.lastName}`,
//                 status: "failure",
//                 metadata: {
//                     errorMessage: "Payment method not found or invalid",
//                     errorCode: "PAYMENT_METHOD_NOT_FOUND",
//                     paymentMethodId,
//                 },
//             });

//             return res.status(400).json({
//                 message: 'Payment method not found or invalid. Please add a new card.',
//                 code: 'PAYMENT_METHOD_NOT_FOUND',
//             });
//         }

//         // STEP 3: Attach payment method to customer if not already attached
//         if (!paymentMethod.customer) {
//             try {
//                 await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
//                 console.log("✅ Payment method attached to customer:", customerId);
//             } catch (attachError) {
//                 console.error("❌ Failed to attach payment method:", attachError);

//                 await logBooking({
//                     action: "BOOKING_CREATED",
//                     user: { ...req.user, ...client.toObject() },
//                     req,
//                     serviceTitle: service.title,
//                     taskerId: tasker._id.toString(),
//                     taskerName: `${tasker.firstName} ${tasker.lastName}`,
//                     status: "failure",
//                     metadata: {
//                         errorMessage: "Failed to attach payment method",
//                         errorCode: "PAYMENT_METHOD_ATTACH_FAILED",
//                         stripeError: attachError.message,
//                     },
//                 });

//                 return res.status(400).json({
//                     message: 'Failed to set up payment method. Please try a different card.',
//                     code: 'PAYMENT_METHOD_ATTACH_FAILED',
//                 });
//             }
//         } else if (paymentMethod.customer !== customerId) {
//             customerId = paymentMethod.customer;
//             client.stripeCustomerId = customerId;
//         }

//         // Update client's payment records
//         client.stripeCustomerId = customerId;
//         client.defaultPaymentMethod = paymentMethodId;
//         client.defaultPaymentMethodId = paymentMethodId;
//         await client.save();

//         // ==================== PARSE AND VALIDATE DATE ====================

//         const bookingDate = new Date(date);

//         if (isNaN(bookingDate.getTime())) {
//             await logBooking({
//                 action: "BOOKING_CREATED",
//                 user: { ...req.user, ...client.toObject() },
//                 req,
//                 serviceTitle: service.title,
//                 taskerId: tasker._id.toString(),
//                 taskerName: `${tasker.firstName} ${tasker.lastName}`,
//                 status: "failure",
//                 metadata: {
//                     errorMessage: "Invalid date format",
//                     errorCode: "INVALID_DATE",
//                     providedDate: date,
//                 },
//             });

//             return res.status(400).json({ message: "Invalid date format" });
//         }

//         if (bookingDate < new Date()) {
//             await logBooking({
//                 action: "BOOKING_CREATED",
//                 user: { ...req.user, ...client.toObject() },
//                 req,
//                 serviceTitle: service.title,
//                 taskerId: tasker._id.toString(),
//                 taskerName: `${tasker.firstName} ${tasker.lastName}`,
//                 status: "failure",
//                 metadata: {
//                     errorMessage: "Cannot book a time in the past",
//                     errorCode: "PAST_DATE",
//                     providedDate: date,
//                     currentTime: new Date().toISOString(),
//                 },
//             });

//             return res.status(400).json({ message: "Cannot book a time in the past" });
//         }

//         // ==================== VALIDATE AVAILABILITY ====================

//         let dayName = dayOfWeek || getDayNameFromDate(new Date(date.split('T')[0]));

//         if (!tasker.availability || tasker.availability.length === 0) {
//             await logBooking({
//                 action: "BOOKING_CREATED",
//                 user: { ...req.user, ...client.toObject() },
//                 req,
//                 serviceTitle: service.title,
//                 taskerId: tasker._id.toString(),
//                 taskerName: `${tasker.firstName} ${tasker.lastName}`,
//                 status: "failure",
//                 metadata: {
//                     errorMessage: "Tasker has not set their availability",
//                     errorCode: "NO_AVAILABILITY",
//                     requestedDay: dayName,
//                 },
//             });

//             return res.status(400).json({
//                 message: "Tasker has not set their availability",
//             });
//         }

//         const availability = tasker.availability.find(slot =>
//             slot.day.toLowerCase() === dayName.toLowerCase()
//         );

//         if (!availability) {
//             await logBooking({
//                 action: "BOOKING_CREATED",
//                 user: { ...req.user, ...client.toObject() },
//                 req,
//                 serviceTitle: service.title,
//                 taskerId: tasker._id.toString(),
//                 taskerName: `${tasker.firstName} ${tasker.lastName}`,
//                 status: "failure",
//                 metadata: {
//                     errorMessage: `Tasker is not available on ${dayName}`,
//                     errorCode: "DAY_NOT_AVAILABLE",
//                     requestedDay: dayName,
//                     taskerAvailability: tasker.availability.map(a => a.day),
//                 },
//             });

//             return res.status(400).json({
//                 message: `Tasker is not available on ${dayName}`,
//             });
//         }

//         // ==================== VALIDATE TIME SLOT ====================

//         const timePart = date.includes('T') ? date.split('T')[1] : null;
//         let hours, minutes;

//         if (timePart) {
//             const timeMatch = timePart.match(/(\d{2}):(\d{2})/);
//             if (timeMatch) {
//                 hours = parseInt(timeMatch[1]);
//                 minutes = parseInt(timeMatch[2]);
//             } else {
//                 hours = bookingDate.getHours();
//                 minutes = bookingDate.getMinutes();
//             }
//         } else {
//             hours = bookingDate.getHours();
//             minutes = bookingDate.getMinutes();
//         }

//         const [startHour, startMinute] = availability.from.split(':').map(Number);
//         const [endHour, endMinute] = availability.to.split(':').map(Number);
//         const bookingTimeInMinutes = hours * 60 + minutes;
//         const startTimeInMinutes = startHour * 60 + startMinute;
//         const endTimeInMinutes = endHour * 60 + endMinute;

//         if (bookingTimeInMinutes < startTimeInMinutes || bookingTimeInMinutes >= endTimeInMinutes) {
//             await logBooking({
//                 action: "BOOKING_CREATED",
//                 user: { ...req.user, ...client.toObject() },
//                 req,
//                 serviceTitle: service.title,
//                 taskerId: tasker._id.toString(),
//                 taskerName: `${tasker.firstName} ${tasker.lastName}`,
//                 status: "failure",
//                 metadata: {
//                     errorMessage: `Booking time must be between ${availability.from} and ${availability.to}`,
//                     errorCode: "TIME_OUT_OF_RANGE",
//                     requestedTime: `${hours}:${minutes}`,
//                     availableFrom: availability.from,
//                     availableTo: availability.to,
//                 },
//             });

//             return res.status(400).json({
//                 message: `Booking time must be between ${availability.from} and ${availability.to} on ${dayName}`
//             });
//         }

//         // ==================== CHECK FOR CONFLICTING BOOKINGS ====================

//         const startOfDay = new Date(bookingDate);
//         startOfDay.setHours(0, 0, 0, 0);
//         const endOfDay = new Date(bookingDate);
//         endOfDay.setHours(23, 59, 59, 999);

//         const existingBooking = await BookingTasker.findOne({
//             tasker: taskerId,
//             date: { $gte: startOfDay, $lte: endOfDay },
//             status: { $in: ['pending', 'confirmed'] }
//         });

//         if (existingBooking) {
//             const existingTime = new Date(existingBooking.date);
//             const existingHours = existingTime.getHours();

//             if (Math.abs(hours - existingHours) < 1) {
//                 await logBooking({
//                     action: "BOOKING_CREATED",
//                     user: { ...req.user, ...client.toObject() },
//                     req,
//                     serviceTitle: service.title,
//                     taskerId: tasker._id.toString(),
//                     taskerName: `${tasker.firstName} ${tasker.lastName}`,
//                     status: "failure",
//                     metadata: {
//                         errorMessage: "Time slot already booked",
//                         errorCode: "SLOT_CONFLICT",
//                         requestedTime: `${hours}:${minutes}`,
//                         conflictingBookingId: existingBooking._id.toString(),
//                     },
//                 });

//                 return res.status(400).json({
//                     message: "This time slot is already booked. Please choose another time."
//                 });
//             }
//         }

//         // ==================== CALCULATE FEES ====================

//         const serviceAmountInCents = Math.round(service.hourlyRate * 100);
//         const fees = calculateBookingFees(serviceAmountInCents);

//         console.log("💰 Payment Breakdown:");
//         console.log(`   Total Client Pays: $${(fees.totalClientPays / 100).toFixed(2)}`);
//         console.log(`   Tasker Receives: $${(fees.taskerPayout / 100).toFixed(2)}`);
//         console.log(`   Platform Keeps: $${(fees.applicationFee / 100).toFixed(2)}`);

//         if (fees.totalClientPays < 50) {
//             await logBooking({
//                 action: "BOOKING_CREATED",
//                 user: { ...req.user, ...client.toObject() },
//                 req,
//                 serviceTitle: service.title,
//                 taskerId: tasker._id.toString(),
//                 taskerName: `${tasker.firstName} ${tasker.lastName}`,
//                 amount: fees.totalClientPays / 100,
//                 status: "failure",
//                 metadata: {
//                     errorMessage: "Minimum service amount is $0.50 CAD",
//                     errorCode: "AMOUNT_TOO_SMALL",
//                     serviceAmount: serviceAmountInCents / 100,
//                 },
//             });

//             return res.status(400).json({
//                 message: 'Minimum service amount is $0.50 CAD',
//                 code: 'AMOUNT_TOO_SMALL'
//             });
//         }

//         // ==================== CREATE PAYMENT INTENT ====================

//         const clientFullName = `${client.firstName} ${client.lastName}`.trim();
//         const taskerFullName = `${tasker.firstName} ${tasker.lastName}`.trim();

//         try {
//             paymentIntent = await stripe.paymentIntents.create({
//                 amount: fees.totalClientPays,
//                 currency: 'cad',
//                 customer: customerId,
//                 payment_method: paymentMethodId,
//                 capture_method: 'manual',
//                 description: `Booking: "${service.title}" | Client: ${clientFullName} | Tasker: ${taskerFullName}`,
//                 receipt_email: client.email,
//                 statement_descriptor: 'TASKALLO BOOKING',
//                 application_fee_amount: fees.applicationFee,
//                 transfer_data: {
//                     destination: taskerStripeAccountId,
//                 },
//                 metadata: {
//                     type: 'booking',
//                     clientId: clientId.toString(),
//                     taskerId: taskerId.toString(),
//                     serviceTitle: service.title.substring(0, 100),
//                 },
//                 automatic_payment_methods: {
//                     enabled: true,
//                     allow_redirects: 'never'
//                 },
//                 confirm: true,
//             });

//             console.log("✅ PaymentIntent created:", paymentIntent.id);

//             // ✅ Log payment authorization
//             await logPayment({
//                 action: "PAYMENT_AUTHORIZED",
//                 user: { ...req.user, ...client.toObject() },
//                 req,
//                 taskId: null,
//                 taskTitle: service.title,
//                 amount: fees.totalClientPays,
//                 paymentIntentId: paymentIntent.id,
//                 status: "success",
//                 metadata: {
//                     bookingType: "service",
//                     taskerId: tasker._id.toString(),
//                     taskerName: taskerFullName,
//                     taskerPayout: fees.taskerPayout / 100,
//                     applicationFee: fees.applicationFee / 100,
//                     stripeAccountId: taskerStripeAccountId,
//                 },
//             });

//         } catch (stripeError) {
//             console.error("❌ Stripe PaymentIntent creation failed:", stripeError);

//             // ✅ Log payment failure
//             await logPayment({
//                 action: "PAYMENT_FAILED",
//                 user: { ...req.user, ...client.toObject() },
//                 req,
//                 taskTitle: service.title,
//                 amount: fees.totalClientPays,
//                 status: "failure",
//                 metadata: {
//                     errorMessage: stripeError.message,
//                     errorCode: stripeError.code,
//                     errorType: stripeError.type,
//                     declineCode: stripeError.decline_code,
//                     taskerId: tasker._id.toString(),
//                 },
//             });

//             // Also log booking failure
//             await logBooking({
//                 action: "BOOKING_CREATED",
//                 user: { ...req.user, ...client.toObject() },
//                 req,
//                 serviceTitle: service.title,
//                 taskerId: tasker._id.toString(),
//                 taskerName: taskerFullName,
//                 amount: fees.totalClientPays / 100,
//                 status: "failure",
//                 metadata: {
//                     errorMessage: "Payment authorization failed",
//                     errorCode: stripeError.code || "PAYMENT_FAILED",
//                     stripeError: stripeError.message,
//                     declineCode: stripeError.decline_code,
//                 },
//             });

//             if (stripeError.type === 'StripeCardError') {
//                 return res.status(400).json({
//                     message: stripeError.message,
//                     code: 'CARD_ERROR',
//                     decline_code: stripeError.decline_code
//                 });
//             }

//             return res.status(400).json({
//                 message: 'Payment authorization failed: ' + stripeError.message,
//                 code: 'PAYMENT_FAILED',
//             });
//         }

//         // Verify payment was authorized
//         if (paymentIntent.status !== 'requires_capture') {
//             console.error("❌ Unexpected payment status:", paymentIntent.status);

//             try {
//                 await stripe.paymentIntents.cancel(paymentIntent.id);
//             } catch (e) {
//                 console.error("Could not cancel PaymentIntent:", e);
//             }

//             await logBooking({
//                 action: "BOOKING_CREATED",
//                 user: { ...req.user, ...client.toObject() },
//                 req,
//                 serviceTitle: service.title,
//                 taskerId: tasker._id.toString(),
//                 taskerName: taskerFullName,
//                 amount: fees.totalClientPays / 100,
//                 status: "failure",
//                 metadata: {
//                     errorMessage: "Payment authorization failed - unexpected status",
//                     errorCode: "AUTHORIZATION_FAILED",
//                     paymentStatus: paymentIntent.status,
//                     lastPaymentError: paymentIntent.last_payment_error?.message,
//                 },
//             });

//             return res.status(400).json({
//                 message: 'Payment authorization failed',
//                 code: 'AUTHORIZATION_FAILED',
//             });
//         }

//         // ==================== CREATE BOOKING ====================

//         const booking = new BookingTasker({
//             tasker: taskerId,
//             client: clientId,
//             service: {
//                 title: service.title,
//                 description: service.description,
//                 hourlyRate: service.hourlyRate,
//                 estimatedDuration: service.estimatedDuration,
//             },
//             date: bookingDate,
//             totalAmount: service.hourlyRate,
//             status: "confirmed",
//             confirmedAt: new Date(),
//             paymentIntentId: paymentIntent.id,
//             stripeStatus: 'authorized',
//             paymentMethod: paymentMethodId,
//             payment: {
//                 paymentIntentId: paymentIntent.id,
//                 status: 'held',
//                 currency: 'cad',
//                 authorizedAt: new Date(),
//                 serviceAmount: serviceAmountInCents / 100,
//                 totalClientPays: fees.totalClientPays / 100,
//                 taskerPayout: fees.taskerPayout / 100,
//                 applicationFee: fees.applicationFee / 100,
//             },
//         });

//         try {
//             await booking.save();
//             console.log("✅ Booking saved:", booking._id);
//         } catch (dbError) {
//             console.error("❌ Database error, cancelling PaymentIntent:", dbError);

//             try {
//                 await stripe.paymentIntents.cancel(paymentIntent.id);
//             } catch (cancelError) {
//                 console.error("❌ Failed to cancel PaymentIntent:", cancelError);
//             }

//             await logBooking({
//                 action: "BOOKING_CREATED",
//                 user: { ...req.user, ...client.toObject() },
//                 req,
//                 serviceTitle: service.title,
//                 taskerId: tasker._id.toString(),
//                 taskerName: taskerFullName,
//                 amount: fees.totalClientPays / 100,
//                 status: "failure",
//                 metadata: {
//                     errorMessage: "Database error - booking not saved",
//                     errorCode: "DATABASE_ERROR",
//                     dbError: dbError.message,
//                     paymentIntentCancelled: true,
//                 },
//             });

//             return res.status(500).json({
//                 message: 'Failed to save booking. Payment was not charged.',
//                 code: 'DATABASE_ERROR'
//             });
//         }

//         // ✅ Log successful booking creation
//         await logBooking({
//             action: "BOOKING_CREATED",
//             user: { ...req.user, ...client.toObject() },
//             req,
//             bookingId: booking._id.toString(),
//             serviceTitle: service.title,
//             taskerId: tasker._id.toString(),
//             taskerName: taskerFullName,
//             amount: fees.totalClientPays / 100,
//             status: "success",
//             metadata: {
//                 // Booking details
//                 bookingDate: bookingDate.toISOString(),
//                 dayOfWeek: dayName,
//                 serviceDescription: service.description?.substring(0, 100),
//                 hourlyRate: service.hourlyRate,
//                 estimatedDuration: service.estimatedDuration,

//                 // Payment details
//                 paymentIntentId: paymentIntent.id,
//                 serviceAmount: serviceAmountInCents / 100,
//                 clientPlatformFee: fees.clientPlatformFee / 100,
//                 reservationFee: fees.reservationFee / 100,
//                 clientTax: fees.clientTax / 100,
//                 totalClientPays: fees.totalClientPays / 100,
//                 taskerPlatformFee: fees.taskerPlatformFee / 100,
//                 taskerPayout: fees.taskerPayout / 100,
//                 applicationFee: fees.applicationFee / 100,

//                 // User details
//                 clientEmail: client.email,
//                 taskerEmail: tasker.email,
//                 taskerStripeAccountId: taskerStripeAccountId,
//             },
//         });

//         // ==================== POPULATE AND RESPOND ====================

//         const populatedBooking = await BookingTasker.findById(booking._id)
//             .populate("tasker", "firstName lastName email phone profilePicture currentRole rating reviewCount")
//             .populate("client", "firstName lastName email phone profilePicture currentRole");

//         // Send notifications (non-blocking)
//         const formattedDate = bookingDate.toLocaleDateString('en-US', {
//             weekday: 'long',
//             year: 'numeric',
//             month: 'long',
//             day: 'numeric',
//             hour: '2-digit',
//             minute: '2-digit'
//         });

//         try {
//             await createNotification(
//                 taskerId,
//                 "🎉 New Confirmed Booking!",
//                 `${clientFullName} has booked "${service.title}" on ${formattedDate}. You'll receive $${(fees.taskerPayout / 100).toFixed(2)} upon completion.`,
//                 "booking-confirmed",
//                 booking._id
//             );
//         } catch (e) { console.error("Notification error:", e); }

//         try {
//             await createNotification(
//                 clientId,
//                 "✅ Booking Confirmed!",
//                 `Your booking for "${service.title}" with ${taskerFullName} on ${formattedDate} is confirmed. Total: $${(fees.totalClientPays / 100).toFixed(2)}.`,
//                 "booking-confirmed",
//                 booking._id
//             );
//         } catch (e) { console.error("Notification error:", e); }

//         res.status(201).json({
//             success: true,
//             message: "Booking created and confirmed successfully",
//             booking: populatedBooking,
//             paymentBreakdown: {
//                 serviceAmount: serviceAmountInCents / 100,
//                 totalClientPays: fees.totalClientPays / 100,
//                 taskerPayout: fees.taskerPayout / 100,
//                 platformTotal: fees.applicationFee / 100,
//                 currency: 'CAD',
//                 status: 'held',
//             },
//         });

//     } catch (error) {
//         console.error("❌ Error creating booking:", error);

//         if (paymentIntent?.id) {
//             try {
//                 await stripe.paymentIntents.cancel(paymentIntent.id);
//             } catch (cancelError) {
//                 console.error("❌ Failed to cancel PaymentIntent:", cancelError);
//             }
//         }

//         // ✅ Log unexpected error
//         await logBooking({
//             action: "BOOKING_CREATED",
//             user: req.user,
//             req,
//             serviceTitle: service?.title,
//             taskerId,
//             status: "failure",
//             metadata: {
//                 errorMessage: error.message,
//                 errorName: error.name,
//                 errorStack: error.stack?.substring(0, 500),
//                 paymentIntentCancelled: !!paymentIntent?.id,
//             },
//         });

//         res.status(500).json({
//             message: "Server error while creating booking",
//             error: process.env.NODE_ENV === 'development' ? error.message : undefined
//         });
//     }
// };

const createBooking = async (req, res) => {
    let paymentIntent = null;
    const { taskerId, service, date, dayOfWeek, paymentMethodId: providedPaymentMethodId } = req.body;
    const clientId = req.user?.id;

    try {
        console.log('=== CREATE BOOKING REQUEST ===');
        console.log('Raw Request Body:', JSON.stringify(req.body, null, 2));

        // ==================== BASIC VALIDATIONS ====================

        if (!clientId) {
            await logBooking({
                action: "BOOKING_CREATED",
                user: null,
                req,
                serviceTitle: service?.title,
                taskerId,
                status: "failure",
                metadata: {
                    errorMessage: "Unauthorized: User not authenticated",
                    errorCode: "UNAUTHORIZED",
                },
            });

            return res.status(401).json({ message: "Unauthorized: User not authenticated" });
        }

        if (!mongoose.Types.ObjectId.isValid(taskerId) || !mongoose.Types.ObjectId.isValid(clientId)) {
            await logBooking({
                action: "BOOKING_CREATED",
                user: req.user,
                req,
                serviceTitle: service?.title,
                taskerId,
                status: "failure",
                metadata: {
                    errorMessage: "Invalid tasker or client ID",
                    errorCode: "INVALID_IDS",
                    providedTaskerId: taskerId,
                    providedClientId: clientId,
                },
            });

            return res.status(400).json({ message: "Invalid tasker or client ID" });
        }

        if (!service || !service.title || !service.description || !service.hourlyRate || !service.estimatedDuration) {
            await logBooking({
                action: "BOOKING_CREATED",
                user: req.user,
                req,
                taskerId,
                status: "failure",
                metadata: {
                    errorMessage: "Service details are required",
                    errorCode: "MISSING_SERVICE_DETAILS",
                    providedService: service,
                },
            });

            return res.status(400).json({ message: "Service details are required" });
        }

        if (!date) {
            await logBooking({
                action: "BOOKING_CREATED",
                user: req.user,
                req,
                serviceTitle: service.title,
                taskerId,
                status: "failure",
                metadata: {
                    errorMessage: "Booking date and time are required",
                    errorCode: "MISSING_DATE",
                },
            });

            return res.status(400).json({ message: "Booking date and time are required" });
        }

        // ==================== VALIDATE USERS ====================

        const tasker = await User.findById(taskerId);
        if (!tasker || tasker.currentRole !== "tasker") {
            await logBooking({
                action: "BOOKING_CREATED",
                user: req.user,
                req,
                serviceTitle: service.title,
                taskerId,
                status: "failure",
                metadata: {
                    errorMessage: "Tasker not found or invalid role",
                    errorCode: "INVALID_TASKER",
                    taskerExists: !!tasker,
                    taskerRole: tasker?.currentRole,
                },
            });

            return res.status(400).json({ message: "Tasker not found or invalid role" });
        }

        const client = await User.findById(clientId).select('+address');
        if (!client || client.currentRole !== "client") {
            await logBooking({
                action: "BOOKING_CREATED",
                user: req.user,
                req,
                serviceTitle: service.title,
                taskerId,
                taskerName: `${tasker.firstName} ${tasker.lastName}`,
                status: "failure",
                metadata: {
                    errorMessage: "Client not found or invalid role",
                    errorCode: "INVALID_CLIENT",
                },
            });

            return res.status(400).json({ message: "Client not found or invalid role" });
        }

        // ⭐ REMOVED: Tasker Stripe Connect validation - no longer needed

        // ==================== HANDLE PAYMENT METHOD ====================

        let paymentMethodId = providedPaymentMethodId;
        let customerId = client.stripeCustomerId;

        console.log("=== PAYMENT METHOD DEBUG ===");
        console.log("Provided Payment Method ID:", providedPaymentMethodId);
        console.log("Client's stored stripeCustomerId:", customerId);

        if (!paymentMethodId) {
            paymentMethodId = client.defaultPaymentMethod || client.defaultPaymentMethodId;
        }

        if (!paymentMethodId) {
            await logBooking({
                action: "BOOKING_CREATED",
                user: { ...req.user, ...client.toObject() },
                req,
                serviceTitle: service.title,
                taskerId: tasker._id.toString(),
                taskerName: `${tasker.firstName} ${tasker.lastName}`,
                status: "failure",
                metadata: {
                    errorMessage: "No payment method provided",
                    errorCode: "NO_PAYMENT_METHOD",
                    clientEmail: client.email,
                },
            });

            return res.status(400).json({
                message: 'No payment method provided. Please add a card.',
                code: 'NO_PAYMENT_METHOD',
            });
        }

        // STEP 1: Ensure we have a Stripe Customer
        if (!customerId) {
            console.log("Creating new Stripe Customer for client...");
            try {
                const customerName = `${client.firstName} ${client.lastName}`.trim();
                const customer = await stripe.customers.create({
                    email: client.email,
                    name: customerName,
                    phone: client.phone || undefined,
                    description: `Client - ${customerName}`,
                    metadata: {
                        userId: client._id.toString(),
                        platform: 'taskallo',
                        userType: 'client',
                    },
                });
                customerId = customer.id;
                client.stripeCustomerId = customerId;
                await client.save();
                console.log("✅ Created new Stripe Customer:", customerId);
            } catch (customerError) {
                console.error("❌ Failed to create Stripe Customer:", customerError);

                await logBooking({
                    action: "BOOKING_CREATED",
                    user: { ...req.user, ...client.toObject() },
                    req,
                    serviceTitle: service.title,
                    taskerId: tasker._id.toString(),
                    taskerName: `${tasker.firstName} ${tasker.lastName}`,
                    status: "failure",
                    metadata: {
                        errorMessage: "Failed to create Stripe customer",
                        errorCode: "CUSTOMER_CREATION_FAILED",
                        stripeError: customerError.message,
                    },
                });

                return res.status(400).json({
                    message: 'Failed to set up payment. Please try again.',
                    code: 'CUSTOMER_CREATION_FAILED',
                });
            }
        }

        // STEP 2: Retrieve and validate payment method
        let paymentMethod;
        try {
            paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
            console.log("✅ Payment method retrieved:", paymentMethodId);
        } catch (pmRetrieveError) {
            console.error("❌ Failed to retrieve payment method:", pmRetrieveError);

            client.defaultPaymentMethod = null;
            client.defaultPaymentMethodId = null;
            await client.save();

            await logBooking({
                action: "BOOKING_CREATED",
                user: { ...req.user, ...client.toObject() },
                req,
                serviceTitle: service.title,
                taskerId: tasker._id.toString(),
                taskerName: `${tasker.firstName} ${tasker.lastName}`,
                status: "failure",
                metadata: {
                    errorMessage: "Payment method not found or invalid",
                    errorCode: "PAYMENT_METHOD_NOT_FOUND",
                    paymentMethodId,
                },
            });

            return res.status(400).json({
                message: 'Payment method not found or invalid. Please add a new card.',
                code: 'PAYMENT_METHOD_NOT_FOUND',
            });
        }

        // STEP 3: Attach payment method to customer if not already attached
        if (!paymentMethod.customer) {
            try {
                await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
                console.log("✅ Payment method attached to customer:", customerId);
            } catch (attachError) {
                console.error("❌ Failed to attach payment method:", attachError);

                await logBooking({
                    action: "BOOKING_CREATED",
                    user: { ...req.user, ...client.toObject() },
                    req,
                    serviceTitle: service.title,
                    taskerId: tasker._id.toString(),
                    taskerName: `${tasker.firstName} ${tasker.lastName}`,
                    status: "failure",
                    metadata: {
                        errorMessage: "Failed to attach payment method",
                        errorCode: "PAYMENT_METHOD_ATTACH_FAILED",
                        stripeError: attachError.message,
                    },
                });

                return res.status(400).json({
                    message: 'Failed to set up payment method. Please try a different card.',
                    code: 'PAYMENT_METHOD_ATTACH_FAILED',
                });
            }
        } else if (paymentMethod.customer !== customerId) {
            customerId = paymentMethod.customer;
            client.stripeCustomerId = customerId;
        }

        // Update client's payment records
        client.stripeCustomerId = customerId;
        client.defaultPaymentMethod = paymentMethodId;
        client.defaultPaymentMethodId = paymentMethodId;
        await client.save();

        // ==================== PARSE AND VALIDATE DATE ====================

        const bookingDate = new Date(date);

        if (isNaN(bookingDate.getTime())) {
            await logBooking({
                action: "BOOKING_CREATED",
                user: { ...req.user, ...client.toObject() },
                req,
                serviceTitle: service.title,
                taskerId: tasker._id.toString(),
                taskerName: `${tasker.firstName} ${tasker.lastName}`,
                status: "failure",
                metadata: {
                    errorMessage: "Invalid date format",
                    errorCode: "INVALID_DATE",
                    providedDate: date,
                },
            });

            return res.status(400).json({ message: "Invalid date format" });
        }

        if (bookingDate < new Date()) {
            await logBooking({
                action: "BOOKING_CREATED",
                user: { ...req.user, ...client.toObject() },
                req,
                serviceTitle: service.title,
                taskerId: tasker._id.toString(),
                taskerName: `${tasker.firstName} ${tasker.lastName}`,
                status: "failure",
                metadata: {
                    errorMessage: "Cannot book a time in the past",
                    errorCode: "PAST_DATE",
                    providedDate: date,
                    currentTime: new Date().toISOString(),
                },
            });

            return res.status(400).json({ message: "Cannot book a time in the past" });
        }

        // ==================== VALIDATE AVAILABILITY ====================

        let dayName = dayOfWeek || getDayNameFromDate(new Date(date.split('T')[0]));

        if (!tasker.availability || tasker.availability.length === 0) {
            await logBooking({
                action: "BOOKING_CREATED",
                user: { ...req.user, ...client.toObject() },
                req,
                serviceTitle: service.title,
                taskerId: tasker._id.toString(),
                taskerName: `${tasker.firstName} ${tasker.lastName}`,
                status: "failure",
                metadata: {
                    errorMessage: "Tasker has not set their availability",
                    errorCode: "NO_AVAILABILITY",
                    requestedDay: dayName,
                },
            });

            return res.status(400).json({
                message: "Tasker has not set their availability",
            });
        }

        const availability = tasker.availability.find(slot =>
            slot.day.toLowerCase() === dayName.toLowerCase()
        );

        if (!availability) {
            await logBooking({
                action: "BOOKING_CREATED",
                user: { ...req.user, ...client.toObject() },
                req,
                serviceTitle: service.title,
                taskerId: tasker._id.toString(),
                taskerName: `${tasker.firstName} ${tasker.lastName}`,
                status: "failure",
                metadata: {
                    errorMessage: `Tasker is not available on ${dayName}`,
                    errorCode: "DAY_NOT_AVAILABLE",
                    requestedDay: dayName,
                    taskerAvailability: tasker.availability.map(a => a.day),
                },
            });

            return res.status(400).json({
                message: `Tasker is not available on ${dayName}`,
            });
        }

        // ==================== VALIDATE TIME SLOT ====================

        const timePart = date.includes('T') ? date.split('T')[1] : null;
        let hours, minutes;

        if (timePart) {
            const timeMatch = timePart.match(/(\d{2}):(\d{2})/);
            if (timeMatch) {
                hours = parseInt(timeMatch[1]);
                minutes = parseInt(timeMatch[2]);
            } else {
                hours = bookingDate.getHours();
                minutes = bookingDate.getMinutes();
            }
        } else {
            hours = bookingDate.getHours();
            minutes = bookingDate.getMinutes();
        }

        const [startHour, startMinute] = availability.from.split(':').map(Number);
        const [endHour, endMinute] = availability.to.split(':').map(Number);
        const bookingTimeInMinutes = hours * 60 + minutes;
        const startTimeInMinutes = startHour * 60 + startMinute;
        const endTimeInMinutes = endHour * 60 + endMinute;

        if (bookingTimeInMinutes < startTimeInMinutes || bookingTimeInMinutes >= endTimeInMinutes) {
            await logBooking({
                action: "BOOKING_CREATED",
                user: { ...req.user, ...client.toObject() },
                req,
                serviceTitle: service.title,
                taskerId: tasker._id.toString(),
                taskerName: `${tasker.firstName} ${tasker.lastName}`,
                status: "failure",
                metadata: {
                    errorMessage: `Booking time must be between ${availability.from} and ${availability.to}`,
                    errorCode: "TIME_OUT_OF_RANGE",
                    requestedTime: `${hours}:${minutes}`,
                    availableFrom: availability.from,
                    availableTo: availability.to,
                },
            });

            return res.status(400).json({
                message: `Booking time must be between ${availability.from} and ${availability.to} on ${dayName}`
            });
        }

        // ==================== CHECK FOR CONFLICTING BOOKINGS ====================

        const startOfDay = new Date(bookingDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(bookingDate);
        endOfDay.setHours(23, 59, 59, 999);

        const existingBooking = await BookingTasker.findOne({
            tasker: taskerId,
            date: { $gte: startOfDay, $lte: endOfDay },
            status: { $in: ['pending', 'confirmed'] }
        });

        if (existingBooking) {
            const existingTime = new Date(existingBooking.date);
            const existingHours = existingTime.getHours();

            if (Math.abs(hours - existingHours) < 1) {
                await logBooking({
                    action: "BOOKING_CREATED",
                    user: { ...req.user, ...client.toObject() },
                    req,
                    serviceTitle: service.title,
                    taskerId: tasker._id.toString(),
                    taskerName: `${tasker.firstName} ${tasker.lastName}`,
                    status: "failure",
                    metadata: {
                        errorMessage: "Time slot already booked",
                        errorCode: "SLOT_CONFLICT",
                        requestedTime: `${hours}:${minutes}`,
                        conflictingBookingId: existingBooking._id.toString(),
                    },
                });

                return res.status(400).json({
                    message: "This time slot is already booked. Please choose another time."
                });
            }
        }

        // ==================== CALCULATE FEES ====================

        const serviceAmountInCents = Math.round(service.hourlyRate * 100);
        const fees = calculateBookingFees(serviceAmountInCents);

        // ⭐ CHANGED: Platform keeps everything
        const platformRevenueCents = fees.totalClientPays;

        console.log("💰 Payment Breakdown:");
        console.log(`   Total Client Pays: $${(fees.totalClientPays / 100).toFixed(2)}`);
        console.log(`   Tasker Will Receive (Manual Payment): $${(fees.taskerPayout / 100).toFixed(2)}`);
        console.log(`   Platform Receives: $${(platformRevenueCents / 100).toFixed(2)}`);

        if (fees.totalClientPays < 50) {
            await logBooking({
                action: "BOOKING_CREATED",
                user: { ...req.user, ...client.toObject() },
                req,
                serviceTitle: service.title,
                taskerId: tasker._id.toString(),
                taskerName: `${tasker.firstName} ${tasker.lastName}`,
                amount: fees.totalClientPays / 100,
                status: "failure",
                metadata: {
                    errorMessage: "Minimum service amount is $0.50 CAD",
                    errorCode: "AMOUNT_TOO_SMALL",
                    serviceAmount: serviceAmountInCents / 100,
                },
            });

            return res.status(400).json({
                message: 'Minimum service amount is $0.50 CAD',
                code: 'AMOUNT_TOO_SMALL'
            });
        }

        // ==================== CREATE PAYMENT INTENT ====================

        const clientFullName = `${client.firstName} ${client.lastName}`.trim();
        const taskerFullName = `${tasker.firstName} ${tasker.lastName}`.trim();

        try {
            // ⭐ FIXED: Removed statement_descriptor, using only statement_descriptor_suffix
            paymentIntent = await stripe.paymentIntents.create({
                amount: fees.totalClientPays,
                currency: 'cad',
                customer: customerId,
                payment_method: paymentMethodId,
                capture_method: 'manual',
                description: `Booking: "${service.title}" | Client: ${clientFullName} | Tasker: ${taskerFullName}`,
                receipt_email: client.email,

                // ⭐ FIXED: Only use statement_descriptor_suffix with automatic_payment_methods
                statement_descriptor_suffix: 'BOOKING',

                metadata: {
                    type: 'booking',
                    clientId: clientId.toString(),
                    taskerId: taskerId.toString(),
                    serviceTitle: service.title.substring(0, 100),
                    paymentModel: 'direct_platform',
                    taskerPayout: (fees.taskerPayout / 100).toString(),
                },
                automatic_payment_methods: {
                    enabled: true,
                    allow_redirects: 'never'
                },
                confirm: true,
            });

            console.log("✅ PaymentIntent created:", paymentIntent.id);

            // ✅ Log payment authorization
            await logPayment({
                action: "PAYMENT_AUTHORIZED",
                user: { ...req.user, ...client.toObject() },
                req,
                taskId: null,
                taskTitle: service.title,
                amount: fees.totalClientPays,
                paymentIntentId: paymentIntent.id,
                status: "success",
                metadata: {
                    bookingType: "service",
                    taskerId: tasker._id.toString(),
                    taskerName: taskerFullName,
                    taskerPayout: fees.taskerPayout / 100,
                    platformRevenue: platformRevenueCents / 100,
                    paymentModel: 'direct_platform',
                    manualPayoutRequired: true,
                },
            });

        } catch (stripeError) {
            console.error("❌ Stripe PaymentIntent creation failed:", stripeError);

            // ✅ Log payment failure
            await logPayment({
                action: "PAYMENT_FAILED",
                user: { ...req.user, ...client.toObject() },
                req,
                taskTitle: service.title,
                amount: fees.totalClientPays,
                status: "failure",
                metadata: {
                    errorMessage: stripeError.message,
                    errorCode: stripeError.code,
                    errorType: stripeError.type,
                    declineCode: stripeError.decline_code,
                    taskerId: tasker._id.toString(),
                },
            });

            // Also log booking failure
            await logBooking({
                action: "BOOKING_CREATED",
                user: { ...req.user, ...client.toObject() },
                req,
                serviceTitle: service.title,
                taskerId: tasker._id.toString(),
                taskerName: taskerFullName,
                amount: fees.totalClientPays / 100,
                status: "failure",
                metadata: {
                    errorMessage: "Payment authorization failed",
                    errorCode: stripeError.code || "PAYMENT_FAILED",
                    stripeError: stripeError.message,
                    declineCode: stripeError.decline_code,
                },
            });

            if (stripeError.type === 'StripeCardError') {
                return res.status(400).json({
                    message: stripeError.message,
                    code: 'CARD_ERROR',
                    decline_code: stripeError.decline_code
                });
            }

            return res.status(400).json({
                message: 'Payment authorization failed: ' + stripeError.message,
                code: 'PAYMENT_FAILED',
            });
        }

        // Verify payment was authorized
        if (paymentIntent.status !== 'requires_capture') {
            console.error("❌ Unexpected payment status:", paymentIntent.status);

            try {
                await stripe.paymentIntents.cancel(paymentIntent.id);
            } catch (e) {
                console.error("Could not cancel PaymentIntent:", e);
            }

            await logBooking({
                action: "BOOKING_CREATED",
                user: { ...req.user, ...client.toObject() },
                req,
                serviceTitle: service.title,
                taskerId: tasker._id.toString(),
                taskerName: taskerFullName,
                amount: fees.totalClientPays / 100,
                status: "failure",
                metadata: {
                    errorMessage: "Payment authorization failed - unexpected status",
                    errorCode: "AUTHORIZATION_FAILED",
                    paymentStatus: paymentIntent.status,
                    lastPaymentError: paymentIntent.last_payment_error?.message,
                },
            });

            return res.status(400).json({
                message: 'Payment authorization failed',
                code: 'AUTHORIZATION_FAILED',
            });
        }

        // ==================== CREATE BOOKING ====================

        const booking = new BookingTasker({
            tasker: taskerId,
            client: clientId,
            service: {
                title: service.title,
                description: service.description,
                hourlyRate: service.hourlyRate,
                estimatedDuration: service.estimatedDuration,
            },
            date: bookingDate,
            totalAmount: service.hourlyRate,
            status: "confirmed",
            confirmedAt: new Date(),
            paymentIntentId: paymentIntent.id,
            stripeStatus: 'authorized',
            paymentMethod: paymentMethodId,
            payment: {
                paymentIntentId: paymentIntent.id,
                status: 'held',
                currency: 'cad',
                paymentModel: 'direct_platform',
                authorizedAt: new Date(),
                serviceAmount: serviceAmountInCents / 100,
                totalClientPays: fees.totalClientPays / 100,
                taskerPayout: fees.taskerPayout / 100,
                platformRevenue: platformRevenueCents / 100,
                applicationFee: fees.applicationFee / 100,
                manualPayoutRequired: true,
                taskerPaid: false,
            },
        });

        try {
            await booking.save();
            console.log("✅ Booking saved:", booking._id);
        } catch (dbError) {
            console.error("❌ Database error, cancelling PaymentIntent:", dbError);

            try {
                await stripe.paymentIntents.cancel(paymentIntent.id);
            } catch (cancelError) {
                console.error("❌ Failed to cancel PaymentIntent:", cancelError);
            }

            await logBooking({
                action: "BOOKING_CREATED",
                user: { ...req.user, ...client.toObject() },
                req,
                serviceTitle: service.title,
                taskerId: tasker._id.toString(),
                taskerName: taskerFullName,
                amount: fees.totalClientPays / 100,
                status: "failure",
                metadata: {
                    errorMessage: "Database error - booking not saved",
                    errorCode: "DATABASE_ERROR",
                    dbError: dbError.message,
                    paymentIntentCancelled: true,
                },
            });

            return res.status(500).json({
                message: 'Failed to save booking. Payment was not charged.',
                code: 'DATABASE_ERROR'
            });
        }

        // ✅ Log successful booking creation
        await logBooking({
            action: "BOOKING_CREATED",
            user: { ...req.user, ...client.toObject() },
            req,
            bookingId: booking._id.toString(),
            serviceTitle: service.title,
            taskerId: tasker._id.toString(),
            taskerName: taskerFullName,
            amount: fees.totalClientPays / 100,
            status: "success",
            metadata: {
                bookingDate: bookingDate.toISOString(),
                dayOfWeek: dayName,
                serviceDescription: service.description?.substring(0, 100),
                hourlyRate: service.hourlyRate,
                estimatedDuration: service.estimatedDuration,
                paymentIntentId: paymentIntent.id,
                paymentModel: 'direct_platform',
                serviceAmount: serviceAmountInCents / 100,
                clientPlatformFee: fees.clientPlatformFee / 100,
                reservationFee: fees.reservationFee / 100,
                clientTax: fees.clientTax / 100,
                totalClientPays: fees.totalClientPays / 100,
                taskerPlatformFee: fees.taskerPlatformFee / 100,
                taskerPayout: fees.taskerPayout / 100,
                platformRevenue: platformRevenueCents / 100,
                manualPayoutRequired: true,
                clientEmail: client.email,
                taskerEmail: tasker.email,
            },
        });

        // ==================== POPULATE AND RESPOND ====================

        const populatedBooking = await BookingTasker.findById(booking._id)
            .populate("tasker", "firstName lastName email phone profilePicture currentRole rating reviewCount")
            .populate("client", "firstName lastName email phone profilePicture currentRole");

        // Send notifications (non-blocking)
        const formattedDate = bookingDate.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        try {
            await createNotification(
                taskerId,
                "🎉 New Confirmed Booking!",
                `${clientFullName} has booked "${service.title}" on ${formattedDate}. You'll receive $${(fees.taskerPayout / 100).toFixed(2)} upon completion and approval.`,
                "booking-confirmed",
                booking._id
            );
        } catch (e) { console.error("Notification error:", e); }

        try {
            await createNotification(
                clientId,
                "✅ Booking Confirmed!",
                `Your booking for "${service.title}" with ${taskerFullName} on ${formattedDate} is confirmed. Total: $${(fees.totalClientPays / 100).toFixed(2)}.`,
                "booking-confirmed",
                booking._id
            );
        } catch (e) { console.error("Notification error:", e); }

        res.status(201).json({
            success: true,
            message: "Booking created and confirmed successfully",
            booking: populatedBooking,
            paymentBreakdown: {
                serviceAmount: serviceAmountInCents / 100,
                totalClientPays: fees.totalClientPays / 100,
                taskerPayout: fees.taskerPayout / 100,
                platformRevenue: platformRevenueCents / 100,
                currency: 'CAD',
                status: 'held',
                paymentModel: 'direct_platform',
            },
        });

    } catch (error) {
        console.error("❌ Error creating booking:", error);

        if (paymentIntent?.id) {
            try {
                await stripe.paymentIntents.cancel(paymentIntent.id);
            } catch (cancelError) {
                console.error("❌ Failed to cancel PaymentIntent:", cancelError);
            }
        }

        // ✅ Log unexpected error
        await logBooking({
            action: "BOOKING_CREATED",
            user: req.user,
            req,
            serviceTitle: service?.title,
            taskerId,
            status: "failure",
            metadata: {
                errorMessage: error.message,
                errorName: error.name,
                errorStack: error.stack?.substring(0, 500),
                paymentIntentCancelled: !!paymentIntent?.id,
            },
        });

        res.status(500).json({
            message: "Server error while creating booking",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

export { calculateBookingFees };



const getAllBookings = async (req, res) => {
    try {
        const bookings = await BookingTasker.find()
            .populate("tasker", "firstName lastName email phone role profilePicture")
            .populate("client", "firstName lastName email phone role profilePicture");
        res.status(200).json(bookings);
    } catch (error) {
        console.error("Error fetching bookings:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// Get Booking By ID
const getBookingsByUserId = async (req, res) => {
    try {
        const { userId } = req.params;

        const bookings = await BookingTasker.find({ client: userId })
            .populate("tasker", "firstName lastName email phone role profilePicture")
            .populate("client", "firstName lastName email phone role profilePicture");

        res.status(200).json(bookings);
    } catch (error) {
        console.error("Error fetching user bookings:", error);
        res.status(500).json({ message: "Server error" });
    }
};



const updateBooking = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, service } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid booking ID" });
        }

        const booking = await BookingTasker.findById(id)
            .populate("tasker", "firstName lastName email")
            .populate("client", "firstName lastName email");

        if (!booking) {
            return res.status(404).json({ message: "Booking not found" });
        }

        // Track previous values for notification
        const previousStatus = booking.status;
        const previousService = booking.service;

        // Update booking
        if (status) booking.status = status;
        if (service) booking.service = service;
        await booking.save();

        const populatedBooking = await BookingTasker.findById(id)
            .populate("tasker", "firstName lastName email phone role")
            .populate("client", "firstName lastName email phone role");

        // FIX: Get updater details from database
        const updater = await User.findById(req.user.id).select("firstName lastName");
        const updaterName = updater
            ? `${updater.firstName} ${updater.lastName}`
            : "Someone";

        // Determine who is updating and who should be notified
        const isClientUpdating = booking.client._id.toString() === req.user.id;
        const otherPartyId = isClientUpdating ? booking.tasker._id : booking.client._id;
        const otherPartyName = isClientUpdating
            ? `${booking.tasker.firstName} ${booking.tasker.lastName}`
            : `${booking.client.firstName} ${booking.client.lastName}`;

        // Format date for notifications
        const formattedDate = booking.date.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        // Build notification message based on what changed
        let notificationTitle = "Booking Updated";
        let notificationMessage = "";
        let notificationType = "booking-updated";

        if (status && status !== previousStatus) {
            // Status change notifications
            switch (status) {
                case "confirmed":
                    notificationTitle = "✅ Booking Confirmed!";
                    notificationMessage = `${updaterName} has confirmed the booking for "${booking.service?.title || 'Service'}" on ${formattedDate}.`;
                    notificationType = "booking-confirmed";
                    break;
                case "cancelled":
                    notificationTitle = "❌ Booking Cancelled";
                    notificationMessage = `${updaterName} has cancelled the booking for "${booking.service?.title || 'Service'}" on ${formattedDate}.`;
                    notificationType = "booking-cancelled";
                    break;
                case "completed":
                    notificationTitle = "🎉 Booking Completed!";
                    notificationMessage = `The booking for "${booking.service?.title || 'Service'}" on ${formattedDate} has been marked as completed.`;
                    notificationType = "booking-completed";
                    break;
                case "in-progress":
                    notificationTitle = "🔄 Booking In Progress";
                    notificationMessage = `The booking for "${booking.service?.title || 'Service'}" on ${formattedDate} is now in progress.`;
                    notificationType = "booking-in-progress";
                    break;
                default:
                    notificationMessage = `${updaterName} updated the booking status to "${status}" for "${booking.service?.title || 'Service'}" on ${formattedDate}.`;
            }
        } else if (service && service.title !== previousService?.title) {
            notificationTitle = "📝 Booking Service Changed";
            notificationMessage = `${updaterName} changed the service from "${previousService?.title || 'Previous Service'}" to "${service.title}" for the booking on ${formattedDate}.`;
            notificationType = "booking-service-changed";
        } else {
            notificationMessage = `${updaterName} made updates to the booking for "${booking.service?.title || 'Service'}" on ${formattedDate}.`;
        }

        // Create notification for the other party
        try {
            // Debug: Log notification details
            console.log("Creating booking update notification:", {
                recipientId: otherPartyId,
                updaterName,
                status,
                previousStatus,
                notificationType
            });

            await createNotification(
                otherPartyId,
                notificationTitle,
                notificationMessage,
                notificationType,
                booking._id
            );
            console.log("✅ Notification created for booking update");

        } catch (notifErr) {
            console.error("❌ Failed to create notification (non-blocking):", notifErr);
        }

        // Send confirmation notification to the updater
        try {
            let confirmationTitle = "Booking Update Confirmed";
            let confirmationMessage = `Your update to the booking for "${booking.service?.title || 'Service'}" has been saved.`;

            if (status === "confirmed") {
                confirmationTitle = "Booking Confirmation Sent";
                confirmationMessage = `You have confirmed the booking with ${otherPartyName} for "${booking.service?.title || 'Service'}" on ${formattedDate}.`;
            } else if (status === "cancelled") {
                confirmationTitle = "Booking Cancellation Confirmed";
                confirmationMessage = `You have cancelled the booking with ${otherPartyName} for "${booking.service?.title || 'Service'}" on ${formattedDate}.`;
            }

            await createNotification(
                req.user.id,
                confirmationTitle,
                confirmationMessage,
                "booking-update-confirmed",
                booking._id
            );
            console.log("✅ Confirmation notification sent to updater");

        } catch (notifErr) {
            console.error("❌ Failed to create confirmation notification (non-blocking):", notifErr);
        }

        // If booking completed, prompt for review
        if (status === "completed") {
            try {
                // Prompt client to review tasker
                if (isClientUpdating || req.user.role === "client") {
                    await createNotification(
                        booking.client._id,
                        "⭐ Leave a Review",
                        `How was your experience with ${booking.tasker.firstName} ${booking.tasker.lastName} for "${booking.service?.title}"? Leave a review to help others!`,
                        "review-prompt",
                        booking._id
                    );
                    console.log("✅ Review prompt sent to client");
                }
            } catch (notifErr) {
                console.error("❌ Failed to create review prompt notification:", notifErr);
            }
        }

        res.status(200).json({ message: "Booking updated successfully", booking: populatedBooking });
    } catch (error) {
        console.error("Error updating booking:", error);
        res.status(500).json({ message: "Server error" });
    }
};


// Add review
export const addReview = async (req, res) => {
    try {
        const { bookingId, rating, message } = req.body;
        const clientId = req.user._id;

        console.log('Client ID:', clientId, 'Booking ID:', bookingId); // Debug: Log IDs
        // Validate input
        if (!bookingId || !rating || !message) {
            return res.status(400).json({ message: "Booking ID, rating, and message are required" });
        }

        if (rating < 0 || rating > 5) {
            return res.status(400).json({ message: "Rating must be between 0 and 5" });
        }

        // Find the booking
        const booking = await BookingTasker.findById(bookingId);
        if (!booking) {
            return res.status(404).json({ message: "Booking not found" });
        }

        console.log(booking.client.toString())

        console.log('Booking Client ID:', booking.client.toString()); // Debug: Log booking client ID

        // Check if the booking is completed and the client is authorized
        if (booking.status !== "completed") {
            return res.status(400).json({ message: "Reviews can only be added for completed bookings" });
        }
        if (booking.client.toString() !== clientId.toString()
        ) {
            return res.status(403).json({ message: "You are not authorized to review this booking" });
        }

        // Check if a review already exists
        if (booking.review) {
            return res.status(400).json({ message: "A review has already been submitted for this booking" });
        }

        // Find the tasker
        const tasker = await User.findById(booking.tasker);
        if (!tasker || tasker.role !== "tasker") {
            return res.status(404).json({ message: "Tasker not found" });
        }

        // Add the review to the booking
        booking.review = {
            reviewer: clientId,
            rating,
            message,
            createdAt: new Date(),
        };

        // Add the review to the tasker's reviews array
        tasker.reviews.push({
            reviewer: clientId,
            rating,
            message,
            bookingId, // Link review to booking
            createdAt: new Date(),
        });

        // Update tasker's rating and review count
        const totalReviews = tasker.reviews.length;
        const averageRating =
            tasker.reviews.reduce((sum, rev) => sum + rev.rating, 0) / totalReviews;

        tasker.rating = parseFloat(averageRating.toFixed(2));
        tasker.reviewCount = totalReviews;

        await booking.save();
        await tasker.save();

        // Create notification for the tasker (new review) - non-blocking
        try {
            const client = await User.findById(clientId).select("firstName lastName");
            await createNotification(
                tasker._id, // Tasker ID
                "New Review Received",
                `You received a ${rating}-star review from ${client.firstName} ${client.lastName} for booking "${booking.service?.title || 'Booking'}". "${message}"`,
                "review",
                bookingId // Link to booking
            );
            console.log("Notification created for new review"); // Debug
        } catch (notifErr) {
            console.error("Failed to create notification (non-blocking):", notifErr); // Log but don't crash
        }

        res.status(201).json({ message: "Review added successfully", review: booking.review });
    } catch (error) {
        console.error("Error adding review:", error);
        res.status(500).json({ message: "Server error" });
    }
};


// controllers/bookingController.js
export const getBookingsByTaskerId = async (req, res) => {
    try {
        const { taskerId } = req.params;

        const bookings = await BookingTasker.find({ tasker: taskerId })
            .populate("tasker", "firstName lastName email phone role")
            .populate("client", "firstName lastName email phone role");

        if (!bookings || bookings.length === 0) {
            return res.status(404).json({ message: "No bookings found for this tasker" });
        }

        res.status(200).json(bookings);
    } catch (error) {
        console.error("Error fetching tasker bookings:", error);
        res.status(500).json({ message: "Server error" });
    }
};







// controllers/bookingController.js

// export const updateBookingStatus = async (req, res) => {
//     try {
//         const { id } = req.params;
//         const { status } = req.body;

//         const booking = await BookingTasker.findById(id)
//             .populate("tasker", "firstName lastName email")
//             .populate("client", "firstName lastName email");

//         if (!booking) {
//             return res.status(404).json({ message: "Booking not found" });
//         }

//         // Verify only tasker can update
//         if (booking.tasker._id.toString() !== req.user._id.toString()) {
//             return res.status(403).json({ message: "Unauthorized" });
//         }

//         const validStatuses = ["pending", "confirmed", "cancelled", "completed"];
//         if (status && !validStatuses.includes(status)) {
//             return res.status(400).json({ message: "Invalid status value" });
//         }

//         const previousStatus = booking.status;
//         const paymentIntentId = booking.payment?.paymentIntentId || booking.paymentIntentId;
//         const taskerPayout = booking.payment?.taskerPayout || 0;
//         const taskerPayoutFormatted = (taskerPayout / 100).toFixed(2);

//         // Handle payment based on status
//         if (status === "completed" && paymentIntentId) {
//             // ⭐ Capture payment - automatic split happens!
//             try {
//                 const paymentIntent = await stripe.paymentIntents.capture(paymentIntentId);

//                 if (paymentIntent.status === 'succeeded') {
//                     booking.stripeStatus = 'succeeded';
//                     booking.payment.status = 'captured';
//                     booking.payment.capturedAt = new Date();

//                     console.log("✅ Booking payment captured with split");

//                     // Update tasker earnings
//                     await User.findByIdAndUpdate(booking.tasker._id, {
//                         $inc: {
//                             'stats.bookingsCompleted': 1,
//                             'stats.totalEarnings': taskerPayout,
//                         }
//                     });
//                 }
//             } catch (stripeErr) {
//                 console.error("Payment capture failed:", stripeErr);
//                 return res.status(400).json({ message: "Payment capture failed" });
//             }
//         }

//         if (status === "cancelled" && paymentIntentId) {
//             // Check if payment was held or captured
//             try {
//                 const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

//                 if (paymentIntent.status === 'requires_capture') {
//                     // Just cancel the hold
//                     await stripe.paymentIntents.cancel(paymentIntentId);
//                     booking.payment.status = 'cancelled';

//                 } else if (paymentIntent.status === 'succeeded') {
//                     // Need to refund
//                     const refundAmount = booking.calculateRefundAmount();

//                     if (refundAmount > 0) {
//                         await stripe.refunds.create({
//                             payment_intent: paymentIntentId,
//                             amount: refundAmount,
//                             // Note: This also reverses the proportional transfer
//                         });

//                         booking.payment.status = refundAmount === booking.payment.grossAmount
//                             ? 'refunded'
//                             : 'partial_refund';
//                         booking.payment.refundAmount = refundAmount;
//                         booking.payment.refundedAt = new Date();
//                     }
//                 }

//                 booking.stripeStatus = 'canceled';
//             } catch (stripeErr) {
//                 console.error("Payment cancellation failed:", stripeErr);
//             }
//         }

//         booking.status = status;
//         booking.updatedAt = new Date();
//         if (status === "completed") booking.completedAt = new Date();
//         if (status === "cancelled") booking.cancelledAt = new Date();

//         await booking.save();

//         // Notifications
//         const taskerName = `${booking.tasker.firstName} ${booking.tasker.lastName}`;
//         const clientName = `${booking.client.firstName} ${booking.client.lastName}`;

//         if (status === "completed") {
//             try {
//                 await createNotification(
//                     booking.client._id,
//                     "🎉 Booking Completed!",
//                     `${taskerName} has completed your booking for "${booking.service?.title}".`,
//                     "booking-completed",
//                     id
//                 );

//                 await createNotification(
//                     booking.tasker._id,
//                     "💰 Payment Released!",
//                     `Booking completed! $${taskerPayoutFormatted} has been released to your account and will be deposited to your bank.`,
//                     "earnings-update",
//                     id
//                 );
//             } catch (notifErr) {
//                 console.error("Notification failed:", notifErr);
//             }
//         }

//         res.status(200).json({
//             message: "Booking updated successfully",
//             booking,
//             paymentInfo: status === "completed" ? {
//                 taskerPayout: taskerPayoutFormatted,
//             } : null
//         });

//     } catch (error) {
//         console.error("Error updating booking:", error);
//         res.status(500).json({ message: "Server error" });
//     }
// };


// export const updateBookingStatus = async (req, res) => {
//     try {
//         const { id } = req.params;
//         const { status } = req.body;

//         const booking = await BookingTasker.findById(id)
//             .populate("tasker", "firstName lastName email")
//             .populate("client", "firstName lastName email");

//         if (!booking) {
//             return res.status(404).json({ message: "Booking not found" });
//         }

//         // Verify only tasker can update
//         if (booking.tasker._id.toString() !== req.user._id.toString()) {
//             return res.status(403).json({ message: "Unauthorized" });
//         }

//         const validStatuses = ["pending", "confirmed", "cancelled", "completed"];
//         if (status && !validStatuses.includes(status)) {
//             return res.status(400).json({ message: "Invalid status value" });
//         }

//         const previousStatus = booking.status;
//         const paymentIntentId = booking.payment?.paymentIntentId || booking.paymentIntentId;
//         const taskerPayout = booking.payment?.taskerPayout || 0;
//         const taskerPayoutCents = Math.round(taskerPayout * 100);
//         const taskerPayoutFormatted = (taskerPayout).toFixed(2);

//         // Handle payment based on status
//         if (status === "completed" && paymentIntentId) {
//             // ⭐ CHANGED: Capture payment to platform account
//             try {
//                 const paymentIntent = await stripe.paymentIntents.capture(paymentIntentId);

//                 if (paymentIntent.status === 'succeeded') {
//                     booking.stripeStatus = 'succeeded';
//                     booking.payment.status = 'captured';
//                     booking.payment.capturedAt = new Date();

//                     console.log("✅ Booking payment captured to platform:");
//                     console.log("  Platform Receives:", booking.payment.platformRevenue);
//                     console.log("  Tasker Payout (Manual):", taskerPayout);

//                     // ⭐ REMOVED: Don't update earnings until manual payment
//                     // await User.findByIdAndUpdate(booking.tasker._id, {
//                     //     $inc: {
//                     //         'stats.bookingsCompleted': 1,
//                     //         'stats.totalEarnings': taskerPayoutCents,
//                     //     }
//                     // });

//                     // Just update booking count
//                     await User.findByIdAndUpdate(booking.tasker._id, {
//                         $inc: {
//                             'stats.bookingsCompleted': 1,
//                         }
//                     });

//                     // ✅ Log payment capture
//                     await logPayment({
//                         action: "PAYMENT_CAPTURED",
//                         user: req.user,
//                         req,
//                         taskId: id,
//                         taskTitle: booking.service?.title,
//                         amount: booking.payment.totalClientPays * 100,
//                         paymentIntentId,
//                         status: "success",
//                         metadata: {
//                             platformRevenue: booking.payment.platformRevenue,
//                             taskerPayout: taskerPayout,
//                             paymentModel: 'direct_platform',
//                             manualPayoutRequired: true,
//                             capturedAt: booking.payment.capturedAt,
//                         },
//                     });
//                 }
//             } catch (stripeErr) {
//                 console.error("Payment capture failed:", stripeErr);

//                 await logPayment({
//                     action: "PAYMENT_CAPTURED",
//                     user: req.user,
//                     req,
//                     taskId: id,
//                     taskTitle: booking.service?.title,
//                     amount: booking.payment?.totalClientPays * 100,
//                     paymentIntentId,
//                     status: "failure",
//                     metadata: {
//                         errorMessage: stripeErr.message,
//                         stripeErrorCode: stripeErr.code,
//                     },
//                 });

//                 return res.status(400).json({ message: "Payment capture failed" });
//             }
//         }

//         if (status === "cancelled" && paymentIntentId) {
//             // Check if payment was held or captured
//             try {
//                 const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

//                 if (paymentIntent.status === 'requires_capture') {
//                     // Just cancel the hold
//                     await stripe.paymentIntents.cancel(paymentIntentId);
//                     booking.payment.status = 'cancelled';
//                     booking.stripeStatus = 'canceled';

//                     await logPayment({
//                         action: "PAYMENT_FAILED",
//                         user: req.user,
//                         req,
//                         taskId: id,
//                         taskTitle: booking.service?.title,
//                         amount: booking.payment?.totalClientPays * 100,
//                         paymentIntentId,
//                         status: "success",
//                         metadata: {
//                             reason: "Booking cancelled",
//                             cancelledAt: new Date(),
//                         },
//                     });

//                 } else if (paymentIntent.status === 'succeeded') {
//                     // Need to refund
//                     const refundAmount = booking.calculateRefundAmount ? booking.calculateRefundAmount() : booking.payment.totalClientPays * 100;

//                     if (refundAmount > 0) {
//                         await stripe.refunds.create({
//                             payment_intent: paymentIntentId,
//                             amount: refundAmount,
//                         });

//                         const totalAmount = booking.payment.totalClientPays * 100;
//                         booking.payment.status = refundAmount === totalAmount
//                             ? 'refunded'
//                             : 'partial_refund';
//                         booking.payment.refundAmount = refundAmount / 100;
//                         booking.payment.refundedAt = new Date();

//                         await logPayment({
//                             action: "PAYMENT_REFUNDED",
//                             user: req.user,
//                             req,
//                             taskId: id,
//                             taskTitle: booking.service?.title,
//                             amount: refundAmount,
//                             paymentIntentId,
//                             status: "success",
//                             metadata: {
//                                 reason: "Booking cancelled after capture",
//                                 refundAmount: refundAmount / 100,
//                                 refundedAt: booking.payment.refundedAt,
//                             },
//                         });
//                     }

//                     booking.stripeStatus = 'refunded';
//                 }

//             } catch (stripeErr) {
//                 console.error("Payment cancellation failed:", stripeErr);

//                 await logPayment({
//                     action: "PAYMENT_FAILED",
//                     user: req.user,
//                     req,
//                     taskId: id,
//                     taskTitle: booking.service?.title,
//                     paymentIntentId,
//                     status: "failure",
//                     metadata: {
//                         errorMessage: stripeErr.message,
//                         action: "cancel/refund",
//                     },
//                 });
//             }
//         }

//         booking.status = status;
//         booking.updatedAt = new Date();
//         if (status === "completed") booking.completedAt = new Date();
//         if (status === "cancelled") booking.cancelledAt = new Date();

//         await booking.save();

//         // ✅ Log booking status update
//         await logBooking({
//             action: status === "completed" ? "BOOKING_COMPLETED" : status === "cancelled" ? "BOOKING_CANCELLED" : "BOOKING_UPDATED",
//             user: req.user,
//             req,
//             bookingId: id,
//             serviceTitle: booking.service?.title,
//             taskerId: booking.tasker._id.toString(),
//             taskerName: `${booking.tasker.firstName} ${booking.tasker.lastName}`,
//             status: "success",
//             metadata: {
//                 previousStatus,
//                 newStatus: status,
//                 paymentStatus: booking.payment?.status,
//                 taskerPayout: taskerPayout,
//                 manualPayoutRequired: status === "completed",
//             },
//         });

//         // Notifications
//         const taskerName = `${booking.tasker.firstName} ${booking.tasker.lastName}`;
//         const clientName = `${booking.client.firstName} ${booking.client.lastName}`;

//         if (status === "completed") {
//             try {
//                 await createNotification(
//                     booking.client._id,
//                     "🎉 Booking Completed!",
//                     `${taskerName} has completed your booking for "${booking.service?.title}".`,
//                     "booking-completed",
//                     id
//                 );

//                 // ⭐ CHANGED: Updated notification for manual payment
//                 await createNotification(
//                     booking.tasker._id,
//                     "✅ Booking Marked Complete!",
//                     `You've marked the booking for "${booking.service?.title}" as completed. Your payout of $${taskerPayoutFormatted} will be processed and sent to you shortly.`,
//                     "booking-status-updated",
//                     id
//                 );
//             } catch (notifErr) {
//                 console.error("Notification failed:", notifErr);
//             }
//         }

//         if (status === "cancelled") {
//             try {
//                 await createNotification(
//                     booking.client._id,
//                     "Booking Cancelled",
//                     `${taskerName} has cancelled your booking for "${booking.service?.title}". Payment hold has been released.`,
//                     "booking-cancelled",
//                     id
//                 );
//             } catch (notifErr) {
//                 console.error("Notification failed:", notifErr);
//             }
//         }

//         res.status(200).json({
//             message: "Booking updated successfully",
//             booking,
//             paymentInfo: status === "completed" ? {
//                 platformReceives: booking.payment.platformRevenue,
//                 taskerPayout: taskerPayoutFormatted,
//                 manualPayoutRequired: true, // ⭐ NEW
//             } : null
//         });

//     } catch (error) {
//         console.error("Error updating booking:", error);

//         await logBooking({
//             action: "BOOKING_UPDATED",
//             user: req.user,
//             req,
//             bookingId: id,
//             status: "failure",
//             metadata: {
//                 errorMessage: error.message,
//                 errorStack: error.stack?.substring(0, 500),
//             },
//         });

//         res.status(500).json({ message: "Server error" });
//     }
// };

export const updateBookingStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const booking = await BookingTasker.findById(id)
            .populate("tasker", "firstName lastName email")
            .populate("client", "firstName lastName email");

        if (!booking) {
            return res.status(404).json({ message: "Booking not found" });
        }

        // Verify only tasker can update
        if (booking.tasker._id.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        const validStatuses = ["pending", "confirmed", "cancelled", "completed"];
        if (status && !validStatuses.includes(status)) {
            return res.status(400).json({ message: "Invalid status value" });
        }

        const previousStatus = booking.status;
        const paymentIntentId = booking.payment?.paymentIntentId || booking.paymentIntentId;
        const taskerPayout = booking.payment?.taskerPayout || 0;
        const taskerPayoutFormatted = taskerPayout.toFixed(2);

        // Handle payment based on status
        if (status === "completed" && paymentIntentId) {
            try {
                const paymentIntent = await stripe.paymentIntents.capture(paymentIntentId);

                if (paymentIntent.status === 'succeeded') {
                    booking.stripeStatus = 'succeeded';
                    booking.payment.status = 'captured';
                    booking.payment.capturedAt = new Date();

                    console.log("✅ Booking payment captured");

                    // ⭐⭐⭐ ADD EARNINGS TO WALLET ⭐⭐⭐
                    await addEarningToWallet(
                        booking.tasker._id.toString(),
                        taskerPayout,
                        `Booking completed: "${booking.service?.title}"`,
                        'booking',
                        booking._id
                    );

                    console.log(`💰 Added $${taskerPayout} to wallet for tasker ${booking.tasker._id}`);

                    // Update tasker stats (just booking count)
                    await User.findByIdAndUpdate(booking.tasker._id, {
                        $inc: {
                            'stats.bookingsCompleted': 1,
                        }
                    });
                }
            } catch (stripeErr) {
                console.error("Payment capture failed:", stripeErr);
                return res.status(400).json({ message: "Payment capture failed" });
            }
        }

        if (status === "cancelled" && paymentIntentId) {
            try {
                const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

                if (paymentIntent.status === 'requires_capture') {
                    // Just cancel the hold
                    await stripe.paymentIntents.cancel(paymentIntentId);
                    booking.payment.status = 'cancelled';
                    booking.stripeStatus = 'canceled';

                } else if (paymentIntent.status === 'succeeded') {
                    // Need to refund
                    const refundAmount = booking.calculateRefundAmount ?
                        booking.calculateRefundAmount() :
                        Math.round(booking.payment.totalClientPays * 100);

                    if (refundAmount > 0) {
                        await stripe.refunds.create({
                            payment_intent: paymentIntentId,
                            amount: refundAmount,
                        });

                        const totalAmount = Math.round(booking.payment.totalClientPays * 100);
                        booking.payment.status = refundAmount === totalAmount ? 'refunded' : 'partial_refund';
                        booking.payment.refundAmount = refundAmount / 100;
                        booking.payment.refundedAt = new Date();
                    }

                    booking.stripeStatus = 'refunded';
                }

            } catch (stripeErr) {
                console.error("Payment cancellation failed:", stripeErr);
            }
        }

        // Update booking status and timestamps
        booking.status = status;
        booking.updatedAt = new Date();
        if (status === "completed") booking.completedAt = new Date();
        if (status === "cancelled") booking.cancelledAt = new Date();

        await booking.save();

        // Send notifications
        const taskerName = `${booking.tasker.firstName} ${booking.tasker.lastName}`;
        const clientName = `${booking.client.firstName} ${booking.client.lastName}`;

        if (status === "completed") {
            try {
                await createNotification(
                    booking.client._id,
                    "🎉 Booking Completed!",
                    `${taskerName} has completed your booking for "${booking.service?.title}".`,
                    "booking-completed",
                    id
                );

                await createNotification(
                    booking.tasker._id,
                    "💰 Payment Added to Wallet!",
                    `Booking completed! $${taskerPayoutFormatted} has been added to your wallet.`,
                    "earnings-update",
                    id
                );
            } catch (notifErr) {
                console.error("Notification failed:", notifErr);
            }
        }

        if (status === "cancelled") {
            try {
                await createNotification(
                    booking.client._id,
                    "Booking Cancelled",
                    `${taskerName} has cancelled the booking for "${booking.service?.title}". Payment hold has been released.`,
                    "booking-cancelled",
                    id
                );
            } catch (notifErr) {
                console.error("Notification failed:", notifErr);
            }
        }

        res.status(200).json({
            message: "Booking updated successfully",
            booking,
            paymentInfo: status === "completed" ? {
                taskerPayout: taskerPayoutFormatted,
                walletUpdated: true,
            } : null
        });

    } catch (error) {
        console.error("Error updating booking:", error);
        res.status(500).json({ message: "Server error" });
    }
};


const deleteBooking = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid booking ID" });
        }

        const booking = await BookingTasker.findById(id)
            .populate("tasker", "firstName lastName email")
            .populate("client", "firstName lastName email");

        if (!booking) {
            return res.status(404).json({ message: "Booking not found" });
        }

        // Ensure the authenticated user is authorized (client or tasker)
        const userId = req.user.id || req.user._id.toString();
        const isClient = booking.client._id.toString() === userId;
        const isTasker = booking.tasker._id.toString() === userId;

        console.log(isClient)
        console.log(isTasker)

        // if (!isClient && !isTasker) {
        //     return res.status(403).json({ message: "Unauthorized to delete this booking" });
        // }

        // Store booking details before deletion for notifications
        const bookingService = booking.service;
        const bookingDate = booking.date;
        const bookingTaskerId = booking.tasker._id;
        const bookingClientId = booking.client._id;
        const taskerName = `${booking.tasker.firstName} ${booking.tasker.lastName}`;
        const clientName = `${booking.client.firstName} ${booking.client.lastName}`;

        // FIX: Cancel payment if exists before deleting
        if (booking.paymentIntentId) {
            try {
                const paymentIntent = await stripe.paymentIntents.retrieve(booking.paymentIntentId);

                // Only cancel if it's in a cancellable state
                if (['requires_payment_method', 'requires_confirmation', 'requires_action', 'processing'].includes(paymentIntent.status)) {
                    await stripe.paymentIntents.cancel(booking.paymentIntentId);
                    console.log("✅ Payment intent canceled for deleted booking");
                } else if (paymentIntent.status === 'succeeded') {
                    // If already paid, you might want to create a refund
                    console.log("⚠️ Booking was paid - consider refund process");
                    // Uncomment below to auto-refund:
                    // await stripe.refunds.create({ payment_intent: booking.paymentIntentId });
                    // console.log("✅ Refund created for deleted booking");
                }
            } catch (stripeErr) {
                console.error("❌ Failed to handle payment on deletion:", stripeErr);
                // Continue with deletion even if stripe fails
            }
        }

        // Delete the booking
        await BookingTasker.findByIdAndDelete(id);

        // FIX: Get deleter details from database
        const deleter = await User.findById(userId).select("firstName lastName");
        const deleterName = deleter
            ? `${deleter.firstName} ${deleter.lastName}`
            : "Someone";

        // Determine who should be notified (the other party)
        const otherPartyId = isClient ? bookingTaskerId : bookingClientId;
        const otherPartyType = isClient ? "Tasker" : "Client";

        // Format date for notifications
        const formattedDate = bookingDate.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        // Create notification for the other party
        try {
            // Debug: Log notification details
            console.log("Creating booking deletion notification:", {
                recipientId: otherPartyId,
                deleterName,
                serviceTitle: bookingService?.title,
                formattedDate,
                isClient
            });

            const notificationTitle = "❌ Booking Cancelled";
            const notificationMessage = `${deleterName} has cancelled the booking for "${bookingService?.title || 'Service'}" that was scheduled for ${formattedDate}.${booking.paymentIntentId ? ' Any payment will be refunded.' : ''}`;

            await createNotification(
                otherPartyId,
                notificationTitle,
                notificationMessage,
                "booking-deleted",
                id
            );
            console.log("✅ Notification created for other party - booking deleted");

        } catch (notifErr) {
            console.error("❌ Failed to create notification (non-blocking):", notifErr);
        }

        // Send confirmation notification to the deleter
        try {
            const otherPersonName = isClient ? taskerName : clientName;

            await createNotification(
                userId,
                "Booking Deletion Confirmed",
                `Your booking for "${bookingService?.title || 'Service'}" with ${otherPersonName} on ${formattedDate} has been cancelled successfully.${booking.paymentIntentId ? ' Any payment will be refunded.' : ''}`,
                "booking-delete-confirmed",
                id
            );
            console.log("✅ Confirmation notification sent to deleter");

        } catch (notifErr) {
            console.error("❌ Failed to create confirmation notification (non-blocking):", notifErr);
        }

        res.status(200).json({ message: "Booking deleted successfully" });
    } catch (error) {
        console.error("Error deleting booking:", error);
        res.status(500).json({ message: "Server error" });
    }
};



const createRequestQuote = async (req, res) => {
    const { taskerId, taskTitle, taskDescription, location, budget, preferredDateTime, urgency } = req.body;
    const clientId = req.user?.id;

    try {
        console.log("=== CREATE QUOTE REQUEST ===");
        console.log("Client ID:", clientId);
        console.log("Request Body:", JSON.stringify(req.body, null, 2));

        // ==================== VALIDATIONS ====================

        if (!clientId) {
            await logQuoteRequest({
                action: "QUOTE_REQUESTED",
                user: null,
                req,
                taskTitle,
                taskerId,
                status: "failure",
                metadata: {
                    errorMessage: "Unauthorized: User not authenticated",
                    errorCode: "UNAUTHORIZED",
                },
            });

            return res.status(401).json({ message: "Unauthorized: User not authenticated" });
        }

        if (!mongoose.Types.ObjectId.isValid(taskerId) || !mongoose.Types.ObjectId.isValid(clientId)) {
            await logQuoteRequest({
                action: "QUOTE_REQUESTED",
                user: req.user,
                req,
                taskTitle,
                taskerId,
                status: "failure",
                metadata: {
                    errorMessage: "Invalid tasker or client ID",
                    errorCode: "INVALID_IDS",
                    providedTaskerId: taskerId,
                    providedClientId: clientId,
                },
            });

            return res.status(400).json({ message: "Invalid tasker or client ID" });
        }

        if (!taskTitle || !taskDescription || !location) {
            await logQuoteRequest({
                action: "QUOTE_REQUESTED",
                user: req.user,
                req,
                taskTitle,
                taskerId,
                status: "failure",
                metadata: {
                    errorMessage: "Task title, description, and location are required",
                    errorCode: "MISSING_FIELDS",
                    providedFields: {
                        hasTaskTitle: !!taskTitle,
                        hasTaskDescription: !!taskDescription,
                        hasLocation: !!location,
                    },
                },
            });

            return res.status(400).json({ message: "Task title, description, and location are required" });
        }

        // ==================== VALIDATE USERS ====================

        const tasker = await User.findById(taskerId);
        if (!tasker || tasker.currentRole !== "tasker") {
            await logQuoteRequest({
                action: "QUOTE_REQUESTED",
                user: req.user,
                req,
                taskTitle,
                taskerId,
                status: "failure",
                metadata: {
                    errorMessage: "Tasker not found or invalid role",
                    errorCode: "INVALID_TASKER",
                    taskerExists: !!tasker,
                    taskerRole: tasker?.currentRole,
                },
            });

            return res.status(400).json({ message: "Tasker not found or invalid role" });
        }

        const client = await User.findById(clientId);
        if (!client || client.currentRole !== "client") {
            await logQuoteRequest({
                action: "QUOTE_REQUESTED",
                user: req.user,
                req,
                taskTitle,
                taskerId,
                taskerName: `${tasker.firstName} ${tasker.lastName}`,
                status: "failure",
                metadata: {
                    errorMessage: "Client not found or invalid role",
                    errorCode: "INVALID_CLIENT",
                },
            });

            return res.status(400).json({ message: "Client not found or invalid role" });
        }

        // ==================== CREATE QUOTE REQUEST ====================

        const requestQuote = new RequestQuote({
            tasker: taskerId,
            client: clientId,
            taskTitle,
            taskDescription,
            location,
            budget: budget || null,
            preferredDateTime: preferredDateTime ? new Date(preferredDateTime) : null,
            urgency: urgency || "Flexible - Whenever works",
            status: "pending",
        });

        await requestQuote.save();
        console.log("✅ Quote request saved:", requestQuote._id);

        const populatedRequestQuote = await RequestQuote.findById(requestQuote._id)
            .populate("tasker", "firstName lastName email phone currentRole")
            .populate("client", "firstName lastName email phone currentRole");

        // Get names for notifications and logging
        const clientName = `${client.firstName} ${client.lastName}`;
        const taskerName = `${tasker.firstName} ${tasker.lastName}`;

        // Format date for display
        const formattedDate = preferredDateTime
            ? new Date(preferredDateTime).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            })
            : "Flexible";

        const formattedBudget = budget ? `$${budget}` : "Negotiable";

        // ✅ Log successful quote request
        await logQuoteRequest({
            action: "QUOTE_REQUESTED",
            user: { ...req.user, ...client.toObject() },
            req,
            quoteId: requestQuote._id.toString(),
            taskerId: tasker._id.toString(),
            taskerName,
            taskTitle,
            budget,
            status: "success",
            metadata: {
                // Quote details
                taskDescription: taskDescription.substring(0, 200),
                location,
                preferredDateTime: preferredDateTime || null,
                formattedDate,
                urgency: urgency || "Flexible",

                // User details
                clientEmail: client.email,
                clientPhone: client.phone,
                taskerEmail: tasker.email,
                taskerRating: tasker.rating,
                taskerReviewCount: tasker.reviewCount,
            },
        });

        // ==================== SEND NOTIFICATIONS ====================

        // Notify tasker
        try {
            console.log("Creating quote request notification for tasker:", {
                taskerId,
                clientName,
                taskTitle,
                location,
                budget: formattedBudget,
            });

            await createNotification(
                taskerId,
                "📝 New Quote Request!",
                `${clientName} is requesting a quote for "${taskTitle}" in ${location}. Budget: ${formattedBudget}, Preferred Date: ${formattedDate}, Urgency: ${urgency || 'Flexible'}. Review and respond!`,
                "quote-request",
                requestQuote._id
            );
            console.log("✅ Notification created for tasker - new quote request");

        } catch (notifErr) {
            console.error("❌ Failed to create tasker notification (non-blocking):", notifErr);
        }

        // Notify client (confirmation)
        try {
            await createNotification(
                clientId,
                "📤 Quote Request Sent",
                `Your quote request for "${taskTitle}" has been sent to ${taskerName}. You'll be notified when they respond. Budget: ${formattedBudget}, Location: ${location}.`,
                "quote-request-sent",
                requestQuote._id
            );
            console.log("✅ Confirmation notification sent to client");

        } catch (notifErr) {
            console.error("❌ Failed to create client notification (non-blocking):", notifErr);
        }

        res.status(201).json({
            success: true,
            message: "Quote request created successfully",
            requestQuote: populatedRequestQuote
        });

    } catch (error) {
        console.error("❌ Error creating quote request:", error);

        // ✅ Log unexpected error
        await logQuoteRequest({
            action: "QUOTE_REQUESTED",
            user: req.user,
            req,
            taskTitle,
            taskerId,
            budget,
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

// ----------------------------------------------------------------

export const getQuotesByTasker = async (req, res) => {
    try {
        const taskerId = req.params.taskerId;
        const userId = req.user?.id;

        console.log(req)

        if (!userId) {
            return res.status(401).json({ message: "Unauthorized: User not authenticated" });
        }

        if (!mongoose.Types.ObjectId.isValid(taskerId)) {
            return res.status(400).json({ message: "Invalid tasker ID" });
        }

        // Verify the authenticated user is the tasker
        if (taskerId !== userId) {
            return res.status(403).json({ message: "Forbidden: You can only view your own quotes" });
        }

        const quotes = await RequestQuote.find({ tasker: taskerId })
            .populate("tasker", "firstName lastName email phone currentRole")
            .populate("client", "firstName lastName email phone currentRole")
            .sort({ createdAt: -1 }); // Sort by most recent

        if (!quotes || quotes.length === 0) {
            return res.status(404).json({ message: "No quotes found for this tasker" });
        }

        res.status(200).json({ message: "Quotes retrieved successfully", quotes });
    } catch (error) {
        console.error("Error fetching quotes:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// Update a quote request
// export const updateQuoteRequest = async (req, res) => {
//     try {
//         const quoteId = req.params.quoteId;
//         const userId = req.user?.id;
//         const { taskTitle, taskDescription, location, budget, preferredDateTime, urgency, status } = req.body;

//         if (!userId) {
//             return res.status(401).json({ message: "Unauthorized: User not authenticated" });
//         }

//         if (!mongoose.Types.ObjectId.isValid(quoteId)) {
//             return res.status(400).json({ message: "Invalid quote ID" });
//         }

//         const quote = await RequestQuote.findById(quoteId);
//         if (!quote) {
//             return res.status(404).json({ message: "Quote request not found" });
//         }

//         // Allow client to update all fields, tasker to update only status
//         const isClient = quote.client.toString() === userId;
//         const isTasker = quote.tasker.toString() === userId;

//         if (!isClient && !isTasker) {
//             return res.status(403).json({ message: "Forbidden: You can only update your own quotes" });
//         }

//         // Clients can update all fields, taskers can only update status
//         if (isClient) {
//             if (taskTitle) quote.taskTitle = taskTitle;
//             if (taskDescription) quote.taskDescription = taskDescription;
//             if (location) quote.location = location;
//             if (budget !== undefined) quote.budget = budget;
//             if (preferredDateTime) quote.preferredDateTime = new Date(preferredDateTime);
//             if (urgency) quote.urgency = urgency;
//         }

//         if (status) {
//             // Validate status
//             const validStatuses = ["pending", "accepted", "rejected", "completed"];
//             if (!validStatuses.includes(status)) {
//                 return res.status(400).json({ message: "Invalid status value" });
//             }
//             quote.status = status;
//         }

//         await quote.save();

//         const populatedQuote = await RequestQuote.findById(quoteId)
//             .populate("tasker", "firstName lastName email phone currentRole")
//             .populate("client", "firstName lastName email phone currentRole");

//         // Create notification for the other party (non-blocking)
//         try {
//             const updaterRole = req.user.currentRole; // Assume req.user has role from middleware
//             const otherPartyId = updaterRole === "client" ? quote.tasker : quote.client;
//             const otherPartyName = updaterRole === "client" ? "Tasker" : "Client";
//             const updaterName = req.user.firstName + " " + req.user.lastName;
//             let title = "Quote Request Updated";
//             let message = `${otherPartyName} "${updaterName}" updated the quote request "${quote.taskTitle}".`;
//             if (status) {
//                 message += ` Status changed to "${status}".`;
//             } else if (taskTitle || taskDescription || location || budget !== undefined || preferredDateTime || urgency) {
//                 message += " Details have been modified.";
//             }
//             await createNotification(
//                 otherPartyId,
//                 title,
//                 message,
//                 "quote-updated",
//                 quoteId // Link to quote request
//             );
//             console.log("Notification created for quote update"); // Debug
//         } catch (notifErr) {
//             console.error("Failed to create notification (non-blocking):", notifErr); // Log but don't crash
//         }

//         res.status(200).json({ message: "Quote request updated successfully", requestQuote: populatedQuote });
//     } catch (error) {
//         console.error("Error updating quote request:", error);
//         res.status(500).json({ message: "Server error" });
//     }
// };


export const updateQuoteRequest = async (req, res) => {
    try {
        const quoteId = req.params.quoteId;
        const userId = req.user?.id;
        const { taskTitle, taskDescription, location, budget, preferredDateTime, urgency, status } = req.body;

        if (!userId) {
            return res.status(401).json({ message: "Unauthorized: User not authenticated" });
        }

        if (!mongoose.Types.ObjectId.isValid(quoteId)) {
            return res.status(400).json({ message: "Invalid quote ID" });
        }

        const quote = await RequestQuote.findById(quoteId)
            .populate("tasker", "firstName lastName email")
            .populate("client", "firstName lastName email");

        if (!quote) {
            return res.status(404).json({ message: "Quote request not found" });
        }

        // Allow client to update all fields, tasker to update only status
        const isClient = quote.client._id.toString() === userId;
        const isTasker = quote.tasker._id.toString() === userId;

        if (!isClient && !isTasker) {
            return res.status(403).json({ message: "Forbidden: You can only update your own quotes" });
        }

        // Track previous values for notification
        const previousStatus = quote.status;
        const previousTaskTitle = quote.taskTitle;

        // Clients can update all fields, taskers can only update status
        if (isClient) {
            if (taskTitle) quote.taskTitle = taskTitle;
            if (taskDescription) quote.taskDescription = taskDescription;
            if (location) quote.location = location;
            if (budget !== undefined) quote.budget = budget;
            if (preferredDateTime) quote.preferredDateTime = new Date(preferredDateTime);
            if (urgency) quote.urgency = urgency;
        }

        if (status) {
            // Validate status
            const validStatuses = ["pending", "accepted", "rejected", "completed"];
            if (!validStatuses.includes(status)) {
                return res.status(400).json({ message: "Invalid status value" });
            }
            quote.status = status;
        }

        await quote.save();

        const populatedQuote = await RequestQuote.findById(quoteId)
            .populate("tasker", "firstName lastName email phone currentRole")
            .populate("client", "firstName lastName email phone currentRole");

        // FIX: Get updater details from database
        const updater = await User.findById(userId).select("firstName lastName");
        const updaterName = updater
            ? `${updater.firstName} ${updater.lastName}`
            : "Someone";

        // Get other party details
        const otherPartyId = isClient ? quote.tasker._id : quote.client._id;
        const otherPartyName = isClient
            ? `${quote.tasker.firstName} ${quote.tasker.lastName}`
            : `${quote.client.firstName} ${quote.client.lastName}`;

        // Build notification content based on what changed
        let notificationTitle = "Quote Request Updated";
        let notificationMessage = "";
        let notificationType = "quote-updated";

        if (status && status !== previousStatus) {
            // Status change notifications
            switch (status) {
                case "accepted":
                    notificationTitle = "✅ Quote Request Accepted!";
                    notificationMessage = `${updaterName} has accepted the quote request for "${quote.taskTitle}". You can now proceed with the service!`;
                    notificationType = "quote-accepted";
                    break;
                case "rejected":
                    notificationTitle = "❌ Quote Request Declined";
                    notificationMessage = `${updaterName} has declined the quote request for "${quote.taskTitle}". You may want to request a quote from another tasker.`;
                    notificationType = "quote-rejected";
                    break;
                case "completed":
                    notificationTitle = "🎉 Quote Request Completed!";
                    notificationMessage = `The quote request for "${quote.taskTitle}" has been marked as completed by ${updaterName}.`;
                    notificationType = "quote-completed";
                    break;
                case "pending":
                    notificationTitle = "⏳ Quote Request Status Changed";
                    notificationMessage = `${updaterName} has changed the status of "${quote.taskTitle}" back to pending.`;
                    notificationType = "quote-pending";
                    break;
                default:
                    notificationMessage = `${updaterName} updated the status of "${quote.taskTitle}" to "${status}".`;
            }
        } else if (isClient) {
            // Client updated details
            let changes = [];
            if (taskTitle && taskTitle !== previousTaskTitle) changes.push(`title to "${taskTitle}"`);
            if (taskDescription) changes.push("description");
            if (location) changes.push(`location to "${location}"`);
            if (budget !== undefined) changes.push(`budget to $${budget}`);
            if (preferredDateTime) changes.push("preferred date/time");
            if (urgency) changes.push(`urgency to "${urgency}"`);

            if (changes.length > 0) {
                notificationTitle = "📝 Quote Request Details Updated";
                notificationMessage = `${updaterName} has updated the quote request for "${quote.taskTitle}". Changes: ${changes.join(', ')}.`;
                notificationType = "quote-details-updated";
            } else {
                notificationMessage = `${updaterName} made updates to the quote request for "${quote.taskTitle}".`;
            }
        }

        // Create notification for the other party
        try {
            // Debug: Log notification details
            console.log("Creating quote update notification:", {
                recipientId: otherPartyId,
                updaterName,
                status,
                previousStatus,
                isClient,
                notificationType
            });

            await createNotification(
                otherPartyId,
                notificationTitle,
                notificationMessage,
                notificationType,
                quoteId
            );
            console.log("✅ Notification created for other party - quote update");

        } catch (notifErr) {
            console.error("❌ Failed to create notification (non-blocking):", notifErr);
        }

        // Send confirmation notification to the updater
        try {
            let confirmationTitle = "Quote Update Confirmed";
            let confirmationMessage = `Your update to the quote request for "${quote.taskTitle}" has been saved.`;

            if (status === "accepted") {
                confirmationTitle = "Quote Acceptance Confirmed";
                confirmationMessage = `You have accepted the quote request for "${quote.taskTitle}" from ${otherPartyName}.`;
            } else if (status === "rejected") {
                confirmationTitle = "Quote Rejection Confirmed";
                confirmationMessage = `You have declined the quote request for "${quote.taskTitle}" from ${otherPartyName}.`;
            } else if (status === "completed") {
                confirmationTitle = "Quote Marked as Completed";
                confirmationMessage = `You have marked the quote request for "${quote.taskTitle}" as completed.`;
            }

            await createNotification(
                userId,
                confirmationTitle,
                confirmationMessage,
                "quote-update-confirmed",
                quoteId
            );
            console.log("✅ Confirmation notification sent to updater");

        } catch (notifErr) {
            console.error("❌ Failed to create confirmation notification (non-blocking):", notifErr);
        }

        // If completed, prompt client for review
        if (status === "completed") {
            try {
                const clientId = quote.client._id;
                const taskerFullName = `${quote.tasker.firstName} ${quote.tasker.lastName}`;

                await createNotification(
                    clientId,
                    "⭐ Leave a Review",
                    `How was your experience with ${taskerFullName} for "${quote.taskTitle}"? Leave a review to help others find great taskers!`,
                    "review-prompt",
                    quoteId
                );
                console.log("✅ Review prompt notification sent to client");

            } catch (notifErr) {
                console.error("❌ Failed to create review prompt notification (non-blocking):", notifErr);
            }
        }

        res.status(200).json({ message: "Quote request updated successfully", requestQuote: populatedQuote });
    } catch (error) {
        console.error("Error updating quote request:", error);
        res.status(500).json({ message: "Server error" });
    }
};


// ---------------------------------------------------------------
// Get All Request Quotes
const getAllRequestQuotes = async (req, res) => {
    try {
        const requestQuotes = await RequestQuote.find()
            .populate("tasker", "firstName lastName email phone currentRole")
            .populate("client", "firstName lastName email phone currentRole");
        res.status(200).json(requestQuotes);
    } catch (error) {
        console.error("Error fetching request quotes:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// Controller function
const getRequestQuotesByClientId = async (req, res) => {
    try {
        const { clientId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(clientId)) {
            return res.status(400).json({ message: "Invalid client ID" });
        }

        const quotes = await RequestQuote.find({ client: clientId })
            .populate("tasker", "firstName lastName email phone currentRole profilePicture")
            .populate("client", "firstName lastName email phone currentRole ");

        res.status(200).json(quotes);
    } catch (error) {
        console.error("Error fetching request quotes by client:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// Get tasks by tasker ID and optional status
export const getTasksByTaskerIdAndStatus = async (req, res) => {
    try {
        const { id } = req.params; // Tasker ID
        const { status } = req.query; // Optional status (e.g., "pending")

        console.log(id, status)

        // Validate tasker ID
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid tasker ID' });
        }

        // Build query
        const query = { tasker: id }; // Fixed: Use tasker as ObjectId reference
        if (status) {
            if (!['pending', 'responded', 'accepted', 'declined'].includes(status)) {
                return res.status(400).json({ message: 'Invalid status value' });
            }
            query.status = status;
        }

        // Fetch request quotes with populated tasker and client
        const tasks = await RequestQuote.find(query)
            .populate('tasker', 'firstName lastName email phone role')
            .populate('client', 'firstName lastName email phone role')
            .select('_id taskTitle taskDescription status tasker client budget location preferredDateTime urgency createdAt updatedAt');

        res.status(200).json(tasks);
    } catch (error) {
        console.error('Error fetching request quotes:', error);
        res.status(500).json({ message: 'Server error while fetching request quotes', error: error.message });
    }
};


// controllers/requestQuoteController.js

// export const updateQuoteStatus = async (req, res) => {
//     try {
//         const { taskId } = req.params;
//         const { status } = req.body;
//         const taskerId = req.user.id;

//         const task = await RequestQuote.findById(taskId)
//             .populate("tasker", "firstName lastName email")
//             .populate("client", "firstName lastName email");

//         if (!task) {
//             return res.status(404).json({ message: 'Task not found' });
//         }

//         if (task.tasker._id.toString() !== taskerId) {
//             return res.status(403).json({ message: 'Unauthorized' });
//         }

//         const paymentIntentId = task.payment?.paymentIntentId;
//         const taskerPayout = task.payment?.taskerPayout || 0;
//         const taskerPayoutFormatted = (taskerPayout / 100).toFixed(2);

//         // Handle completed status - capture payment
//         if (status === 'completed' && paymentIntentId) {
//             try {
//                 const paymentIntent = await stripe.paymentIntents.capture(paymentIntentId);

//                 if (paymentIntent.status === 'succeeded') {
//                     task.payment.status = 'captured';
//                     task.payment.capturedAt = new Date();

//                     // Update tasker earnings
//                     await User.findByIdAndUpdate(taskerId, {
//                         $inc: {
//                             'stats.tasksCompleted': 1,
//                             'stats.totalEarnings': taskerPayout,
//                         }
//                     });

//                     console.log("✅ Quote payment captured:", taskerPayoutFormatted);
//                 }
//             } catch (stripeErr) {
//                 console.error("Payment capture failed:", stripeErr);
//                 return res.status(400).json({ message: "Payment capture failed" });
//             }
//         }

//         // Handle rejected - cancel payment hold
//         if (status === 'rejected' && paymentIntentId) {
//             try {
//                 await stripe.paymentIntents.cancel(paymentIntentId);
//                 task.payment.status = 'cancelled';
//             } catch (stripeErr) {
//                 console.error("Payment cancellation failed:", stripeErr);
//             }
//         }

//         task.status = status;
//         task.updatedAt = new Date();
//         if (status === 'completed') task.completedAt = new Date();

//         await task.save();

//         // Notifications
//         const taskerName = `${task.tasker.firstName} ${task.tasker.lastName}`;
//         const clientName = `${task.client.firstName} ${task.client.lastName}`;

//         if (status === 'completed') {
//             try {
//                 await createNotification(
//                     task.client._id,
//                     "🎉 Quote Request Completed!",
//                     `${taskerName} has completed your request for "${task.taskTitle}".`,
//                     "quote-completed",
//                     taskId
//                 );

//                 await createNotification(
//                     taskerId,
//                     "💰 Payment Released!",
//                     `Work completed! $${taskerPayoutFormatted} has been released and will be deposited to your bank.`,
//                     "quote-work-completed",
//                     taskId
//                 );
//             } catch (notifErr) {
//                 console.error("Notification failed:", notifErr);
//             }
//         }

//         res.status(200).json({
//             message: 'Status updated successfully',
//             task,
//             paymentInfo: status === 'completed' ? {
//                 taskerPayout: taskerPayoutFormatted,
//             } : null
//         });

//     } catch (error) {
//         console.error('Error updating status:', error);
//         res.status(500).json({ message: 'Server error' });
//     }
// };


// export const updateQuoteStatus = async (req, res) => {
//     try {
//         const { taskId } = req.params;
//         const { status } = req.body;
//         const taskerId = req.user.id;

//         const task = await RequestQuote.findById(taskId)
//             .populate("tasker", "firstName lastName email")
//             .populate("client", "firstName lastName email");

//         if (!task) {
//             return res.status(404).json({ message: 'Task not found' });
//         }

//         if (task.tasker._id.toString() !== taskerId) {
//             return res.status(403).json({ message: 'Unauthorized' });
//         }

//         const paymentIntentId = task.payment?.paymentIntentId;
//         const taskerPayout = task.payment?.taskerPayout || 0;
//         const taskerPayoutCents = task.payment?.taskerPayoutCents || Math.round(taskerPayout * 100);
//         const taskerPayoutFormatted = taskerPayout.toFixed(2);
//         const platformRevenue = task.payment?.platformRevenueCents || task.payment?.totalClientPaysCents || 0;

//         // Handle completed status - capture payment TO PLATFORM
//         if (status === 'completed' && paymentIntentId) {
//             try {
//                 // ⭐ CHANGED: Capture to platform account (no automatic split)
//                 const paymentIntent = await stripe.paymentIntents.capture(paymentIntentId);

//                 if (paymentIntent.status === 'succeeded') {
//                     task.payment.status = 'captured';
//                     task.payment.capturedAt = new Date();

//                     console.log("✅ Quote payment captured to platform:");
//                     console.log("  Platform Receives:", (platformRevenue / 100).toFixed(2));
//                     console.log("  Tasker Payout (Manual):", taskerPayoutFormatted);

//                     // ⭐ CHANGED: Don't update earnings until manual payment
//                     // Just increment tasks completed
//                     await User.findByIdAndUpdate(taskerId, {
//                         $inc: {
//                             'stats.tasksCompleted': 1,
//                             // 'stats.totalEarnings': taskerPayoutCents, // ⭐ REMOVED
//                         }
//                     });

//                     console.log("✅ Quote payment captured - manual payout required");
//                 }
//             } catch (stripeErr) {
//                 console.error("Payment capture failed:", stripeErr);
//                 return res.status(400).json({ message: "Payment capture failed" });
//             }
//         }

//         // Handle rejected - cancel payment hold
//         if (status === 'rejected' && paymentIntentId) {
//             try {
//                 await stripe.paymentIntents.cancel(paymentIntentId);
//                 task.payment.status = 'cancelled';
//                 task.payment.cancelledAt = new Date();
//                 console.log("✅ Quote payment hold cancelled");
//             } catch (stripeErr) {
//                 console.error("Payment cancellation failed:", stripeErr);
//             }
//         }

//         task.status = status;
//         task.updatedAt = new Date();
//         if (status === 'completed') task.completedAt = new Date();

//         await task.save();

//         // Notifications - UPDATED FOR MANUAL PAYMENT
//         const taskerName = `${task.tasker.firstName} ${task.tasker.lastName}`;
//         const clientName = `${task.client.firstName} ${task.client.lastName}`;

//         if (status === 'completed') {
//             try {
//                 await createNotification(
//                     task.client._id,
//                     "🎉 Quote Request Completed!",
//                     `${taskerName} has completed your request for "${task.taskTitle}".`,
//                     "quote-completed",
//                     taskId
//                 );

//                 // ⭐ CHANGED: Updated notification for manual payment
//                 await createNotification(
//                     taskerId,
//                     "✅ Work Marked Complete!",
//                     `You've marked "${task.taskTitle}" as completed. Your payout of $${taskerPayoutFormatted} will be processed and sent to you shortly.`,
//                     "quote-work-completed",
//                     taskId
//                 );
//             } catch (notifErr) {
//                 console.error("Notification failed:", notifErr);
//             }
//         }

//         if (status === 'rejected') {
//             try {
//                 await createNotification(
//                     task.client._id,
//                     "Quote Request Rejected",
//                     `${taskerName} has rejected the quote request for "${task.taskTitle}". Payment hold has been released.`,
//                     "quote-rejected",
//                     taskId
//                 );
//             } catch (notifErr) {
//                 console.error("Notification failed:", notifErr);
//             }
//         }

//         res.status(200).json({
//             message: 'Status updated successfully',
//             task,
//             paymentInfo: status === 'completed' ? {
//                 platformReceives: (platformRevenue / 100).toFixed(2),
//                 taskerPayout: taskerPayoutFormatted,
//                 manualPayoutRequired: true, // ⭐ NEW
//             } : null
//         });

//     } catch (error) {
//         console.error('Error updating status:', error);
//         res.status(500).json({ message: 'Server error' });
//     }
// };


export const updateQuoteStatus = async (req, res) => {
    try {
        const { taskId } = req.params;
        const { status } = req.body;
        const taskerId = req.user.id;

        const task = await RequestQuote.findById(taskId)
            .populate("tasker", "firstName lastName email")
            .populate("client", "firstName lastName email");

        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }

        if (task.tasker._id.toString() !== taskerId) {
            return res.status(403).json({ message: 'Unauthorized' });
        }

        const paymentIntentId = task.payment?.paymentIntentId;
        const taskerPayout = task.payment?.taskerPayout || 0;
        const taskerPayoutFormatted = taskerPayout.toFixed(2);

        // Handle completed status - capture payment
        if (status === 'completed' && paymentIntentId) {
            try {
                const paymentIntent = await stripe.paymentIntents.capture(paymentIntentId);

                if (paymentIntent.status === 'succeeded') {
                    task.payment.status = 'captured';
                    task.payment.capturedAt = new Date();

                    console.log("✅ Quote payment captured");

                    // ⭐⭐⭐ ADD EARNINGS TO WALLET ⭐⭐⭐
                    await addEarningToWallet(
                        taskerId.toString(),
                        taskerPayout,
                        `Quote completed: "${task.taskTitle}"`,
                        'quote',
                        task._id
                    );

                    console.log(`💰 Added $${taskerPayout} to wallet for tasker ${taskerId}`);

                    // Update tasker stats (just task count)
                    await User.findByIdAndUpdate(taskerId, {
                        $inc: {
                            'stats.tasksCompleted': 1,
                        }
                    });
                }
            } catch (stripeErr) {
                console.error("Payment capture failed:", stripeErr);
                return res.status(400).json({ message: "Payment capture failed" });
            }
        }

        // Handle rejected - cancel payment hold
        if (status === 'rejected' && paymentIntentId) {
            try {
                await stripe.paymentIntents.cancel(paymentIntentId);
                task.payment.status = 'cancelled';
                task.payment.cancelledAt = new Date();
            } catch (stripeErr) {
                console.error("Payment cancellation failed:", stripeErr);
            }
        }

        // Update task
        task.status = status;
        task.updatedAt = new Date();
        if (status === 'completed') task.completedAt = new Date();

        await task.save();

        // Send notifications
        const taskerName = `${task.tasker.firstName} ${task.tasker.lastName}`;
        const clientName = `${task.client.firstName} ${task.client.lastName}`;

        if (status === 'completed') {
            try {
                await createNotification(
                    task.client._id,
                    "🎉 Quote Request Completed!",
                    `${taskerName} has completed your request for "${task.taskTitle}".`,
                    "quote-completed",
                    taskId
                );

                await createNotification(
                    taskerId,
                    "💰 Payment Added to Wallet!",
                    `Work completed! $${taskerPayoutFormatted} has been added to your wallet.`,
                    "quote-work-completed",
                    taskId
                );
            } catch (notifErr) {
                console.error("Notification failed:", notifErr);
            }
        }

        if (status === 'rejected') {
            try {
                await createNotification(
                    task.client._id,
                    "Quote Request Rejected",
                    `${taskerName} has rejected the quote request for "${task.taskTitle}". Payment hold has been released.`,
                    "quote-rejected",
                    taskId
                );
            } catch (notifErr) {
                console.error("Notification failed:", notifErr);
            }
        }

        res.status(200).json({
            message: 'Status updated successfully',
            task,
            paymentInfo: status === 'completed' ? {
                taskerPayout: taskerPayoutFormatted,
                walletUpdated: true,
            } : null
        });

    } catch (error) {
        console.error('Error updating status:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const updateRequestQuote = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, taskTitle, taskDescription, location, budget, preferredDateTime, urgency } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid request quote ID" });
        }

        const requestQuote = await RequestQuote.findById(id)
            .populate("tasker", "firstName lastName email")
            .populate("client", "firstName lastName email");

        if (!requestQuote) {
            return res.status(404).json({ message: "Request quote not found" });
        }

        // Allow client to update all fields, tasker to update only status
        const isClient = requestQuote.client._id.toString() === req.user.id;
        const isTasker = requestQuote.tasker._id.toString() === req.user.id;

        if (!isClient && !isTasker) {
            return res.status(403).json({ message: "Forbidden: You can only update your own quotes" });
        }

        // Track previous values for notification
        const previousStatus = requestQuote.status;
        const previousTaskTitle = requestQuote.taskTitle;
        const previousBudget = requestQuote.budget;
        const previousLocation = requestQuote.location;

        // Clients can update all fields, taskers can only update status
        if (isClient) {
            if (taskTitle) requestQuote.taskTitle = taskTitle;
            if (taskDescription) requestQuote.taskDescription = taskDescription;
            if (location) requestQuote.location = location;
            if (budget !== undefined) requestQuote.budget = budget;
            if (preferredDateTime) requestQuote.preferredDateTime = new Date(preferredDateTime);
            if (urgency) requestQuote.urgency = urgency;
        }

        if (status) {
            // Validate status
            const validStatuses = ["pending", "accepted", "rejected", "completed"];
            if (!validStatuses.includes(status)) {
                return res.status(400).json({ message: "Invalid status value" });
            }
            requestQuote.status = status;
        }

        await requestQuote.save();

        const populatedRequestQuote = await RequestQuote.findById(id)
            .populate("tasker", "firstName lastName email phone role")
            .populate("client", "firstName lastName email phone role");

        // FIX: Get updater details from database
        const updater = await User.findById(req.user.id).select("firstName lastName");
        const updaterName = updater
            ? `${updater.firstName} ${updater.lastName}`
            : "Someone";

        // Get other party details
        const otherPartyId = isClient ? requestQuote.tasker._id : requestQuote.client._id;
        const otherPartyName = isClient
            ? `${requestQuote.tasker.firstName} ${requestQuote.tasker.lastName}`
            : `${requestQuote.client.firstName} ${requestQuote.client.lastName}`;

        // Build notification content based on what changed
        let notificationTitle = "Quote Request Updated";
        let notificationMessage = "";
        let notificationType = "quote-updated";

        // Track changes for detailed notification
        let changes = [];

        if (status && status !== previousStatus) {
            // Status change notifications
            switch (status) {
                case "accepted":
                    notificationTitle = "✅ Quote Request Accepted!";
                    notificationMessage = `${updaterName} has accepted the quote request for "${requestQuote.taskTitle}". You can now proceed with the service!`;
                    notificationType = "quote-accepted";
                    break;
                case "rejected":
                    notificationTitle = "❌ Quote Request Declined";
                    notificationMessage = `${updaterName} has declined the quote request for "${requestQuote.taskTitle}".`;
                    notificationType = "quote-rejected";
                    break;
                case "completed":
                    notificationTitle = "🎉 Quote Request Completed!";
                    notificationMessage = `The quote request for "${requestQuote.taskTitle}" has been marked as completed by ${updaterName}.`;
                    notificationType = "quote-completed";
                    break;
                case "pending":
                    notificationTitle = "⏳ Quote Request Status Changed";
                    notificationMessage = `${updaterName} has changed the status of "${requestQuote.taskTitle}" back to pending.`;
                    notificationType = "quote-pending";
                    break;
                default:
                    notificationMessage = `${updaterName} updated the status of "${requestQuote.taskTitle}" to "${status}".`;
            }
        } else if (isClient) {
            // Client updated details - track specific changes
            if (taskTitle && taskTitle !== previousTaskTitle) changes.push(`title to "${taskTitle}"`);
            if (taskDescription) changes.push("description");
            if (location && location !== previousLocation) changes.push(`location to "${location}"`);
            if (budget !== undefined && budget !== previousBudget) changes.push(`budget to $${budget}`);
            if (preferredDateTime) changes.push("preferred date/time");
            if (urgency) changes.push(`urgency to "${urgency}"`);

            if (changes.length > 0) {
                notificationTitle = "📝 Quote Request Details Updated";
                notificationMessage = `${updaterName} has updated the quote request for "${requestQuote.taskTitle}". Changes: ${changes.join(', ')}.`;
                notificationType = "quote-details-updated";
            } else {
                notificationMessage = `${updaterName} made updates to the quote request for "${requestQuote.taskTitle}".`;
            }
        }

        // Create notification for the other party
        try {
            // Debug: Log notification details
            console.log("Creating quote update notification:", {
                recipientId: otherPartyId,
                updaterName,
                status,
                previousStatus,
                isClient,
                changes,
                notificationType
            });

            await createNotification(
                otherPartyId,
                notificationTitle,
                notificationMessage,
                notificationType,
                id
            );
            console.log("✅ Notification created for other party - quote update");

        } catch (notifErr) {
            console.error("❌ Failed to create notification (non-blocking):", notifErr);
        }

        // Send confirmation notification to the updater
        try {
            let confirmationTitle = "Quote Update Confirmed";
            let confirmationMessage = `Your update to the quote request for "${requestQuote.taskTitle}" has been saved.`;

            if (status === "accepted") {
                confirmationTitle = "Quote Acceptance Confirmed";
                confirmationMessage = `You have accepted the quote request for "${requestQuote.taskTitle}" from ${otherPartyName}.`;
            } else if (status === "rejected") {
                confirmationTitle = "Quote Rejection Confirmed";
                confirmationMessage = `You have declined the quote request for "${requestQuote.taskTitle}" from ${otherPartyName}.`;
            } else if (status === "completed") {
                confirmationTitle = "Quote Marked as Completed";
                confirmationMessage = `You have marked the quote request for "${requestQuote.taskTitle}" as completed.`;
            } else if (changes.length > 0) {
                confirmationMessage = `Your changes to "${requestQuote.taskTitle}" have been saved: ${changes.join(', ')}.`;
            }

            await createNotification(
                req.user.id,
                confirmationTitle,
                confirmationMessage,
                "quote-update-confirmed",
                id
            );
            console.log("✅ Confirmation notification sent to updater");

        } catch (notifErr) {
            console.error("❌ Failed to create confirmation notification (non-blocking):", notifErr);
        }

        // If completed, prompt client for review
        if (status === "completed") {
            try {
                const clientId = requestQuote.client._id;
                const taskerFullName = `${requestQuote.tasker.firstName} ${requestQuote.tasker.lastName}`;

                await createNotification(
                    clientId,
                    "⭐ Leave a Review",
                    `How was your experience with ${taskerFullName} for "${requestQuote.taskTitle}"? Leave a review to help others find great taskers!`,
                    "review-prompt",
                    id
                );
                console.log("✅ Review prompt notification sent to client");

            } catch (notifErr) {
                console.error("❌ Failed to create review prompt notification (non-blocking):", notifErr);
            }
        }

        res.status(200).json({ message: "Request quote updated successfully", requestQuote: populatedRequestQuote });
    } catch (error) {
        console.error("Error updating request quote:", error);
        res.status(500).json({ message: "Server error" });
    }
};




const deleteRequestQuote = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid request quote ID" });
        }

        const requestQuote = await RequestQuote.findById(id)
            .populate("tasker", "firstName lastName email")
            .populate("client", "firstName lastName email");

        if (!requestQuote) {
            return res.status(404).json({ message: "Request quote not found" });
        }

        console.log(requestQuote);

        // Ensure the authenticated user is authorized (client or tasker)
        const userId = req.user.id;
        console.log(userId);

        // Check if client exists (should always exist)
        if (!requestQuote.client) {
            return res.status(500).json({ message: "Request quote has invalid client reference" });
        }

        const isClient = requestQuote.client._id.toString() === userId;

        // ✅ FIX: Only check tasker if tasker exists (could be null if no tasker assigned yet)
        const isTasker = requestQuote.tasker
            ? requestQuote.tasker._id.toString() === userId
            : false;

        if (!isClient && !isTasker) {
            return res.status(403).json({ message: "Unauthorized to delete this request quote" });
        }

        // Store quote details before deletion for notifications
        const quoteTaskTitle = requestQuote.taskTitle;
        const quoteClientId = requestQuote.client._id;
        const clientName = `${requestQuote.client.firstName} ${requestQuote.client.lastName}`;
        const quoteBudget = requestQuote.budget;

        // ✅ FIX: Safely get tasker info (may be null)
        const quoteTaskerId = requestQuote.tasker?._id || null;
        const taskerName = requestQuote.tasker
            ? `${requestQuote.tasker.firstName} ${requestQuote.tasker.lastName}`
            : null;

        // Delete the quote
        await RequestQuote.findByIdAndDelete(id);

        // Get deleter details from database
        const deleter = await User.findById(userId).select("firstName lastName");
        const deleterName = deleter
            ? `${deleter.firstName} ${deleter.lastName}`
            : "Someone";

        // ✅ FIX: Only notify the other party if they exist
        if (requestQuote.tasker && quoteTaskerId) {
            // Determine who should be notified (the other party)
            const otherPartyId = isClient ? quoteTaskerId : quoteClientId;

            // Create notification for the other party
            try {
                console.log("Creating quote deletion notification:", {
                    recipientId: otherPartyId,
                    deleterName,
                    quoteTaskTitle,
                    isClient
                });

                const notificationTitle = "❌ Quote Request Deleted";
                const notificationMessage = isClient
                    ? `${deleterName} has deleted the quote request for "${quoteTaskTitle}". This quote is no longer available.`
                    : `${deleterName} has withdrawn from the quote request "${quoteTaskTitle}". You may want to request a quote from another tasker.`;

                await createNotification(
                    otherPartyId,
                    notificationTitle,
                    notificationMessage,
                    "quote-deleted",
                    id
                );
                console.log("✅ Notification created for other party - quote deleted");

            } catch (notifErr) {
                console.error("❌ Failed to create notification (non-blocking):", notifErr);
            }
        } else {
            console.log("ℹ️ No tasker assigned yet, skipping tasker notification");
        }

        // Send confirmation notification to the deleter
        try {
            let confirmationMessage;

            if (isClient) {
                // ✅ FIX: Handle case when no tasker is assigned
                confirmationMessage = taskerName
                    ? `Your quote request for "${quoteTaskTitle}" has been deleted successfully. ${taskerName} has been notified.`
                    : `Your quote request for "${quoteTaskTitle}" has been deleted successfully.`;
            } else {
                confirmationMessage = `You have withdrawn from the quote request "${quoteTaskTitle}" by ${clientName}.`;
            }

            await createNotification(
                userId,
                "Quote Deletion Confirmed",
                confirmationMessage,
                "quote-delete-confirmed",
                id
            );
            console.log("✅ Confirmation notification sent to deleter");

        } catch (notifErr) {
            console.error("❌ Failed to create confirmation notification (non-blocking):", notifErr);
        }

        res.status(200).json({ message: "Request quote deleted successfully" });
    } catch (error) {
        console.error("Error deleting request quote:", error);
        res.status(500).json({ message: "Server error" });
    }
};




const calculateQuoteFees = (bidAmountInCents) => {
    // ─── CLIENT SIDE FEES (Added to bid amount) ───
    const clientPlatformFee = Math.round(bidAmountInCents * CLIENT_PLATFORM_FEE_PERCENT);
    const reservationFee = RESERVATION_FEE_CENTS;
    const clientTax = Math.round(bidAmountInCents * CLIENT_TAX_PERCENT);
    const totalClientPays = bidAmountInCents + clientPlatformFee + reservationFee + clientTax;

    // ─── TASKER SIDE FEES (Deducted from bid amount) ───
    const taskerPlatformFee = Math.round(bidAmountInCents * TASKER_PLATFORM_FEE_PERCENT);
    const taskerTax = Math.round(bidAmountInCents * TASKER_TAX_PERCENT);
    const taskerPayout = bidAmountInCents - taskerPlatformFee - taskerTax;

    // ─── PLATFORM REVENUE ───
    const applicationFee = totalClientPays - taskerPayout;
    const platformTotal = clientPlatformFee + reservationFee + clientTax + taskerPlatformFee + taskerTax;

    return {
        // In cents
        bidAmountCents: bidAmountInCents,

        // Client fees (cents)
        clientPlatformFeeCents: clientPlatformFee,
        reservationFeeCents: reservationFee,
        clientTaxCents: clientTax,
        totalClientPaysCents: totalClientPays,

        // Tasker deductions (cents)
        taskerPlatformFeeCents: taskerPlatformFee,
        taskerTaxCents: taskerTax,
        taskerPayoutCents: taskerPayout,

        // Platform (cents)
        applicationFeeCents: applicationFee,
        platformTotalCents: platformTotal,

        // In dollars (for display)
        bidAmount: bidAmountInCents / 100,

        // Client fees (dollars)
        clientPlatformFee: clientPlatformFee / 100,
        reservationFee: reservationFee / 100,
        clientTax: clientTax / 100,
        totalClientPays: totalClientPays / 100,

        // Tasker deductions (dollars)
        taskerPlatformFee: taskerPlatformFee / 100,
        taskerTax: taskerTax / 100,
        taskerPayout: taskerPayout / 100,

        // Platform (dollars)
        applicationFee: applicationFee / 100,
        platformTotal: platformTotal / 100,

        // Percentages for display
        clientPlatformFeePercent: CLIENT_PLATFORM_FEE_PERCENT * 100,
        clientTaxPercent: CLIENT_TAX_PERCENT * 100,
        taskerPlatformFeePercent: TASKER_PLATFORM_FEE_PERCENT * 100,
        taskerTaxPercent: TASKER_TAX_PERCENT * 100,
    };
};

/**
 * Preview fees endpoint (for the tasker bid modal)
 */
export const previewBidFees = async (req, res) => {
    try {
        const { bidAmount } = req.body;

        if (!bidAmount || isNaN(bidAmount) || Number(bidAmount) <= 0) {
            return res.status(400).json({
                message: 'Valid bid amount is required'
            });
        }

        const bidAmountInCents = Math.round(Number(bidAmount) * 100);
        const fees = calculateQuoteFees(bidAmountInCents);

        // Validate tasker payout is positive
        if (fees.taskerPayoutCents < 0) {
            return res.status(400).json({
                message: 'Bid amount too small to cover fees',
                code: 'BID_TOO_SMALL'
            });
        }

        console.log('💰 Quote Bid Fee Preview:');
        console.log(`   ┌─────────────────────────────────────────────────────┐`);
        console.log(`   │ BID AMOUNT:                  $${fees.bidAmount.toFixed(2).padStart(8)}`);
        console.log(`   ├─────────────────────────────────────────────────────┤`);
        console.log(`   │ CLIENT SIDE:`);
        console.log(`   │   Platform Fee (10%):       +$${fees.clientPlatformFee.toFixed(2).padStart(8)}`);
        console.log(`   │   Reservation Fee:          +$${fees.reservationFee.toFixed(2).padStart(8)}`);
        console.log(`   │   HST (13%):                +$${fees.clientTax.toFixed(2).padStart(8)}`);
        console.log(`   │   CLIENT PAYS:               $${fees.totalClientPays.toFixed(2).padStart(8)}`);
        console.log(`   ├─────────────────────────────────────────────────────┤`);
        console.log(`   │ TASKER SIDE:`);
        console.log(`   │   Platform Fee (12%):       -$${fees.taskerPlatformFee.toFixed(2).padStart(8)}`);
        console.log(`   │   Tax (13%):                -$${fees.taskerTax.toFixed(2).padStart(8)}`);
        console.log(`   │   TASKER RECEIVES:           $${fees.taskerPayout.toFixed(2).padStart(8)}`);
        console.log(`   └─────────────────────────────────────────────────────┘`);

        res.status(200).json({
            success: true,
            fees: {
                bidAmount: fees.bidAmount,

                // Client side
                clientPlatformFee: fees.clientPlatformFee,
                clientPlatformFeePercent: fees.clientPlatformFeePercent,
                reservationFee: fees.reservationFee,
                clientTax: fees.clientTax,
                clientTaxPercent: fees.clientTaxPercent,
                totalClientPays: fees.totalClientPays,

                // Tasker side
                taskerPlatformFee: fees.taskerPlatformFee,
                taskerPlatformFeePercent: fees.taskerPlatformFeePercent,
                taskerTax: fees.taskerTax,
                taskerTaxPercent: fees.taskerTaxPercent,
                taskerPayout: fees.taskerPayout,

                // Platform
                platformTotal: fees.platformTotal,
                applicationFee: fees.applicationFee,

                feeStructure: 'client-10-5-13_tasker-12-13',
            }
        });

    } catch (error) {
        console.error('Error calculating fees:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

/**
 * Submit a bid on a quote request
 */
export const submitBid = async (req, res) => {
    try {
        const { quoteId } = req.params;
        const { bidAmount, bidDescription, estimatedDuration } = req.body;
        const taskerId = req.user._id || req.user.id; // ✅ Handle both formats

        console.log('=== SUBMIT BID START ===');
        console.log('1. quoteId:', quoteId);
        console.log('2. taskerId:', taskerId);
        console.log('3. body:', req.body);

        // Check if body was parsed
        if (!req.body || Object.keys(req.body).length === 0) {
            console.error('❌ Request body is empty or undefined');
            return res.status(400).json({
                message: 'Request body is empty. Make sure Content-Type is application/json'
            });
        }

        // Validate quoteId format
        if (!mongoose.Types.ObjectId.isValid(quoteId)) {
            return res.status(400).json({ message: 'Invalid quote ID format' });
        }

        // Validate bid amount
        if (!bidAmount || isNaN(bidAmount) || Number(bidAmount) <= 0) {
            return res.status(400).json({
                message: 'Valid bid amount is required (must be greater than 0)'
            });
        }

        // Minimum amount check
        const bidAmountInCents = Math.round(Number(bidAmount) * 100);
        if (bidAmountInCents < 100) {
            return res.status(400).json({
                message: 'Minimum bid amount is $1.00'
            });
        }

        console.log('4. Finding quote...');
        const quote = await RequestQuote.findById(quoteId);

        if (!quote) {
            return res.status(404).json({ message: 'Quote not found' });
        }
        console.log('5. Quote found:', quote._id);

        // Check ownership
        if (!quote.tasker) {
            return res.status(400).json({ message: 'This quote has no assigned tasker' });
        }

        if (quote.tasker.toString() !== taskerId.toString()) {
            return res.status(403).json({
                message: 'Unauthorized: Only the assigned tasker can bid on this quote'
            });
        }
        console.log('6. Ownership verified');

        // Check if quote status allows bidding
        const nonBiddableStatuses = ['accepted', 'completed', 'in_progress', 'cancelled', 'expired'];
        if (nonBiddableStatuses.includes(quote.status)) {
            return res.status(400).json({
                message: `Cannot bid on a quote with status: ${quote.status}`
            });
        }
        console.log('7. Status allows bidding:', quote.status);

        // ✅ Calculate fees - CHECK IF FUNCTION EXISTS
        console.log('8. Calculating fees...');
        let fees;
        try {
            if (typeof calculateQuoteFees !== 'function') {
                console.error('❌ calculateQuoteFees is not defined!');
                // Use inline calculation as fallback
                fees = calculateFeesFallback(bidAmountInCents);
            } else {
                fees = calculateQuoteFees(bidAmountInCents);
            }
            console.log('9. Fees calculated:', fees.taskerPayout);
        } catch (feeError) {
            console.error('❌ Fee calculation error:', feeError.message);
            return res.status(500).json({ message: 'Error calculating fees' });
        }

        // Validate tasker payout is positive
        if (fees.taskerPayoutCents < 0) {
            return res.status(400).json({
                message: 'Bid amount too small to cover fees',
                code: 'BID_TOO_SMALL'
            });
        }

        // Create bid object
        console.log('10. Creating bid object...');
        const newBid = {
            tasker: new mongoose.Types.ObjectId(taskerId),
            bidAmount: Number(bidAmount),
            bidDescription: bidDescription?.trim() || '',
            estimatedDuration: Number(estimatedDuration) || 1,
            submittedAt: new Date(),
            status: 'pending',
            feeBreakdown: {
                feeStructure: 'client-10-5-13_tasker-12-13',
                bidAmountCents: fees.bidAmountCents,
                clientPlatformFeeCents: fees.clientPlatformFeeCents,
                reservationFeeCents: fees.reservationFeeCents,
                clientTaxCents: fees.clientTaxCents,
                totalClientPaysCents: fees.totalClientPaysCents,
                taskerPlatformFeeCents: fees.taskerPlatformFeeCents,
                taskerTaxCents: fees.taskerTaxCents,
                taskerPayoutCents: fees.taskerPayoutCents,
                applicationFeeCents: fees.applicationFeeCents,
            }
        };
        console.log('11. Bid object created');

        // Add bid to the quote
        quote.bids.push(newBid);

        // Update status
        if (quote.status === 'pending' || quote.status === 'rejected') {
            quote.status = 'bidded';
        }

        // Save the updated quote
        console.log('12. Saving quote...');
        await quote.save();
        console.log('13. ✅ Quote saved successfully');

        // Populate for response - USE .lean() to avoid circular references
        console.log('14. Populating quote...');
        let populatedQuote;
        try {
            populatedQuote = await RequestQuote.findById(quoteId)
                .populate('tasker', 'firstName lastName email phone currentRole')
                .populate('client', 'firstName lastName email phone currentRole')
                .populate('bids.tasker', 'firstName lastName')
                .lean(); // ✅ IMPORTANT: Converts to plain JS object
            console.log('15. ✅ Quote populated');
        } catch (popError) {
            console.error('❌ Population error:', popError.message);
            // Continue with unpopulated data
            populatedQuote = quote.toObject();
        }

        if (!populatedQuote) {
            return res.status(500).json({ message: 'Error retrieving updated quote' });
        }

        // Get names for notifications
        const taskerName = populatedQuote.tasker
            ? `${populatedQuote.tasker.firstName} ${populatedQuote.tasker.lastName}`
            : 'The tasker';

        // Send notifications (wrapped in try-catch to not break response)
        console.log('16. Sending notifications...');

        // Client notification
        try {
            if (populatedQuote.client?._id) {
                await createNotification(
                    populatedQuote.client._id,
                    '💰 New Bid Received!',
                    `${taskerName} submitted a bid of $${bidAmount} for "${populatedQuote.taskTitle}"`,
                    'quote-bid-received',
                    quoteId
                );
                console.log('17. ✅ Client notification sent');
            }
        } catch (notifErr) {
            console.error('❌ Client notification failed:', notifErr.message);
            // Don't return - continue to send response
        }

        // Tasker notification
        try {
            await createNotification(
                taskerId,
                '✅ Bid Submitted Successfully',
                `Your bid of $${bidAmount} for "${populatedQuote.taskTitle}" has been submitted.`,
                'quote-bid-submitted',
                quoteId
            );
            console.log('18. ✅ Tasker notification sent');
        } catch (notifErr) {
            console.error('❌ Tasker notification failed:', notifErr.message);
            // Don't return - continue to send response
        }

        // ✅ Send clean response
        console.log('19. Preparing response...');

        const responseData = {
            success: true,
            message: 'Bid submitted successfully',
            quote: {
                _id: populatedQuote._id,
                taskTitle: populatedQuote.taskTitle,
                taskDescription: populatedQuote.taskDescription,
                status: populatedQuote.status,
                bids: populatedQuote.bids,
                client: populatedQuote.client,
                tasker: populatedQuote.tasker,
            },
            feeBreakdown: {
                bidAmount: fees.bidAmount,
                clientPlatformFee: fees.clientPlatformFee,
                reservationFee: fees.reservationFee,
                clientTax: fees.clientTax,
                totalClientPays: fees.totalClientPays,
                taskerPlatformFee: fees.taskerPlatformFee,
                taskerTax: fees.taskerTax,
                taskerPayout: fees.taskerPayout,
                applicationFee: fees.applicationFee,
            }
        };

        console.log('20. ✅ Sending success response');
        return res.status(201).json(responseData);

    } catch (error) {
        console.error('=== ERROR SUBMITTING BID ===');
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);

        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(e => e.message);
            return res.status(400).json({
                message: 'Validation error',
                errors: messages
            });
        }

        if (error.name === 'CastError') {
            return res.status(400).json({ message: 'Invalid ID format' });
        }

        return res.status(500).json({
            message: 'Server error while submitting bid',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};
/**
 * Preview fees before accepting a bid (for the client accept modal)
 */
export const previewAcceptBidFees = async (req, res) => {
    try {
        const { quoteId, bidId } = req.params;
        const clientId = req.user.id;

        const quote = await RequestQuote.findById(quoteId)
            .populate('tasker', 'firstName lastName');

        if (!quote) {
            return res.status(404).json({ message: 'Quote not found' });
        }

        if (quote.client.toString() !== clientId) {
            return res.status(403).json({ message: 'Unauthorized' });
        }

        const bid = quote.bids.id(bidId);
        if (!bid) {
            return res.status(404).json({ message: 'Bid not found' });
        }

        const bidAmountInCents = Math.round(bid.bidAmount * 100);
        const fees = calculateQuoteFees(bidAmountInCents);

        console.log('💰 Quote Accept Fee Preview:');
        console.log(`   ┌─────────────────────────────────────────────────────┐`);
        console.log(`   │ BID AMOUNT:                  $${fees.bidAmount.toFixed(2).padStart(8)}`);
        console.log(`   ├─────────────────────────────────────────────────────┤`);
        console.log(`   │ CLIENT FEES:`);
        console.log(`   │   Platform Fee (10%):       +$${fees.clientPlatformFee.toFixed(2).padStart(8)}`);
        console.log(`   │   Reservation Fee:          +$${fees.reservationFee.toFixed(2).padStart(8)}`);
        console.log(`   │   HST (13%):                +$${fees.clientTax.toFixed(2).padStart(8)}`);
        console.log(`   │   YOU PAY:                   $${fees.totalClientPays.toFixed(2).padStart(8)}`);
        console.log(`   ├─────────────────────────────────────────────────────┤`);
        console.log(`   │ TASKER DEDUCTIONS:`);
        console.log(`   │   Platform Fee (12%):       -$${fees.taskerPlatformFee.toFixed(2).padStart(8)}`);
        console.log(`   │   Tax (13%):                -$${fees.taskerTax.toFixed(2).padStart(8)}`);
        console.log(`   │   TASKER RECEIVES:           $${fees.taskerPayout.toFixed(2).padStart(8)}`);
        console.log(`   └─────────────────────────────────────────────────────┘`);

        res.status(200).json({
            success: true,
            bid: {
                _id: bid._id,
                bidAmount: bid.bidAmount,
                bidDescription: bid.bidDescription,
                estimatedDuration: bid.estimatedDuration,
            },
            tasker: {
                firstName: quote.tasker.firstName,
                lastName: quote.tasker.lastName,
            },
            taskTitle: quote.taskTitle,
            fees: {
                bidAmount: fees.bidAmount,

                // Client side
                clientPlatformFee: fees.clientPlatformFee,
                clientPlatformFeePercent: fees.clientPlatformFeePercent,
                reservationFee: fees.reservationFee,
                clientTax: fees.clientTax,
                clientTaxPercent: fees.clientTaxPercent,
                totalClientPays: fees.totalClientPays,

                // Tasker side
                taskerPlatformFee: fees.taskerPlatformFee,
                taskerPlatformFeePercent: fees.taskerPlatformFeePercent,
                taskerTax: fees.taskerTax,
                taskerTaxPercent: fees.taskerTaxPercent,
                taskerPayout: fees.taskerPayout,

                // Platform
                platformTotal: fees.platformTotal,
                applicationFee: fees.applicationFee,

                feeStructure: 'client-10-5-13_tasker-12-13',
            }
        });

    } catch (error) {
        console.error('Error previewing fees:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

/**
 * Accept a bid on a quote
 */
// export const acceptBid = async (req, res) => {
//     console.log('=== ACCEPT BID REQUEST ===');
//     console.log('req.body:', req.body);

//     let paymentIntent = null;

//     try {
//         const { quoteId, bidId } = req.params;
//         const clientId = req.user.id;

//         const body = req.body || {};
//         const paymentMethodId = body.paymentMethodId || null;

//         console.log('=== ACCEPT BID WITH DOUBLE-SIDED FEES ===');
//         console.log('quoteId:', quoteId);
//         console.log('bidId:', bidId);
//         console.log('clientId:', clientId);
//         console.log('paymentMethodId:', paymentMethodId);

//         // Validate IDs
//         if (!mongoose.Types.ObjectId.isValid(quoteId)) {
//             return res.status(400).json({ message: 'Invalid quote ID' });
//         }

//         if (!mongoose.Types.ObjectId.isValid(bidId)) {
//             return res.status(400).json({ message: 'Invalid bid ID' });
//         }

//         const quote = await RequestQuote.findById(quoteId)
//             .populate('client', 'firstName lastName email phone stripeCustomerId defaultPaymentMethod defaultPaymentMethodId address')
//             .populate('tasker', 'firstName lastName email phone stripeConnectAccountId stripeConnectStatus');

//         if (!quote) {
//             return res.status(404).json({ message: 'Quote not found' });
//         }

//         if (quote.client._id.toString() !== clientId) {
//             return res.status(403).json({ message: 'Unauthorized' });
//         }

//         const bid = quote.bids.id(bidId);
//         if (!bid) {
//             return res.status(404).json({ message: 'Bid not found' });
//         }

//         if (bid.status !== 'pending') {
//             return res.status(400).json({ message: 'Bid has already been decided' });
//         }

//         // Validate tasker can receive payments
//         let taskerStripeAccountId;
//         try {
//             taskerStripeAccountId = await validateTaskerCanReceivePayments(quote.tasker._id);
//             console.log('✅ Tasker Stripe Connect validated:', taskerStripeAccountId);
//         } catch (connectError) {
//             return res.status(400).json({
//                 message: connectError.message,
//                 code: 'TASKER_PAYMENT_NOT_SETUP',
//             });
//         }

//         // Get client payment info
//         const client = quote.client;
//         const customerPaymentMethod = paymentMethodId || client.defaultPaymentMethod || client.defaultPaymentMethodId;

//         if (!client.stripeCustomerId) {
//             return res.status(400).json({
//                 message: 'Please add a payment method first',
//                 code: 'NO_PAYMENT_METHOD'
//             });
//         }

//         if (!customerPaymentMethod) {
//             return res.status(400).json({
//                 message: 'Please add a payment method first',
//                 code: 'NO_PAYMENT_METHOD'
//             });
//         }

//         // ✅ UPDATE STRIPE CUSTOMER WITH DETAILS
//         try {
//             const customerName = `${client.firstName} ${client.lastName}`.trim();

//             await stripe.customers.update(client.stripeCustomerId, {
//                 name: customerName || undefined,
//                 email: client.email || undefined,
//                 phone: client.phone || undefined,
//                 description: `Client - ${customerName}`,
//                 metadata: {
//                     platform: 'taskallo',
//                     userId: client._id.toString(),
//                     userType: 'client',
//                     firstName: client.firstName || '',
//                     lastName: client.lastName || '',
//                 },
//                 ...(client.address && {
//                     address: {
//                         line1: client.address.street || client.address.line1 || '',
//                         city: client.address.city || '',
//                         state: client.address.province || client.address.state || '',
//                         postal_code: client.address.postalCode || client.address.postal_code || '',
//                         country: client.address.country || 'CA',
//                     },
//                 }),
//             });
//             console.log('✅ Stripe customer updated with details');
//         } catch (updateErr) {
//             console.error('⚠️ Failed to update Stripe customer (non-blocking):', updateErr.message);
//         }

//         // ✅ Calculate DOUBLE-SIDED fees with new structure
//         const bidAmountInCents = Math.round(bid.bidAmount * 100);
//         const fees = calculateQuoteFees(bidAmountInCents);

//         console.log('💰 DOUBLE-SIDED FEE Quote Payment Breakdown:');
//         console.log(`   ┌─────────────────────────────────────────────────────┐`);
//         console.log(`   │ BID AMOUNT:                  $${fees.bidAmount.toFixed(2).padStart(8)}`);
//         console.log(`   ├─────────────────────────────────────────────────────┤`);
//         console.log(`   │ CLIENT SIDE (added to bid):`);
//         console.log(`   │   Platform Fee (10%):       +$${fees.clientPlatformFee.toFixed(2).padStart(8)}`);
//         console.log(`   │   Reservation Fee:          +$${fees.reservationFee.toFixed(2).padStart(8)}`);
//         console.log(`   │   HST (13%):                +$${fees.clientTax.toFixed(2).padStart(8)}`);
//         console.log(`   │   ─────────────────────────────────────────────────`);
//         console.log(`   │   TOTAL CLIENT PAYS:         $${fees.totalClientPays.toFixed(2).padStart(8)}`);
//         console.log(`   ├─────────────────────────────────────────────────────┤`);
//         console.log(`   │ TASKER SIDE (deducted from bid):`);
//         console.log(`   │   Platform Fee (12%):       -$${fees.taskerPlatformFee.toFixed(2).padStart(8)}`);
//         console.log(`   │   Tax (13%):                -$${fees.taskerTax.toFixed(2).padStart(8)}`);
//         console.log(`   │   ─────────────────────────────────────────────────`);
//         console.log(`   │   TASKER RECEIVES:           $${fees.taskerPayout.toFixed(2).padStart(8)}`);
//         console.log(`   ├─────────────────────────────────────────────────────┤`);
//         console.log(`   │ PLATFORM KEEPS:              $${fees.applicationFee.toFixed(2).padStart(8)}`);
//         console.log(`   └─────────────────────────────────────────────────────┘`);

//         // Validation checks
//         if (fees.totalClientPaysCents < 50) {
//             return res.status(400).json({
//                 message: 'Minimum payment amount is $0.50 CAD',
//                 code: 'AMOUNT_TOO_SMALL'
//             });
//         }

//         if (fees.taskerPayoutCents < 0) {
//             return res.status(400).json({
//                 message: 'Bid amount too small to cover fees',
//                 code: 'BID_TOO_SMALL'
//             });
//         }

//         // ✅ Create PaymentIntent with detailed description and receipt email
//         const clientFullName = `${client.firstName} ${client.lastName}`.trim();
//         const taskerFullName = `${quote.tasker.firstName} ${quote.tasker.lastName}`.trim();

//         try {
//             paymentIntent = await stripe.paymentIntents.create({
//                 amount: fees.totalClientPaysCents,
//                 currency: 'cad',
//                 customer: client.stripeCustomerId,
//                 payment_method: customerPaymentMethod,
//                 capture_method: 'manual',

//                 description: `Quote Payment: "${quote.taskTitle}" | Client: ${clientFullName} | Tasker: ${taskerFullName}`,

//                 receipt_email: client.email,

//                 statement_descriptor: 'TASKALLO QUOTE',
//                 statement_descriptor_suffix: quote.taskTitle.substring(0, 10).toUpperCase(),

//                 application_fee_amount: fees.applicationFeeCents,

//                 transfer_data: {
//                     destination: taskerStripeAccountId,
//                 },

//                 metadata: {
//                     type: 'quote',
//                     quoteId: quoteId,
//                     bidId: bidId,
//                     taskTitle: quote.taskTitle.substring(0, 100),

//                     // Client info
//                     clientId: client._id.toString(),
//                     clientName: clientFullName,
//                     clientEmail: client.email || '',
//                     clientPhone: client.phone || '',

//                     // Tasker info
//                     taskerId: quote.tasker._id.toString(),
//                     taskerName: taskerFullName,
//                     taskerEmail: quote.tasker.email || '',

//                     // Amounts
//                     bidAmount: fees.bidAmount.toString(),
//                     clientPlatformFee: fees.clientPlatformFee.toString(),
//                     reservationFee: fees.reservationFee.toString(),
//                     clientTax: fees.clientTax.toString(),
//                     totalClientPays: fees.totalClientPays.toString(),
//                     taskerPlatformFee: fees.taskerPlatformFee.toString(),
//                     taskerTax: fees.taskerTax.toString(),
//                     taskerPayout: fees.taskerPayout.toString(),
//                     applicationFee: fees.applicationFee.toString(),

//                     feeStructure: 'client-10-5-13_tasker-12-13',
//                     platform: 'taskallo',
//                 },

//                 shipping: {
//                     name: clientFullName,
//                     phone: client.phone || '',
//                     address: {
//                         line1: client.address?.street || client.address?.line1 || 'N/A',
//                         city: client.address?.city || '',
//                         state: client.address?.province || client.address?.state || '',
//                         postal_code: client.address?.postalCode || client.address?.postal_code || '',
//                         country: client.address?.country || 'CA',
//                     },
//                 },

//                 automatic_payment_methods: {
//                     enabled: true,
//                     allow_redirects: 'never'
//                 },
//                 confirm: true,
//             });

//             console.log('✅ PaymentIntent created:', paymentIntent.id);
//             console.log('   Status:', paymentIntent.status);

//         } catch (stripeError) {
//             console.error('❌ Stripe PaymentIntent creation failed:', stripeError);

//             if (stripeError.type === 'StripeCardError') {
//                 return res.status(400).json({
//                     message: stripeError.message,
//                     code: 'CARD_ERROR',
//                     decline_code: stripeError.decline_code
//                 });
//             }

//             return res.status(400).json({
//                 message: 'Payment authorization failed: ' + stripeError.message,
//                 code: 'PAYMENT_FAILED',
//             });
//         }

//         if (paymentIntent.status !== 'requires_capture') {
//             console.error('❌ Unexpected payment status:', paymentIntent.status);

//             try {
//                 await stripe.paymentIntents.cancel(paymentIntent.id);
//             } catch (e) {
//                 console.error('Could not cancel PaymentIntent:', e);
//             }

//             return res.status(400).json({
//                 message: 'Payment authorization failed',
//                 code: 'AUTHORIZATION_FAILED',
//                 error: paymentIntent.last_payment_error?.message
//             });
//         }

//         // ✅ Update bid status
//         bid.status = 'accepted';
//         quote.bids.forEach(b => {
//             if (b._id.toString() !== bidId) b.status = 'rejected';
//         });

//         quote.status = 'accepted';
//         quote.acceptedAt = new Date();
//         quote.acceptedBid = {
//             bidId: bid._id,
//             tasker: quote.tasker._id,
//             bidAmount: bid.bidAmount,
//             bidDescription: bid.bidDescription,
//             estimatedDuration: bid.estimatedDuration,
//             acceptedAt: new Date(),
//         };

//         // ✅ Save COMPLETE payment info with new fee breakdown
//         quote.payment = {
//             paymentIntentId: paymentIntent.id,
//             status: 'held',
//             currency: 'cad',
//             authorizedAt: new Date(),
//             feeStructure: 'client-10-5-13_tasker-12-13',

//             // Bid amount
//             bidAmount: fees.bidAmount,
//             bidAmountCents: fees.bidAmountCents,

//             // Client fees
//             clientPlatformFee: fees.clientPlatformFee,
//             clientPlatformFeeCents: fees.clientPlatformFeeCents,
//             reservationFee: fees.reservationFee,
//             reservationFeeCents: fees.reservationFeeCents,
//             clientTax: fees.clientTax,
//             clientTaxCents: fees.clientTaxCents,
//             totalClientPays: fees.totalClientPays,
//             totalClientPaysCents: fees.totalClientPaysCents,

//             // Tasker deductions
//             taskerPlatformFee: fees.taskerPlatformFee,
//             taskerPlatformFeeCents: fees.taskerPlatformFeeCents,
//             taskerTax: fees.taskerTax,
//             taskerTaxCents: fees.taskerTaxCents,
//             taskerPayout: fees.taskerPayout,
//             taskerPayoutCents: fees.taskerPayoutCents,

//             // Platform revenue
//             applicationFee: fees.applicationFee,
//             applicationFeeCents: fees.applicationFeeCents,

//             // Legacy fields for backwards compatibility
//             grossAmount: fees.totalClientPaysCents,
//             platformFee: fees.applicationFeeCents,
//         };

//         await quote.save();
//         console.log('✅ Quote updated and saved');

//         // ✅ Notifications
//         try {
//             await createNotification(
//                 quote.tasker._id,
//                 "🎉 Your Bid Was Accepted!",
//                 `${clientFullName} has accepted your bid of $${fees.bidAmount.toFixed(2)} for "${quote.taskTitle}". Payment of $${fees.totalClientPays.toFixed(2)} is held. You'll receive $${fees.taskerPayout.toFixed(2)} (after 12% + 13%) when completed.`,
//                 'quote-bid-accepted',
//                 quoteId
//             );
//             console.log('✅ Notification sent to tasker');
//         } catch (notifErr) {
//             console.error('❌ Tasker notification failed:', notifErr.message);
//         }

//         try {
//             await createNotification(
//                 clientId,
//                 "✅ Bid Accepted - Payment Held",
//                 `You've accepted ${taskerFullName}'s bid of $${fees.bidAmount.toFixed(2)} for "${quote.taskTitle}". Total charged: $${fees.totalClientPays.toFixed(2)} (incl. 10% + $5 + 13% HST). Payment is held until completion.`,
//                 'quote-bid-accepted-client',
//                 quoteId
//             );
//             console.log('✅ Confirmation sent to client');
//         } catch (notifErr) {
//             console.error('❌ Client notification failed:', notifErr.message);
//         }

//         // Populate for response
//         const populatedQuote = await RequestQuote.findById(quoteId)
//             .populate('tasker', 'firstName lastName email phone profilePicture')
//             .populate('client', 'firstName lastName email phone');

//         console.log('=== BID ACCEPTED SUCCESSFULLY ===');

//         res.status(200).json({
//             success: true,
//             message: 'Bid accepted successfully',
//             quote: populatedQuote,
//             paymentBreakdown: {
//                 bidAmount: fees.bidAmount,

//                 // Client side
//                 clientPlatformFee: fees.clientPlatformFee,
//                 clientPlatformFeePercent: fees.clientPlatformFeePercent,
//                 reservationFee: fees.reservationFee,
//                 clientTax: fees.clientTax,
//                 clientTaxPercent: fees.clientTaxPercent,
//                 totalClientPays: fees.totalClientPays,

//                 // Tasker side
//                 taskerPlatformFee: fees.taskerPlatformFee,
//                 taskerPlatformFeePercent: fees.taskerPlatformFeePercent,
//                 taskerTax: fees.taskerTax,
//                 taskerTaxPercent: fees.taskerTaxPercent,
//                 taskerPayout: fees.taskerPayout,

//                 // Platform
//                 platformTotal: fees.platformTotal,
//                 applicationFee: fees.applicationFee,

//                 currency: 'CAD',
//                 status: 'held',
//                 feeStructure: 'client-10-5-13_tasker-12-13',
//             }
//         });

//     } catch (error) {
//         console.error('=== ERROR ACCEPTING BID ===');
//         console.error('Error:', error);

//         // Cancel payment intent if created
//         if (paymentIntent?.id) {
//             try {
//                 await stripe.paymentIntents.cancel(paymentIntent.id);
//                 console.log('✅ PaymentIntent cancelled due to error');
//             } catch (cancelError) {
//                 console.error('❌ Failed to cancel PaymentIntent:', cancelError);
//             }
//         }

//         res.status(500).json({
//             message: 'Server error while accepting bid',
//             error: process.env.NODE_ENV === 'development' ? error.message : undefined
//         });
//     }
// };


export const acceptBid = async (req, res) => {
    console.log('=== ACCEPT BID REQUEST ===');
    console.log('req.body:', req.body);

    let paymentIntent = null;

    try {
        const { quoteId, bidId } = req.params;
        const clientId = req.user.id;

        const body = req.body || {};
        const paymentMethodId = body.paymentMethodId || null;

        console.log('=== ACCEPT BID WITH DOUBLE-SIDED FEES (DIRECT PLATFORM) ===');
        console.log('quoteId:', quoteId);
        console.log('bidId:', bidId);
        console.log('clientId:', clientId);
        console.log('paymentMethodId:', paymentMethodId);

        // Validate IDs
        if (!mongoose.Types.ObjectId.isValid(quoteId)) {
            return res.status(400).json({ message: 'Invalid quote ID' });
        }

        if (!mongoose.Types.ObjectId.isValid(bidId)) {
            return res.status(400).json({ message: 'Invalid bid ID' });
        }

        const quote = await RequestQuote.findById(quoteId)
            .populate('client', 'firstName lastName email phone stripeCustomerId defaultPaymentMethod defaultPaymentMethodId address')
            .populate('tasker', 'firstName lastName email phone');

        if (!quote) {
            return res.status(404).json({ message: 'Quote not found' });
        }

        if (quote.client._id.toString() !== clientId) {
            return res.status(403).json({ message: 'Unauthorized' });
        }

        const bid = quote.bids.id(bidId);
        if (!bid) {
            return res.status(404).json({ message: 'Bid not found' });
        }

        if (bid.status !== 'pending') {
            return res.status(400).json({ message: 'Bid has already been decided' });
        }

        // ⭐ REMOVED: Tasker Stripe Connect validation - no longer needed

        // Get client payment info
        const client = quote.client;
        const customerPaymentMethod = paymentMethodId || client.defaultPaymentMethod || client.defaultPaymentMethodId;

        if (!client.stripeCustomerId) {
            return res.status(400).json({
                message: 'Please add a payment method first',
                code: 'NO_PAYMENT_METHOD'
            });
        }

        if (!customerPaymentMethod) {
            return res.status(400).json({
                message: 'Please add a payment method first',
                code: 'NO_PAYMENT_METHOD'
            });
        }

        // ✅ UPDATE STRIPE CUSTOMER WITH DETAILS
        try {
            const customerName = `${client.firstName} ${client.lastName}`.trim();

            await stripe.customers.update(client.stripeCustomerId, {
                name: customerName || undefined,
                email: client.email || undefined,
                phone: client.phone || undefined,
                description: `Client - ${customerName}`,
                metadata: {
                    platform: 'taskallo',
                    userId: client._id.toString(),
                    userType: 'client',
                    firstName: client.firstName || '',
                    lastName: client.lastName || '',
                },
                ...(client.address && {
                    address: {
                        line1: client.address.street || client.address.line1 || '',
                        city: client.address.city || '',
                        state: client.address.province || client.address.state || '',
                        postal_code: client.address.postalCode || client.address.postal_code || '',
                        country: client.address.country || 'CA',
                    },
                }),
            });
            console.log('✅ Stripe customer updated with details');
        } catch (updateErr) {
            console.error('⚠️ Failed to update Stripe customer (non-blocking):', updateErr.message);
        }

        // ✅ Calculate DOUBLE-SIDED fees with new structure
        const bidAmountInCents = Math.round(bid.bidAmount * 100);
        const fees = calculateQuoteFees(bidAmountInCents);

        // ⭐ CHANGED: Platform keeps everything
        const platformRevenueCents = fees.totalClientPaysCents;

        console.log('💰 DOUBLE-SIDED FEE Quote Payment Breakdown (DIRECT PLATFORM):');
        console.log(`   ┌─────────────────────────────────────────────────────┐`);
        console.log(`   │ BID AMOUNT:                  $${fees.bidAmount.toFixed(2).padStart(8)}`);
        console.log(`   ├─────────────────────────────────────────────────────┤`);
        console.log(`   │ CLIENT SIDE (added to bid):`);
        console.log(`   │   Platform Fee (10%):       +$${fees.clientPlatformFee.toFixed(2).padStart(8)}`);
        console.log(`   │   Reservation Fee:          +$${fees.reservationFee.toFixed(2).padStart(8)}`);
        console.log(`   │   HST (13%):                +$${fees.clientTax.toFixed(2).padStart(8)}`);
        console.log(`   │   ─────────────────────────────────────────────────`);
        console.log(`   │   TOTAL CLIENT PAYS:         $${fees.totalClientPays.toFixed(2).padStart(8)}`);
        console.log(`   ├─────────────────────────────────────────────────────┤`);
        console.log(`   │ TASKER SIDE (deducted from bid):`);
        console.log(`   │   Platform Fee (12%):       -$${fees.taskerPlatformFee.toFixed(2).padStart(8)}`);
        console.log(`   │   Tax (13%):                -$${fees.taskerTax.toFixed(2).padStart(8)}`);
        console.log(`   │   ─────────────────────────────────────────────────`);
        console.log(`   │   TASKER WILL GET (Manual): $${fees.taskerPayout.toFixed(2).padStart(8)}`);
        console.log(`   ├─────────────────────────────────────────────────────┤`);
        console.log(`   │ PLATFORM RECEIVES:           $${(platformRevenueCents / 100).toFixed(2).padStart(8)}`);
        console.log(`   └─────────────────────────────────────────────────────┘`);

        // Validation checks
        if (fees.totalClientPaysCents < 50) {
            return res.status(400).json({
                message: 'Minimum payment amount is $0.50 CAD',
                code: 'AMOUNT_TOO_SMALL'
            });
        }

        if (fees.taskerPayoutCents < 0) {
            return res.status(400).json({
                message: 'Bid amount too small to cover fees',
                code: 'BID_TOO_SMALL'
            });
        }

        // ✅ Create PaymentIntent - ALL MONEY GOES TO PLATFORM
        const clientFullName = `${client.firstName} ${client.lastName}`.trim();
        const taskerFullName = `${quote.tasker.firstName} ${quote.tasker.lastName}`.trim();

        try {
            // ⭐ CHANGED: Removed application_fee_amount and transfer_data
            paymentIntent = await stripe.paymentIntents.create({
                amount: fees.totalClientPaysCents,
                currency: 'cad',
                customer: client.stripeCustomerId,
                payment_method: customerPaymentMethod,
                capture_method: 'manual',

                description: `Quote Payment: "${quote.taskTitle}" | Client: ${clientFullName} | Tasker: ${taskerFullName}`,

                receipt_email: client.email,

                statement_descriptor: 'TASKALLO QUOTE',
                statement_descriptor_suffix: quote.taskTitle.substring(0, 10).toUpperCase(),

                // ⭐ REMOVED: application_fee_amount
                // ⭐ REMOVED: transfer_data

                metadata: {
                    type: 'quote',
                    quoteId: quoteId,
                    bidId: bidId,
                    taskTitle: quote.taskTitle.substring(0, 100),
                    paymentModel: 'direct_platform', // ⭐ NEW

                    // Client info
                    clientId: client._id.toString(),
                    clientName: clientFullName,
                    clientEmail: client.email || '',
                    clientPhone: client.phone || '',

                    // Tasker info
                    taskerId: quote.tasker._id.toString(),
                    taskerName: taskerFullName,
                    taskerEmail: quote.tasker.email || '',

                    // Amounts
                    bidAmount: fees.bidAmount.toString(),
                    clientPlatformFee: fees.clientPlatformFee.toString(),
                    reservationFee: fees.reservationFee.toString(),
                    clientTax: fees.clientTax.toString(),
                    totalClientPays: fees.totalClientPays.toString(),
                    taskerPlatformFee: fees.taskerPlatformFee.toString(),
                    taskerTax: fees.taskerTax.toString(),
                    taskerPayout: fees.taskerPayout.toString(),
                    platformRevenue: (platformRevenueCents / 100).toString(), // ⭐ NEW
                    manualPayoutRequired: 'true', // ⭐ NEW

                    feeStructure: 'client-10-5-13_tasker-12-13',
                    platform: 'taskallo',
                },

                shipping: {
                    name: clientFullName,
                    phone: client.phone || '',
                    address: {
                        line1: client.address?.street || client.address?.line1 || 'N/A',
                        city: client.address?.city || '',
                        state: client.address?.province || client.address?.state || '',
                        postal_code: client.address?.postalCode || client.address?.postal_code || '',
                        country: client.address?.country || 'CA',
                    },
                },

                automatic_payment_methods: {
                    enabled: true,
                    allow_redirects: 'never'
                },
                confirm: true,
            });

            console.log('✅ PaymentIntent created:', paymentIntent.id);
            console.log('   Status:', paymentIntent.status);

        } catch (stripeError) {
            console.error('❌ Stripe PaymentIntent creation failed:', stripeError);

            if (stripeError.type === 'StripeCardError') {
                return res.status(400).json({
                    message: stripeError.message,
                    code: 'CARD_ERROR',
                    decline_code: stripeError.decline_code
                });
            }

            return res.status(400).json({
                message: 'Payment authorization failed: ' + stripeError.message,
                code: 'PAYMENT_FAILED',
            });
        }

        if (paymentIntent.status !== 'requires_capture') {
            console.error('❌ Unexpected payment status:', paymentIntent.status);

            try {
                await stripe.paymentIntents.cancel(paymentIntent.id);
            } catch (e) {
                console.error('Could not cancel PaymentIntent:', e);
            }

            return res.status(400).json({
                message: 'Payment authorization failed',
                code: 'AUTHORIZATION_FAILED',
                error: paymentIntent.last_payment_error?.message
            });
        }

        // ✅ Update bid status
        bid.status = 'accepted';
        quote.bids.forEach(b => {
            if (b._id.toString() !== bidId) b.status = 'rejected';
        });

        quote.status = 'accepted';
        quote.acceptedAt = new Date();
        quote.acceptedBid = {
            bidId: bid._id,
            tasker: quote.tasker._id,
            bidAmount: bid.bidAmount,
            bidDescription: bid.bidDescription,
            estimatedDuration: bid.estimatedDuration,
            acceptedAt: new Date(),
        };

        // ✅ Save COMPLETE payment info with new fee breakdown
        quote.payment = {
            paymentIntentId: paymentIntent.id,
            status: 'held',
            currency: 'cad',
            paymentModel: 'direct_platform', // ⭐ NEW
            authorizedAt: new Date(),
            feeStructure: 'client-10-5-13_tasker-12-13',

            // Bid amount
            bidAmount: fees.bidAmount,
            bidAmountCents: fees.bidAmountCents,

            // Client fees
            clientPlatformFee: fees.clientPlatformFee,
            clientPlatformFeeCents: fees.clientPlatformFeeCents,
            reservationFee: fees.reservationFee,
            reservationFeeCents: fees.reservationFeeCents,
            clientTax: fees.clientTax,
            clientTaxCents: fees.clientTaxCents,
            totalClientPays: fees.totalClientPays,
            totalClientPaysCents: fees.totalClientPaysCents,

            // Tasker deductions
            taskerPlatformFee: fees.taskerPlatformFee,
            taskerPlatformFeeCents: fees.taskerPlatformFeeCents,
            taskerTax: fees.taskerTax,
            taskerTaxCents: fees.taskerTaxCents,
            taskerPayout: fees.taskerPayout,
            taskerPayoutCents: fees.taskerPayoutCents,

            // Platform revenue
            platformRevenue: platformRevenueCents / 100, // ⭐ NEW
            platformRevenueCents: platformRevenueCents, // ⭐ NEW
            applicationFee: fees.applicationFee, // Keep for records
            applicationFeeCents: fees.applicationFeeCents,

            // Manual payment tracking
            manualPayoutRequired: true, // ⭐ NEW
            taskerPaid: false, // ⭐ NEW

            // Legacy fields for backwards compatibility
            grossAmount: fees.totalClientPaysCents,
            platformFee: fees.applicationFeeCents,
        };

        await quote.save();
        console.log('✅ Quote updated and saved');

        // ✅ Notifications - UPDATED FOR MANUAL PAYMENT
        try {
            await createNotification(
                quote.tasker._id,
                "🎉 Your Bid Was Accepted!",
                `${clientFullName} has accepted your bid of $${fees.bidAmount.toFixed(2)} for "${quote.taskTitle}". You'll receive $${fees.taskerPayout.toFixed(2)} (after fees) upon completion and approval.`,
                'quote-bid-accepted',
                quoteId
            );
            console.log('✅ Notification sent to tasker');
        } catch (notifErr) {
            console.error('❌ Tasker notification failed:', notifErr.message);
        }

        try {
            await createNotification(
                clientId,
                "✅ Bid Accepted - Payment Held",
                `You've accepted ${taskerFullName}'s bid of $${fees.bidAmount.toFixed(2)} for "${quote.taskTitle}". Total charged: $${fees.totalClientPays.toFixed(2)} (incl. 10% + $5 + 13% HST). Payment is held until completion.`,
                'quote-bid-accepted-client',
                quoteId
            );
            console.log('✅ Confirmation sent to client');
        } catch (notifErr) {
            console.error('❌ Client notification failed:', notifErr.message);
        }

        // Populate for response
        const populatedQuote = await RequestQuote.findById(quoteId)
            .populate('tasker', 'firstName lastName email phone profilePicture')
            .populate('client', 'firstName lastName email phone');

        console.log('=== BID ACCEPTED SUCCESSFULLY (DIRECT PLATFORM) ===');

        res.status(200).json({
            success: true,
            message: 'Bid accepted successfully',
            quote: populatedQuote,
            paymentBreakdown: {
                bidAmount: fees.bidAmount,

                // Client side
                clientPlatformFee: fees.clientPlatformFee,
                clientPlatformFeePercent: fees.clientPlatformFeePercent,
                reservationFee: fees.reservationFee,
                clientTax: fees.clientTax,
                clientTaxPercent: fees.clientTaxPercent,
                totalClientPays: fees.totalClientPays,

                // Tasker side
                taskerPlatformFee: fees.taskerPlatformFee,
                taskerPlatformFeePercent: fees.taskerPlatformFeePercent,
                taskerTax: fees.taskerTax,
                taskerTaxPercent: fees.taskerTaxPercent,
                taskerPayout: fees.taskerPayout,

                // Platform
                platformRevenue: platformRevenueCents / 100, // ⭐ CHANGED
                platformTotal: fees.platformTotal, // Keep for compatibility
                applicationFee: fees.applicationFee,

                currency: 'CAD',
                status: 'held',
                paymentModel: 'direct_platform', // ⭐ NEW
                feeStructure: 'client-10-5-13_tasker-12-13',
            }
        });

    } catch (error) {
        console.error('=== ERROR ACCEPTING BID ===');
        console.error('Error:', error);

        // Cancel payment intent if created
        if (paymentIntent?.id) {
            try {
                await stripe.paymentIntents.cancel(paymentIntent.id);
                console.log('✅ PaymentIntent cancelled due to error');
            } catch (cancelError) {
                console.error('❌ Failed to cancel PaymentIntent:', cancelError);
            }
        }

        res.status(500).json({
            message: 'Server error while accepting bid',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Export the fee calculation function for use elsewhere
export { calculateQuoteFees };





export const rejectBid = async (req, res) => {
    try {
        const { quoteId, bidId } = req.params;
        const clientId = req.user.id;

        if (!mongoose.Types.ObjectId.isValid(quoteId) || !mongoose.Types.ObjectId.isValid(bidId)) {
            return res.status(400).json({ message: 'Invalid quote or bid ID' });
        }

        const quote = await RequestQuote.findById(quoteId)
            .populate('client', 'firstName lastName email currentRole')
            .populate('tasker', 'firstName lastName email currentRole');

        if (!quote) {
            return res.status(404).json({ message: 'Quote not found' });
        }

        if (quote.client._id.toString() !== clientId) {
            return res.status(403).json({ message: 'Unauthorized: Only the client can reject bids' });
        }

        if (quote.status !== 'bidded' && quote.status !== 'pending') {
            return res.status(400).json({ message: 'Cannot reject bid on this quote' });
        }

        // Find and update the specific bid
        const bid = quote.bids.id(bidId);
        if (!bid) {
            return res.status(404).json({ message: 'Bid not found' });
        }

        if (bid.status !== 'pending') {
            return res.status(400).json({ message: 'Bid has already been decided' });
        }

        // Store bid amount before rejecting
        const rejectedBidAmount = bid.bidAmount;

        bid.status = 'rejected';
        await quote.save();

        // Check if all bids are rejected and no accepted; if so, set quote to 'rejected'
        const hasPendingBids = quote.bids.some(b => b.status === 'pending');
        const hasAcceptedBid = quote.bids.some(b => b.status === 'accepted');

        let allBidsRejected = false;
        if (!hasPendingBids && !hasAcceptedBid) {
            quote.status = 'rejected';
            allBidsRejected = true;
            await quote.save();
        }

        const populatedQuote = await RequestQuote.findById(quoteId)
            .populate("tasker", "firstName lastName email phone currentRole")
            .populate("client", "firstName lastName email phone currentRole");

        // FIX: Get client details from database
        const client = await User.findById(clientId).select('firstName lastName');
        const clientName = client
            ? `${client.firstName} ${client.lastName}`
            : "The client";

        // Get tasker details
        const taskerName = quote.tasker
            ? `${quote.tasker.firstName} ${quote.tasker.lastName}`
            : "The tasker";

        // Notification to tasker: bid rejected
        try {
            // Debug: Log notification details
            console.log("Creating bid rejected notification for tasker:", {
                taskerId: quote.tasker._id,
                clientName,
                bidAmount: rejectedBidAmount,
                quoteTaskTitle: quote.taskTitle,
                allBidsRejected
            });

            const notificationTitle = "❌ Bid Not Accepted";
            const notificationMessage = allBidsRejected
                ? `${clientName} has declined your bid of $${rejectedBidAmount} for "${quote.taskTitle}". The quote request has been closed. Don't be discouraged - keep bidding on other opportunities!`
                : `${clientName} has declined your bid of $${rejectedBidAmount} for "${quote.taskTitle}". You can submit a revised bid if you'd like to try again.`;

            await createNotification(
                quote.tasker._id,
                notificationTitle,
                notificationMessage,
                'quote-bid-rejected',
                quoteId
            );
            console.log("✅ Notification created for tasker - bid rejected");

        } catch (notifErr) {
            console.error("❌ Failed to create tasker notification (non-blocking):", notifErr);
        }

        // Send confirmation notification to client
        try {
            const confirmationMessage = allBidsRejected
                ? `You have declined all bids for "${quote.taskTitle}". The quote request has been closed. You can create a new quote request if needed.`
                : `You have declined ${taskerName}'s bid of $${rejectedBidAmount} for "${quote.taskTitle}". ${hasPendingBids ? 'You still have pending bids to review.' : 'The tasker can submit a new bid if interested.'}`;

            await createNotification(
                clientId,
                "Bid Rejection Confirmed",
                confirmationMessage,
                'quote-bid-reject-confirmed',
                quoteId
            );
            console.log("✅ Confirmation notification sent to client");

        } catch (notifErr) {
            console.error("❌ Failed to create client confirmation notification (non-blocking):", notifErr);
        }

        // If all bids rejected, prompt client to try another tasker
        if (allBidsRejected) {
            try {
                await createNotification(
                    clientId,
                    "🔍 Find Another Tasker?",
                    `All bids for "${quote.taskTitle}" have been declined. Would you like to request a quote from another tasker?`,
                    "find-tasker-prompt",
                    quoteId
                );
                console.log("✅ Find tasker prompt notification sent to client");

            } catch (notifErr) {
                console.error("❌ Failed to create find tasker prompt notification (non-blocking):", notifErr);
            }
        }

        res.status(200).json({ message: 'Bid rejected successfully', quote: populatedQuote });
    } catch (error) {
        console.error('Error rejecting bid:', error);
        res.status(500).json({ message: 'Server error' });
    }
};



// Update existing updateQuoteStatus to align with new statuses (tasker can still directly accept/reject without bidding)
// export const updateReqQuoteStatus = async (req, res) => {
//     try {
//         const { taskId } = req.params;
//         const { status } = req.body;
//         const taskerId = req.user.id; // From auth middleware

//         // Validate inputs
//         if (!mongoose.Types.ObjectId.isValid(taskId)) {
//             return res.status(400).json({ message: 'Invalid task ID' });
//         }
//         if (!status) {
//             return res.status(400).json({ message: 'Status is required' });
//         }

//         // Valid statuses (updated to match schema)
//         const validStatuses = ['accepted', 'rejected', 'completed'];
//         if (!validStatuses.includes(status)) {
//             return res.status(400).json({ message: `Invalid status value. Must be one of: ${validStatuses.join(', ')}` });
//         }

//         // Find task
//         const task = await RequestQuote.findById(taskId);
//         if (!task) {
//             return res.status(404).json({ message: 'Task not found' });
//         }

//         // Verify tasker
//         if (task.tasker.toString() !== taskerId) {
//             return res.status(403).json({ message: 'Unauthorized: You are not the assigned tasker' });
//         }

//         const previousStatus = task.status; // Track for notification
//         // Update status and updatedAt
//         task.status = status;
//         task.updatedAt = new Date();
//         await task.save();

//         // Populate tasker and client for response
//         const updatedTask = await RequestQuote.findById(taskId)
//             .populate('tasker', 'firstName lastName email phone role')
//             .populate('client', 'firstName lastName email phone role');

//         // Create notification for the client (status updated) - non-blocking
//         try {
//             const tasker = await User.findById(taskerId).select("firstName lastName");
//             await createNotification(
//                 task.client, // Client ID
//                 "Quote Status Updated",
//                 `Tasker "${tasker.firstName} ${tasker.lastName}" updated the status of your quote request "${task.taskTitle}" to "${status}" (from "${previousStatus}").`,
//                 "quote-status-updated",
//                 taskId // Link to quote request
//             );
//             console.log("Notification created for quote status update"); // Debug
//         } catch (notifErr) {
//             console.error("Failed to create notification (non-blocking):", notifErr); // Log but don't crash
//         }

//         res.status(200).json({ message: 'Task status updated successfully', task: updatedTask });
//     } catch (error) {
//         console.error('Error updating task status:', error);
//         res.status(500).json({ message: 'Server error while updating task status', error: error.message });
//     }
// };

export const updateReqQuoteStatus = async (req, res) => {
    try {
        const { taskId } = req.params;
        const { status } = req.body;
        const taskerId = req.user.id; // From auth middleware

        // Validate inputs
        if (!mongoose.Types.ObjectId.isValid(taskId)) {
            return res.status(400).json({ message: 'Invalid task ID' });
        }
        if (!status) {
            return res.status(400).json({ message: 'Status is required' });
        }

        // Valid statuses (updated to match schema)
        const validStatuses = ['accepted', 'rejected', 'completed'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ message: `Invalid status value. Must be one of: ${validStatuses.join(', ')}` });
        }

        // Find task with populated data
        const task = await RequestQuote.findById(taskId)
            .populate("tasker", "firstName lastName email")
            .populate("client", "firstName lastName email");

        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }

        // Verify tasker
        if (task.tasker._id.toString() !== taskerId) {
            return res.status(403).json({ message: 'Unauthorized: You are not the assigned tasker' });
        }

        // Track previous status for notification
        const previousStatus = task.status;

        // Update status and updatedAt
        task.status = status;
        task.updatedAt = new Date();
        await task.save();

        // Populate tasker and client for response
        const updatedTask = await RequestQuote.findById(taskId)
            .populate('tasker', 'firstName lastName email phone role')
            .populate('client', 'firstName lastName email phone role');

        // FIX: Get tasker details from database
        const tasker = await User.findById(taskerId).select("firstName lastName");
        const taskerName = tasker
            ? `${tasker.firstName} ${tasker.lastName}`
            : "The tasker";

        // Get client details
        const clientName = task.client
            ? `${task.client.firstName} ${task.client.lastName}`
            : "The client";

        // Format budget for notifications
        const formattedBudget = task.budget ? `$${task.budget}` : "Negotiable";

        // Format preferred date for notifications if exists
        const formattedDate = task.preferredDateTime
            ? new Date(task.preferredDateTime).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            })
            : "Flexible";

        // Build status-specific notification content
        let clientNotificationTitle = "Quote Status Updated";
        let clientNotificationMessage = "";
        let clientNotificationType = "quote-status-updated";

        let taskerNotificationTitle = "Status Update Confirmed";
        let taskerNotificationMessage = "";

        switch (status) {
            case "accepted":
                clientNotificationTitle = "🎉 Your Quote Request Was Accepted!";
                clientNotificationMessage = `Great news! ${taskerName} has accepted your quote request for "${task.taskTitle}". Budget: ${formattedBudget}, Preferred Date: ${formattedDate}. You can now proceed to book the service or discuss details further.`;
                clientNotificationType = "quote-accepted";

                taskerNotificationTitle = "✅ Quote Acceptance Confirmed";
                taskerNotificationMessage = `You have accepted the quote request for "${task.taskTitle}" from ${clientName}. Budget: ${formattedBudget}, Location: ${task.location}. The client has been notified and can now book your service.`;
                break;

            case "rejected":
                clientNotificationTitle = "❌ Quote Request Declined";
                clientNotificationMessage = `Unfortunately, ${taskerName} is unable to accept your quote request for "${task.taskTitle}" at this time. Don't worry - you can request a quote from another tasker who may be available.`;
                clientNotificationType = "quote-rejected";

                taskerNotificationTitle = "Quote Rejection Confirmed";
                taskerNotificationMessage = `You have declined the quote request for "${task.taskTitle}" from ${clientName}. The client has been notified and may seek another tasker.`;
                break;

            case "completed":
                clientNotificationTitle = "🎉 Quote Request Completed!";
                clientNotificationMessage = `${taskerName} has marked your quote request for "${task.taskTitle}" as completed. We hope you had a great experience! Please leave a review to help others find quality service.`;
                clientNotificationType = "quote-completed";

                taskerNotificationTitle = "✅ Quote Marked as Completed";
                taskerNotificationMessage = `You have successfully completed the quote request for "${task.taskTitle}" with ${clientName}. Great job! The client will be prompted to leave a review.`;
                break;

            default:
                clientNotificationMessage = `${taskerName} updated the status of your quote request for "${task.taskTitle}" from "${previousStatus}" to "${status}".`;
                taskerNotificationMessage = `You updated the quote status for "${task.taskTitle}" to "${status}".`;
        }

        // Create notification for the client
        try {
            // Debug: Log notification details
            console.log("Creating quote status update notification for client:", {
                clientId: task.client._id,
                taskerName,
                status,
                previousStatus,
                taskTitle: task.taskTitle,
                budget: formattedBudget
            });

            await createNotification(
                task.client._id, // Client ID
                clientNotificationTitle,
                clientNotificationMessage,
                clientNotificationType,
                taskId
            );
            console.log("✅ Notification created for client - quote status update");

        } catch (notifErr) {
            console.error("❌ Failed to create client notification (non-blocking):", notifErr);
        }

        // Send confirmation notification to tasker
        try {
            await createNotification(
                taskerId, // Tasker ID
                taskerNotificationTitle,
                taskerNotificationMessage,
                "quote-status-update-confirmed",
                taskId
            );
            console.log("✅ Confirmation notification sent to tasker");

        } catch (notifErr) {
            console.error("❌ Failed to create tasker confirmation notification (non-blocking):", notifErr);
        }

        // Additional status-specific prompts and notifications
        if (status === "accepted") {
            // Prompt client to book or schedule
            try {
                await createNotification(
                    task.client._id,
                    "📅 Ready to Book?",
                    `${taskerName} has accepted your quote for "${task.taskTitle}". Click here to book their service now and secure your preferred date!`,
                    "booking-prompt",
                    taskId
                );
                console.log("✅ Booking prompt notification sent to client");

            } catch (notifErr) {
                console.error("❌ Failed to create booking prompt notification (non-blocking):", notifErr);
            }

            // Send availability reminder to tasker
            try {
                await createNotification(
                    taskerId,
                    "📋 Service Preparation",
                    `You've accepted the quote for "${task.taskTitle}". Make sure you're available on ${formattedDate} or coordinate with ${clientName} for scheduling.`,
                    "service-preparation",
                    taskId
                );
                console.log("✅ Service preparation notification sent to tasker");

            } catch (notifErr) {
                console.error("❌ Failed to create service preparation notification (non-blocking):", notifErr);
            }

        } else if (status === "completed") {
            // Prompt client for review
            try {
                await createNotification(
                    task.client._id,
                    "⭐ Leave a Review",
                    `How was your experience with ${taskerName} for "${task.taskTitle}"? Your feedback helps others find great taskers and helps taskers improve their services!`,
                    "review-prompt",
                    taskId
                );
                console.log("✅ Review prompt notification sent to client");

            } catch (notifErr) {
                console.error("❌ Failed to create review prompt notification (non-blocking):", notifErr);
            }

            // Send thank you and earnings notification to tasker
            try {
                const earningsMessage = task.budget
                    ? `You've successfully completed "${task.taskTitle}" for ${clientName}. Your earnings of ${formattedBudget} will be processed. Thank you for providing excellent service!`
                    : `You've successfully completed "${task.taskTitle}" for ${clientName}. Thank you for providing excellent service!`;

                await createNotification(
                    taskerId,
                    "💪 Great Work Completed!",
                    earningsMessage,
                    "quote-work-completed",
                    taskId
                );
                console.log("✅ Work completed notification sent to tasker");

            } catch (notifErr) {
                console.error("❌ Failed to create work completed notification (non-blocking):", notifErr);
            }

        } else if (status === "rejected") {
            // Prompt client to find another tasker
            try {
                await createNotification(
                    task.client._id,
                    "🔍 Find Another Tasker",
                    `Your quote request for "${task.taskTitle}" was declined. Would you like to browse other available taskers or post your request to multiple taskers?`,
                    "find-tasker-prompt",
                    taskId
                );
                console.log("✅ Find tasker prompt notification sent to client");

            } catch (notifErr) {
                console.error("❌ Failed to create find tasker prompt notification (non-blocking):", notifErr);
            }
        }

        res.status(200).json({ message: 'Task status updated successfully', task: updatedTask });
    } catch (error) {
        console.error('Error updating task status:', error);
        res.status(500).json({ message: 'Server error while updating task status', error: error.message });
    }
};




export { createBooking, getAllBookings, getBookingsByUserId, updateBooking, deleteBooking, createRequestQuote, getAllRequestQuotes, getRequestQuotesByClientId, updateRequestQuote, deleteRequestQuote, };