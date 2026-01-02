import Stripe from 'stripe';
import mongoose from "mongoose";
import BookingTasker from "../models/bookingTasker.js";
import RequestQuote from "../models/requestQuote.js";
import User from "../models/user.js";
import { createNotification } from "./notificationHelper.js";
import { validateTaskerCanReceivePayments, calculateFees } from "../utils/stripeConnect.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Create Booking







//  const createBooking = async (req, res) => {
//     try {
//         console.log('=== CREATE BOOKING REQUEST ===');
//         console.log('Raw Request Body:', JSON.stringify(req.body, null, 2));

//         const { taskerId, service, date, dayOfWeek } = req.body;
//         const clientId = req.user?.id;

//         // ==================== BASIC VALIDATIONS ====================

//         if (!clientId) {
//             console.log('No clientId found in req.user');
//             return res.status(401).json({ message: "Unauthorized: User not authenticated" });
//         }

//         if (!mongoose.Types.ObjectId.isValid(taskerId) || !mongoose.Types.ObjectId.isValid(clientId)) {
//             return res.status(400).json({ message: "Invalid tasker or client ID" });
//         }

//         if (!service || !service.title || !service.description || !service.hourlyRate || !service.estimatedDuration) {
//             return res.status(400).json({ message: "Service details are required" });
//         }

//         if (!date) {
//             console.log('Date missing in request body');
//             return res.status(400).json({ message: "Booking date and time are required" });
//         }

//         // ==================== VALIDATE USERS ====================

//         const tasker = await User.findById(taskerId);
//         if (!tasker || tasker.currentRole !== "tasker") {
//             return res.status(400).json({ message: "Tasker not found or invalid role" });
//         }

//         const client = await User.findById(clientId);
//         if (!client || client.currentRole !== "client") {
//             return res.status(400).json({ message: "Client not found or invalid role" });
//         }

//         // ==================== VALIDATE TASKER CAN RECEIVE PAYMENTS ====================

//         let taskerStripeAccountId;
//         try {
//             taskerStripeAccountId = await validateTaskerCanReceivePayments(taskerId);
//             console.log('✅ Tasker Stripe Connect validated:', taskerStripeAccountId);
//         } catch (connectError) {
//             console.error('❌ Tasker payment validation failed:', connectError.message);
//             return res.status(400).json({
//                 message: connectError.message,
//                 code: 'TASKER_PAYMENT_NOT_SETUP',
//                 action: 'The tasker needs to complete their payment setup before accepting bookings.'
//             });
//         }

//         // ==================== VALIDATE CLIENT PAYMENT METHOD ====================

//         if (!client.stripeCustomerId) {
//             return res.status(400).json({
//                 message: 'Please add a payment method first',
//                 code: 'NO_CUSTOMER_ID',
//                 action: 'Add a credit or debit card to proceed with booking.'
//             });
//         }

//         if (!client.defaultPaymentMethod) {
//             return res.status(400).json({
//                 message: 'No saved payment method. Please add one.',
//                 code: 'NO_PAYMENT_METHOD',
//                 action: 'Add a credit or debit card to proceed with booking.'
//             });
//         }

//         // Verify payment method is valid and attached to customer
//         let customerId = client.stripeCustomerId;
//         let paymentMethodId = client.defaultPaymentMethod;

//         try {
//             const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);

//             console.log("=== PAYMENT METHOD DEBUG ===");
//             console.log("Payment Method ID:", paymentMethodId);
//             console.log("Payment Method belongs to customer:", paymentMethod.customer);
//             console.log("User's stored stripeCustomerId:", customerId);

//             if (!paymentMethod.customer) {
//                 return res.status(400).json({
//                     message: 'Payment method is not properly set up. Please re-add your card.',
//                     code: 'PAYMENT_METHOD_NOT_ATTACHED'
//                 });
//             }

//             // Fix customer ID mismatch if needed
//             if (paymentMethod.customer !== customerId) {
//                 console.log(`⚠️ MISMATCH! Updating customer ID from ${customerId} to ${paymentMethod.customer}`);
//                 client.stripeCustomerId = paymentMethod.customer;
//                 await client.save();
//                 customerId = paymentMethod.customer;
//             }
//         } catch (pmError) {
//             console.error("Error verifying payment method:", pmError);
//             client.defaultPaymentMethod = null;
//             await client.save();
//             return res.status(400).json({
//                 message: 'Your saved payment method is invalid or expired. Please add a new card.',
//                 code: 'INVALID_PAYMENT_METHOD'
//             });
//         }

//         // ==================== PARSE AND VALIDATE DATE ====================

//         const bookingDate = new Date(date);
//         console.log('Parsed bookingDate:', bookingDate, 'ISO:', bookingDate.toISOString());

//         if (isNaN(bookingDate.getTime())) {
//             console.log('Invalid date format:', date);
//             return res.status(400).json({ message: "Invalid date format" });
//         }

//         // Check if booking is in the past
//         if (bookingDate < new Date()) {
//             return res.status(400).json({ message: "Cannot book a time in the past" });
//         }

//         // ==================== VALIDATE AVAILABILITY ====================

//         let dayName;

//         if (dayOfWeek) {
//             dayName = dayOfWeek;
//             console.log('Using dayOfWeek from frontend:', dayName);
//         } else {
//             const dateParts = date.split('T')[0].split('-');
//             const year = parseInt(dateParts[0]);
//             const month = parseInt(dateParts[1]) - 1;
//             const day = parseInt(dateParts[2]);
//             const localDate = new Date(year, month, day);
//             dayName = getDayNameFromDate(localDate);
//             console.log('Calculated dayName from date parts:', dayName);
//         }

//         console.log('Final dayName for availability check:', dayName);
//         console.log('Tasker availability:', tasker.availability?.map(a => a.day));

//         if (!tasker.availability || tasker.availability.length === 0) {
//             return res.status(400).json({
//                 message: "Tasker has not set their availability",
//             });
//         }

//         const availability = tasker.availability.find(slot =>
//             slot.day.toLowerCase() === dayName.toLowerCase()
//         );

//         if (!availability) {
//             return res.status(400).json({
//                 message: `Tasker is not available on ${dayName}`,
//                 debug: {
//                     requestedDay: dayName,
//                     availableDays: tasker.availability.map(a => a.day),
//                     receivedDate: date,
//                     receivedDayOfWeek: dayOfWeek
//                 }
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

//         console.log('Booking time:', hours, ':', minutes);

//         const [startHour, startMinute] = availability.from.split(':').map(Number);
//         const [endHour, endMinute] = availability.to.split(':').map(Number);
//         const bookingTimeInMinutes = hours * 60 + minutes;
//         const startTimeInMinutes = startHour * 60 + startMinute;
//         const endTimeInMinutes = endHour * 60 + endMinute;

//         console.log('Time check:', {
//             bookingTime: bookingTimeInMinutes,
//             startTime: startTimeInMinutes,
//             endTime: endTimeInMinutes
//         });

//         if (bookingTimeInMinutes < startTimeInMinutes || bookingTimeInMinutes >= endTimeInMinutes) {
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
//             date: {
//                 $gte: startOfDay,
//                 $lte: endOfDay
//             },
//             status: { $in: ['pending', 'confirmed'] }
//         });

//         if (existingBooking) {
//             const existingTime = new Date(existingBooking.date);
//             const existingHours = existingTime.getHours();
//             const existingMinutes = existingTime.getMinutes();

//             // Check if times overlap (simple check - same hour)
//             if (Math.abs(hours - existingHours) < 1) {
//                 return res.status(400).json({
//                     message: "This time slot is already booked. Please choose another time."
//                 });
//             }
//         }

//         // ==================== CALCULATE PAYMENT AMOUNTS ====================

//         const amountInCents = Math.round(service.hourlyRate * 100);
//         const { platformFee, taskerPayout } = calculateFees(amountInCents);

//         console.log("💰 Booking payment breakdown:");
//         console.log("  Service Rate: $", service.hourlyRate);
//         console.log("  Amount in cents:", amountInCents);
//         console.log("  Platform Fee (15%): $", platformFee / 100);
//         console.log("  Tasker Payout (85%): $", taskerPayout / 100);
//         console.log("  Tasker Stripe Account:", taskerStripeAccountId);

//         // ==================== CREATE PAYMENT INTENT WITH STRIPE CONNECT ====================

//         let paymentIntent;
//         try {
//             paymentIntent = await stripe.paymentIntents.create({
//                 amount: amountInCents,
//                 currency: 'cad',
//                 customer: customerId,
//                 payment_method: paymentMethodId,
//                 capture_method: 'manual',  // HOLD - don't capture until service is completed
//                 description: `Booking: ${service.title} with ${tasker.firstName} ${tasker.lastName}`,

//                 // ⭐ STRIPE CONNECT - Automatic split
//                 application_fee_amount: platformFee,  // 15% goes to Taskallo
//                 transfer_data: {
//                     destination: taskerStripeAccountId,  // 85% goes to Tasker
//                 },

//                 metadata: {
//                     type: 'booking',
//                     taskerId: taskerId.toString(),
//                     clientId: clientId.toString(),
//                     taskerName: `${tasker.firstName} ${tasker.lastName}`,
//                     clientName: `${client.firstName} ${client.lastName}`,
//                     serviceTitle: service.title,
//                     serviceRate: service.hourlyRate.toString(),
//                     platformFee: platformFee.toString(),
//                     taskerPayout: taskerPayout.toString(),
//                     bookingDate: bookingDate.toISOString(),
//                 },

//                 automatic_payment_methods: {
//                     enabled: true,
//                     allow_redirects: 'never'
//                 },
//                 confirm: true,  // Confirm immediately
//             });

//             console.log("✅ PaymentIntent created:", paymentIntent.id);
//             console.log("   Status:", paymentIntent.status);

//         } catch (stripeError) {
//             console.error("❌ Stripe PaymentIntent creation failed:", stripeError);

//             // Handle specific Stripe errors
//             if (stripeError.type === 'StripeCardError') {
//                 return res.status(400).json({
//                     message: stripeError.message,
//                     code: 'CARD_ERROR',
//                     decline_code: stripeError.decline_code
//                 });
//             }

//             if (stripeError.code === 'insufficient_funds') {
//                 return res.status(400).json({
//                     message: 'Insufficient funds on your card. Please try another card.',
//                     code: 'INSUFFICIENT_FUNDS'
//                 });
//             }

//             return res.status(400).json({
//                 message: 'Payment authorization failed. Please try again.',
//                 code: 'PAYMENT_FAILED',
//                 error: stripeError.message
//             });
//         }

//         // Verify payment was authorized (held)
//         if (paymentIntent.status !== 'requires_capture') {
//             console.error("❌ Unexpected payment status:", paymentIntent.status);

//             // Try to cancel the payment intent
//             try {
//                 await stripe.paymentIntents.cancel(paymentIntent.id);
//             } catch (e) {
//                 console.error("Could not cancel PaymentIntent:", e);
//             }

//             return res.status(400).json({
//                 message: 'Payment authorization failed',
//                 code: 'AUTHORIZATION_FAILED',
//                 error: paymentIntent.last_payment_error?.message || 'Unknown error'
//             });
//         }

//         // ==================== CREATE BOOKING ====================

//         console.log('Creating Booking with:', {
//             tasker: taskerId,
//             client: clientId,
//             service: service.title,
//             date: bookingDate,
//             paymentIntentId: paymentIntent.id,
//             status: "confirmed"
//         });

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

//             // Payment Info (backward compatible)
//             paymentIntentId: paymentIntent.id,
//             stripeStatus: 'authorized',
//             paymentMethod: paymentMethodId,

//             // ⭐ NEW: Detailed payment breakdown
//             payment: {
//                 paymentIntentId: paymentIntent.id,
//                 status: 'held',
//                 grossAmount: amountInCents,
//                 platformFee: platformFee,
//                 taskerPayout: taskerPayout,
//                 currency: 'cad',
//                 authorizedAt: new Date(),
//             },

//             // Payment details for records
//             paymentDetails: {
//                 amountCaptured: 0,  // Will be updated when captured
//                 currency: 'cad',
//                 paymentMethodType: 'card',
//                 billingDetails: {
//                     name: `${client.firstName} ${client.lastName}`,
//                     email: client.email,
//                     phone: client.phone,
//                 }
//             },
//         });

//         await booking.save();
//         console.log("✅ Booking saved:", booking._id);

//         // ==================== POPULATE BOOKING FOR RESPONSE ====================

//         const populatedBooking = await BookingTasker.findById(booking._id)
//             .populate("tasker", "firstName lastName email phone profilePicture currentRole rating reviewCount")
//             .populate("client", "firstName lastName email phone profilePicture currentRole");

//         // ==================== SEND NOTIFICATIONS ====================

//         const clientName = `${client.firstName} ${client.lastName}`;
//         const taskerName = `${tasker.firstName} ${tasker.lastName}`;
//         const taskerPayoutFormatted = (taskerPayout / 100).toFixed(2);
//         const serviceAmount = service.hourlyRate.toFixed(2);

//         // Format date for notifications
//         const formattedDate = bookingDate.toLocaleDateString('en-US', {
//             weekday: 'long',
//             year: 'numeric',
//             month: 'long',
//             day: 'numeric',
//             hour: '2-digit',
//             minute: '2-digit'
//         });

//         // Notification for tasker
//         try {
//             await createNotification(
//                 taskerId,
//                 "🎉 New Confirmed Booking!",
//                 `${clientName} has booked your service "${service.title}" on ${formattedDate}. Payment of $${serviceAmount} is held securely. You'll receive $${taskerPayoutFormatted} when the service is completed.`,
//                 "booking-confirmed",
//                 booking._id
//             );
//             console.log("✅ Notification sent to tasker");
//         } catch (notifErr) {
//             console.error("❌ Tasker notification failed:", notifErr);
//         }

//         // Notification for client
//         try {
//             await createNotification(
//                 clientId,
//                 "✅ Booking Confirmed!",
//                 `Your booking for "${service.title}" with ${taskerName} on ${formattedDate} has been confirmed. A hold of $${serviceAmount} has been placed on your card and will be charged when the service is completed.`,
//                 "booking-confirmed",
//                 booking._id
//             );
//             console.log("✅ Notification sent to client");
//         } catch (notifErr) {
//             console.error("❌ Client notification failed:", notifErr);
//         }

//         // ==================== SEND RESPONSE ====================

//         res.status(201).json({
//             success: true,
//             message: "Booking created and confirmed successfully",
//             booking: populatedBooking,
//             paymentBreakdown: {
//                 total: service.hourlyRate,
//                 totalInCents: amountInCents,
//                 platformFee: platformFee / 100,
//                 platformFeeInCents: platformFee,
//                 taskerPayout: taskerPayout / 100,
//                 taskerPayoutInCents: taskerPayout,
//                 currency: 'cad',
//                 status: 'held',  // Money is held, not captured yet
//             },
//             paymentInfo: {
//                 paymentIntentId: paymentIntent.id,
//                 status: paymentIntent.status,
//                 message: 'Payment is authorized and held. It will be captured when the service is completed.',
//             }
//         });

//     } catch (error) {
//         console.error("❌ Error creating booking:", error);

//         // If it's a validation error, return specific message
//         if (error.name === 'ValidationError') {
//             const messages = Object.values(error.errors).map(e => e.message);
//             return res.status(400).json({
//                 message: messages.join(', '),
//                 code: 'VALIDATION_ERROR'
//             });
//         }

//         res.status(500).json({
//             message: "Server error while creating booking",
//             error: process.env.NODE_ENV === 'development' ? error.message : undefined
//         });
//     }
// };



// Fee constants
const PLATFORM_FEE_PERCENT = 0.15;  // 15%
const TAX_PERCENT = 0.13;           // 13% HST

const calculateDoubleSidedFees = (bidAmountInCents) => {
    const clientPlatformFee = Math.round(bidAmountInCents * PLATFORM_FEE_PERCENT);
    const taxOnClientFee = Math.round(clientPlatformFee * TAX_PERCENT);
    const totalClientPays = bidAmountInCents + clientPlatformFee + taxOnClientFee;
    const taskerPlatformFee = Math.round(bidAmountInCents * PLATFORM_FEE_PERCENT);
    const taskerPayout = bidAmountInCents - taskerPlatformFee;
    const applicationFee = totalClientPays - taskerPayout;

    return {
        bidAmountInCents,
        clientPlatformFee,
        taxOnClientFee,
        totalClientPays,
        taskerPlatformFee,
        taskerPayout,
        applicationFee
    };
};

// const createBooking = async (req, res) => {

//     let paymentIntent = null;

//     try {
//         console.log('=== CREATE BOOKING REQUEST ===');
//         console.log('Raw Request Body:', JSON.stringify(req.body, null, 2));

//         const { taskerId, service, date, dayOfWeek, paymentMethodId: providedPaymentMethodId } = req.body;
//         const clientId = req.user?.id;

//         // ==================== BASIC VALIDATIONS ====================

//         if (!clientId) {
//             return res.status(401).json({ message: "Unauthorized: User not authenticated" });
//         }

//         if (!mongoose.Types.ObjectId.isValid(taskerId) || !mongoose.Types.ObjectId.isValid(clientId)) {
//             return res.status(400).json({ message: "Invalid tasker or client ID" });
//         }

//         if (!service || !service.title || !service.description || !service.hourlyRate || !service.estimatedDuration) {
//             return res.status(400).json({ message: "Service details are required" });
//         }

//         if (!date) {
//             return res.status(400).json({ message: "Booking date and time are required" });
//         }

//         // ==================== VALIDATE USERS ====================

//         const tasker = await User.findById(taskerId);
//         if (!tasker || tasker.currentRole !== "tasker") {
//             return res.status(400).json({ message: "Tasker not found or invalid role" });
//         }

//         const client = await User.findById(clientId);
//         if (!client || client.currentRole !== "client") {
//             return res.status(400).json({ message: "Client not found or invalid role" });
//         }

//         // ==================== VALIDATE TASKER CAN RECEIVE PAYMENTS ====================

//         let taskerStripeAccountId;
//         try {
//             taskerStripeAccountId = await validateTaskerCanReceivePayments(taskerId);
//             console.log('✅ Tasker Stripe Connect validated:', taskerStripeAccountId);
//         } catch (connectError) {
//             return res.status(400).json({
//                 message: connectError.message,
//                 code: 'TASKER_PAYMENT_NOT_SETUP',
//             });
//         }

//         // ==================== ⭐ HANDLE PAYMENT METHOD ====================

//         let paymentMethodId = providedPaymentMethodId;
//         let customerId = client.stripeCustomerId;

//         console.log("=== PAYMENT METHOD DEBUG ===");
//         console.log("Provided Payment Method ID:", providedPaymentMethodId);
//         console.log("Client's stored stripeCustomerId:", customerId);
//         console.log("Client's stored defaultPaymentMethod:", client.defaultPaymentMethod);
//         console.log("Client's stored defaultPaymentMethodId:", client.defaultPaymentMethodId);

//         // If no payment method provided, try to use the saved one
//         if (!paymentMethodId) {
//             paymentMethodId = client.defaultPaymentMethod || client.defaultPaymentMethodId;
//         }

//         if (!paymentMethodId) {
//             return res.status(400).json({
//                 message: 'No payment method provided. Please add a card.',
//                 code: 'NO_PAYMENT_METHOD',
//             });
//         }

//         // ⭐ STEP 1: Ensure we have a Stripe Customer
//         if (!customerId) {
//             console.log("Creating new Stripe Customer for client...");
//             try {
//                 const customer = await stripe.customers.create({
//                     email: client.email,
//                     name: `${client.firstName} ${client.lastName}`,
//                     metadata: {
//                         userId: client._id.toString(),
//                         platform: 'taskallo'
//                     }
//                 });
//                 customerId = customer.id;
//                 client.stripeCustomerId = customerId;
//                 await client.save();
//                 console.log("✅ Created new Stripe Customer:", customerId);
//             } catch (customerError) {
//                 console.error("❌ Failed to create Stripe Customer:", customerError);
//                 return res.status(400).json({
//                     message: 'Failed to set up payment. Please try again.',
//                     code: 'CUSTOMER_CREATION_FAILED',
//                 });
//             }
//         }

//         // ⭐ STEP 2: Retrieve and validate payment method
//         let paymentMethod;
//         try {
//             paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
//             console.log("✅ Payment method retrieved:", paymentMethodId);
//             console.log("   Type:", paymentMethod.type);
//             console.log("   Card brand:", paymentMethod.card?.brand);
//             console.log("   Last 4:", paymentMethod.card?.last4);
//             console.log("   Attached to customer:", paymentMethod.customer);
//         } catch (pmRetrieveError) {
//             console.error("❌ Failed to retrieve payment method:", pmRetrieveError);

//             // Clear invalid payment method from client record
//             client.defaultPaymentMethod = null;
//             client.defaultPaymentMethodId = null;
//             await client.save();

//             return res.status(400).json({
//                 message: 'Payment method not found or invalid. Please add a new card.',
//                 code: 'PAYMENT_METHOD_NOT_FOUND',
//                 debug: process.env.NODE_ENV === 'development' ? {
//                     providedId: paymentMethodId,
//                     error: pmRetrieveError.message
//                 } : undefined
//             });
//         }

//         // ⭐ STEP 3: Attach payment method to customer if not already attached
//         if (!paymentMethod.customer) {
//             console.log("Payment method not attached to any customer. Attaching...");
//             try {
//                 await stripe.paymentMethods.attach(paymentMethodId, {
//                     customer: customerId,
//                 });
//                 console.log("✅ Payment method attached to customer:", customerId);
//             } catch (attachError) {
//                 console.error("❌ Failed to attach payment method:", attachError);

//                 // If attachment fails, the payment method might already be attached elsewhere
//                 if (attachError.code === 'resource_already_exists') {
//                     console.log("Payment method already attached to another customer");
//                 }

//                 return res.status(400).json({
//                     message: 'Failed to set up payment method. Please try a different card.',
//                     code: 'PAYMENT_METHOD_ATTACH_FAILED',
//                 });
//             }
//         } else if (paymentMethod.customer !== customerId) {
//             // Payment method attached to different customer - update our records
//             console.log(`⚠️ Payment method attached to different customer: ${paymentMethod.customer}`);
//             console.log(`   Updating client's stripeCustomerId from ${customerId} to ${paymentMethod.customer}`);
//             customerId = paymentMethod.customer;
//             client.stripeCustomerId = customerId;
//         }

//         // ⭐ STEP 4: Update client's payment records
//         client.stripeCustomerId = customerId;
//         client.defaultPaymentMethod = paymentMethodId;
//         client.defaultPaymentMethodId = paymentMethodId;
//         await client.save();
//         console.log("✅ Client payment info updated");

//         // ==================== PARSE AND VALIDATE DATE ====================

//         const bookingDate = new Date(date);
//         console.log('Parsed bookingDate:', bookingDate, 'ISO:', bookingDate.toISOString());

//         if (isNaN(bookingDate.getTime())) {
//             return res.status(400).json({ message: "Invalid date format" });
//         }

//         if (bookingDate < new Date()) {
//             return res.status(400).json({ message: "Cannot book a time in the past" });
//         }

//         // ==================== VALIDATE AVAILABILITY ====================

//         let dayName;

//         if (dayOfWeek) {
//             dayName = dayOfWeek;
//         } else {
//             const dateParts = date.split('T')[0].split('-');
//             const year = parseInt(dateParts[0]);
//             const month = parseInt(dateParts[1]) - 1;
//             const day = parseInt(dateParts[2]);
//             const localDate = new Date(year, month, day);
//             dayName = getDayNameFromDate(localDate);
//         }

//         console.log('Final dayName for availability check:', dayName);

//         if (!tasker.availability || tasker.availability.length === 0) {
//             return res.status(400).json({
//                 message: "Tasker has not set their availability",
//             });
//         }

//         const availability = tasker.availability.find(slot =>
//             slot.day.toLowerCase() === dayName.toLowerCase()
//         );

//         if (!availability) {
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
//                 return res.status(400).json({
//                     message: "This time slot is already booked. Please choose another time."
//                 });
//             }
//         }

//         // ==================== CALCULATE DOUBLE-SIDED FEES ====================

//         const serviceAmountInCents = Math.round(service.hourlyRate * 100);
//         const fees = calculateDoubleSidedFees(serviceAmountInCents);

//         console.log("💰 DOUBLE-SIDED FEE Booking Payment Breakdown:");
//         console.log(`   Service Rate:         $${(serviceAmountInCents / 100).toFixed(2)}`);
//         console.log(`   Client Fee (15%):     $${(fees.clientPlatformFee / 100).toFixed(2)}`);
//         console.log(`   Tax (13% HST):        $${(fees.taxOnClientFee / 100).toFixed(2)}`);
//         console.log(`   TOTAL CLIENT PAYS:    $${(fees.totalClientPays / 100).toFixed(2)}`);
//         console.log(`   Tasker Fee (15%):    -$${(fees.taskerPlatformFee / 100).toFixed(2)}`);
//         console.log(`   TASKER RECEIVES:      $${(fees.taskerPayout / 100).toFixed(2)}`);
//         console.log(`   PLATFORM KEEPS:       $${(fees.applicationFee / 100).toFixed(2)}`);

//         if (fees.totalClientPays < 50) {
//             return res.status(400).json({
//                 message: 'Minimum service amount is $0.50 CAD',
//                 code: 'AMOUNT_TOO_SMALL'
//             });
//         }

//         // ==================== CREATE PAYMENT INTENT ====================

//         console.log("Creating PaymentIntent...");
//         console.log("   Customer ID:", customerId);
//         console.log("   Payment Method ID:", paymentMethodId);
//         console.log("   Amount:", fees.totalClientPays);
//         console.log("   Application Fee:", fees.applicationFee);
//         console.log("   Destination:", taskerStripeAccountId);

//         try {
//             paymentIntent = await stripe.paymentIntents.create({
//                 amount: fees.totalClientPays,
//                 currency: 'cad',
//                 customer: customerId,
//                 payment_method: paymentMethodId,
//                 capture_method: 'manual',

//                 description: `Booking: ${service.title} with ${tasker.firstName} ${tasker.lastName}`,

//                 application_fee_amount: fees.applicationFee,

//                 transfer_data: {
//                     destination: taskerStripeAccountId,
//                 },

//                 metadata: {
//                     type: 'booking',
//                     taskerId: taskerId.toString(),
//                     clientId: clientId.toString(),
//                     serviceTitle: service.title,
//                     serviceRate: (serviceAmountInCents / 100).toString(),
//                     totalClientPays: (fees.totalClientPays / 100).toString(),
//                     taskerPayout: (fees.taskerPayout / 100).toString(),
//                     feeStructure: 'double-sided-15-percent',
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
//             console.error("❌ Stripe PaymentIntent creation failed:", stripeError);
//             console.error("   Error code:", stripeError.code);
//             console.error("   Error type:", stripeError.type);
//             console.error("   Error message:", stripeError.message);

//             if (stripeError.type === 'StripeCardError') {
//                 return res.status(400).json({
//                     message: stripeError.message,
//                     code: 'CARD_ERROR',
//                     decline_code: stripeError.decline_code
//                 });
//             }

//             if (stripeError.code === 'payment_method_not_attached') {
//                 return res.status(400).json({
//                     message: 'Payment method is not properly set up. Please re-add your card.',
//                     code: 'PAYMENT_METHOD_NOT_ATTACHED'
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

//             return res.status(400).json({
//                 message: 'Payment authorization failed',
//                 code: 'AUTHORIZATION_FAILED',
//                 error: paymentIntent.last_payment_error?.message || 'Unknown error'
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
//                 feeStructure: 'double-sided-15-percent',

//                 serviceAmountCents: serviceAmountInCents,
//                 clientPlatformFeeCents: fees.clientPlatformFee,
//                 taxOnClientFeeCents: fees.taxOnClientFee,
//                 totalClientPaysCents: fees.totalClientPays,
//                 taskerPlatformFeeCents: fees.taskerPlatformFee,
//                 taskerPayoutCents: fees.taskerPayout,
//                 applicationFeeCents: fees.applicationFee,

//                 serviceAmount: serviceAmountInCents / 100,
//                 clientPlatformFee: fees.clientPlatformFee / 100,
//                 taxOnClientFee: fees.taxOnClientFee / 100,
//                 totalClientPays: fees.totalClientPays / 100,
//                 taskerPlatformFee: fees.taskerPlatformFee / 100,
//                 taskerPayout: fees.taskerPayout / 100,
//                 applicationFee: fees.applicationFee / 100,
//             },

//             paymentDetails: {
//                 amountCaptured: 0,
//                 currency: 'cad',
//                 paymentMethodType: 'card',
//                 billingDetails: {
//                     name: `${client.firstName} ${client.lastName}`,
//                     email: client.email,
//                     phone: client.phone,
//                 }
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

//             return res.status(500).json({
//                 message: 'Failed to save booking. Payment was not charged.',
//                 code: 'DATABASE_ERROR'
//             });
//         }

//         // ==================== POPULATE AND RESPOND ====================

//         const populatedBooking = await BookingTasker.findById(booking._id)
//             .populate("tasker", "firstName lastName email phone profilePicture currentRole rating reviewCount")
//             .populate("client", "firstName lastName email phone profilePicture currentRole");

//         // Send notifications (non-blocking)
//         const clientName = `${client.firstName} ${client.lastName}`;
//         const taskerName = `${tasker.firstName} ${tasker.lastName}`;

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
//                 `${clientName} has booked "${service.title}" on ${formattedDate}. You'll receive $${(fees.taskerPayout / 100).toFixed(2)} upon completion.`,
//                 "booking-confirmed",
//                 booking._id
//             );
//         } catch (e) { console.error("Notification error:", e); }

//         try {
//             await createNotification(
//                 clientId,
//                 "✅ Booking Confirmed!",
//                 `Your booking for "${service.title}" with ${taskerName} on ${formattedDate} is confirmed. Total: $${(fees.totalClientPays / 100).toFixed(2)}`,
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
//                 clientPlatformFee: fees.clientPlatformFee / 100,
//                 taxOnClientFee: fees.taxOnClientFee / 100,
//                 totalClientPays: fees.totalClientPays / 100,
//                 taskerPlatformFee: fees.taskerPlatformFee / 100,
//                 taskerPayout: fees.taskerPayout / 100,
//                 platformTotal: fees.applicationFee / 100,
//                 currency: 'cad',
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

//         res.status(500).json({
//             message: "Server error while creating booking",
//             error: process.env.NODE_ENV === 'development' ? error.message : undefined
//         });
//     }
// };


// Get All Bookings
const createBooking = async (req, res) => {
    let paymentIntent = null;

    try {
        console.log('=== CREATE BOOKING REQUEST ===');
        console.log('Raw Request Body:', JSON.stringify(req.body, null, 2));

        const { taskerId, service, date, dayOfWeek, paymentMethodId: providedPaymentMethodId } = req.body;
        const clientId = req.user?.id;

        // ==================== BASIC VALIDATIONS ====================

        if (!clientId) {
            return res.status(401).json({ message: "Unauthorized: User not authenticated" });
        }

        if (!mongoose.Types.ObjectId.isValid(taskerId) || !mongoose.Types.ObjectId.isValid(clientId)) {
            return res.status(400).json({ message: "Invalid tasker or client ID" });
        }

        if (!service || !service.title || !service.description || !service.hourlyRate || !service.estimatedDuration) {
            return res.status(400).json({ message: "Service details are required" });
        }

        if (!date) {
            return res.status(400).json({ message: "Booking date and time are required" });
        }

        // ==================== VALIDATE USERS ====================

        const tasker = await User.findById(taskerId);
        if (!tasker || tasker.currentRole !== "tasker") {
            return res.status(400).json({ message: "Tasker not found or invalid role" });
        }

        // ✅ UPDATED: Added 'address' to the select fields
        const client = await User.findById(clientId).select('+address');
        if (!client || client.currentRole !== "client") {
            return res.status(400).json({ message: "Client not found or invalid role" });
        }

        // ==================== VALIDATE TASKER CAN RECEIVE PAYMENTS ====================

        let taskerStripeAccountId;
        try {
            taskerStripeAccountId = await validateTaskerCanReceivePayments(taskerId);
            console.log('✅ Tasker Stripe Connect validated:', taskerStripeAccountId);
        } catch (connectError) {
            return res.status(400).json({
                message: connectError.message,
                code: 'TASKER_PAYMENT_NOT_SETUP',
            });
        }

        // ==================== ⭐ HANDLE PAYMENT METHOD ====================

        let paymentMethodId = providedPaymentMethodId;
        let customerId = client.stripeCustomerId;

        console.log("=== PAYMENT METHOD DEBUG ===");
        console.log("Provided Payment Method ID:", providedPaymentMethodId);
        console.log("Client's stored stripeCustomerId:", customerId);
        console.log("Client's stored defaultPaymentMethod:", client.defaultPaymentMethod);
        console.log("Client's stored defaultPaymentMethodId:", client.defaultPaymentMethodId);

        // If no payment method provided, try to use the saved one
        if (!paymentMethodId) {
            paymentMethodId = client.defaultPaymentMethod || client.defaultPaymentMethodId;
        }

        if (!paymentMethodId) {
            return res.status(400).json({
                message: 'No payment method provided. Please add a card.',
                code: 'NO_PAYMENT_METHOD',
            });
        }

        // ⭐ STEP 1: Ensure we have a Stripe Customer
        if (!customerId) {
            console.log("Creating new Stripe Customer for client...");
            try {
                // ✅ UPDATED: Added more details when creating customer
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
                        firstName: client.firstName || '',
                        lastName: client.lastName || '',
                    },
                    // ✅ NEW: Add address if available
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
                customerId = customer.id;
                client.stripeCustomerId = customerId;
                await client.save();
                console.log("✅ Created new Stripe Customer:", customerId);
            } catch (customerError) {
                console.error("❌ Failed to create Stripe Customer:", customerError);
                return res.status(400).json({
                    message: 'Failed to set up payment. Please try again.',
                    code: 'CUSTOMER_CREATION_FAILED',
                });
            }
        } else {
            // ✅ NEW: Update existing Stripe customer with latest details
            try {
                const customerName = `${client.firstName} ${client.lastName}`.trim();
                await stripe.customers.update(customerId, {
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
                console.log('✅ Stripe customer updated with latest details');
            } catch (updateErr) {
                console.error('⚠️ Failed to update Stripe customer (non-blocking):', updateErr.message);
                // Don't fail the booking, just log the error
            }
        }

        // ⭐ STEP 2: Retrieve and validate payment method
        let paymentMethod;
        try {
            paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
            console.log("✅ Payment method retrieved:", paymentMethodId);
            console.log("   Type:", paymentMethod.type);
            console.log("   Card brand:", paymentMethod.card?.brand);
            console.log("   Last 4:", paymentMethod.card?.last4);
            console.log("   Attached to customer:", paymentMethod.customer);
        } catch (pmRetrieveError) {
            console.error("❌ Failed to retrieve payment method:", pmRetrieveError);

            // Clear invalid payment method from client record
            client.defaultPaymentMethod = null;
            client.defaultPaymentMethodId = null;
            await client.save();

            return res.status(400).json({
                message: 'Payment method not found or invalid. Please add a new card.',
                code: 'PAYMENT_METHOD_NOT_FOUND',
                debug: process.env.NODE_ENV === 'development' ? {
                    providedId: paymentMethodId,
                    error: pmRetrieveError.message
                } : undefined
            });
        }

        // ⭐ STEP 3: Attach payment method to customer if not already attached
        if (!paymentMethod.customer) {
            console.log("Payment method not attached to any customer. Attaching...");
            try {
                await stripe.paymentMethods.attach(paymentMethodId, {
                    customer: customerId,
                });
                console.log("✅ Payment method attached to customer:", customerId);
            } catch (attachError) {
                console.error("❌ Failed to attach payment method:", attachError);

                if (attachError.code === 'resource_already_exists') {
                    console.log("Payment method already attached to another customer");
                }

                return res.status(400).json({
                    message: 'Failed to set up payment method. Please try a different card.',
                    code: 'PAYMENT_METHOD_ATTACH_FAILED',
                });
            }
        } else if (paymentMethod.customer !== customerId) {
            console.log(`⚠️ Payment method attached to different customer: ${paymentMethod.customer}`);
            console.log(`   Updating client's stripeCustomerId from ${customerId} to ${paymentMethod.customer}`);
            customerId = paymentMethod.customer;
            client.stripeCustomerId = customerId;
        }

        // ⭐ STEP 4: Update client's payment records
        client.stripeCustomerId = customerId;
        client.defaultPaymentMethod = paymentMethodId;
        client.defaultPaymentMethodId = paymentMethodId;
        await client.save();
        console.log("✅ Client payment info updated");

        // ==================== PARSE AND VALIDATE DATE ====================

        const bookingDate = new Date(date);
        console.log('Parsed bookingDate:', bookingDate, 'ISO:', bookingDate.toISOString());

        if (isNaN(bookingDate.getTime())) {
            return res.status(400).json({ message: "Invalid date format" });
        }

        if (bookingDate < new Date()) {
            return res.status(400).json({ message: "Cannot book a time in the past" });
        }

        // ==================== VALIDATE AVAILABILITY ====================

        let dayName;

        if (dayOfWeek) {
            dayName = dayOfWeek;
        } else {
            const dateParts = date.split('T')[0].split('-');
            const year = parseInt(dateParts[0]);
            const month = parseInt(dateParts[1]) - 1;
            const day = parseInt(dateParts[2]);
            const localDate = new Date(year, month, day);
            dayName = getDayNameFromDate(localDate);
        }

        console.log('Final dayName for availability check:', dayName);

        if (!tasker.availability || tasker.availability.length === 0) {
            return res.status(400).json({
                message: "Tasker has not set their availability",
            });
        }

        const availability = tasker.availability.find(slot =>
            slot.day.toLowerCase() === dayName.toLowerCase()
        );

        if (!availability) {
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
                return res.status(400).json({
                    message: "This time slot is already booked. Please choose another time."
                });
            }
        }

        // ==================== CALCULATE DOUBLE-SIDED FEES ====================

        const serviceAmountInCents = Math.round(service.hourlyRate * 100);
        const fees = calculateDoubleSidedFees(serviceAmountInCents);

        console.log("💰 DOUBLE-SIDED FEE Booking Payment Breakdown:");
        console.log(`   Service Rate:         $${(serviceAmountInCents / 100).toFixed(2)}`);
        console.log(`   Client Fee (15%):     $${(fees.clientPlatformFee / 100).toFixed(2)}`);
        console.log(`   Tax (13% HST):        $${(fees.taxOnClientFee / 100).toFixed(2)}`);
        console.log(`   TOTAL CLIENT PAYS:    $${(fees.totalClientPays / 100).toFixed(2)}`);
        console.log(`   Tasker Fee (15%):    -$${(fees.taskerPlatformFee / 100).toFixed(2)}`);
        console.log(`   TASKER RECEIVES:      $${(fees.taskerPayout / 100).toFixed(2)}`);
        console.log(`   PLATFORM KEEPS:       $${(fees.applicationFee / 100).toFixed(2)}`);

        if (fees.totalClientPays < 50) {
            return res.status(400).json({
                message: 'Minimum service amount is $0.50 CAD',
                code: 'AMOUNT_TOO_SMALL'
            });
        }

        // ==================== CREATE PAYMENT INTENT ====================

        // ✅ NEW: Prepare names for description and metadata
        const clientFullName = `${client.firstName} ${client.lastName}`.trim();
        const taskerFullName = `${tasker.firstName} ${tasker.lastName}`.trim();

        console.log("Creating PaymentIntent...");
        console.log("   Customer ID:", customerId);
        console.log("   Payment Method ID:", paymentMethodId);
        console.log("   Amount:", fees.totalClientPays);
        console.log("   Application Fee:", fees.applicationFee);
        console.log("   Destination:", taskerStripeAccountId);

        try {
            paymentIntent = await stripe.paymentIntents.create({
                amount: fees.totalClientPays,
                currency: 'cad',
                customer: customerId,
                payment_method: paymentMethodId,
                capture_method: 'manual',

                // ✅ UPDATED: Enhanced description
                description: `Booking: "${service.title}" | Client: ${clientFullName} | Tasker: ${taskerFullName}`,

                // ✅ NEW: Send receipt email to client
                receipt_email: client.email,

                // ✅ NEW: Statement descriptor (appears on bank/card statement - max 22 chars)
                statement_descriptor: 'TASKALLO BOOKING',
                statement_descriptor_suffix: service.title.substring(0, 10).toUpperCase(),

                application_fee_amount: fees.applicationFee,

                transfer_data: {
                    destination: taskerStripeAccountId,
                },

                // ✅ UPDATED: Enhanced metadata with all details
                metadata: {
                    type: 'booking',
                    bookingType: 'service',
                    serviceTitle: service.title.substring(0, 100),

                    // Client info
                    clientId: clientId.toString(),
                    clientName: clientFullName,
                    clientEmail: client.email || '',
                    clientPhone: client.phone || '',

                    // Tasker info
                    taskerId: taskerId.toString(),
                    taskerName: taskerFullName,
                    taskerEmail: tasker.email || '',

                    // Amounts
                    serviceRate: (serviceAmountInCents / 100).toString(),
                    totalClientPays: (fees.totalClientPays / 100).toString(),
                    taskerPayout: (fees.taskerPayout / 100).toString(),
                    platformFee: (fees.applicationFee / 100).toString(),

                    feeStructure: 'double-sided-15-percent',
                    platform: 'taskallo',
                },

                // ✅ NEW: Shipping details (optional - helps with records)
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

            console.log("✅ PaymentIntent created:", paymentIntent.id);
            console.log("   Status:", paymentIntent.status);

        } catch (stripeError) {
            console.error("❌ Stripe PaymentIntent creation failed:", stripeError);
            console.error("   Error code:", stripeError.code);
            console.error("   Error type:", stripeError.type);
            console.error("   Error message:", stripeError.message);

            if (stripeError.type === 'StripeCardError') {
                return res.status(400).json({
                    message: stripeError.message,
                    code: 'CARD_ERROR',
                    decline_code: stripeError.decline_code
                });
            }

            if (stripeError.code === 'payment_method_not_attached') {
                return res.status(400).json({
                    message: 'Payment method is not properly set up. Please re-add your card.',
                    code: 'PAYMENT_METHOD_NOT_ATTACHED'
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

            return res.status(400).json({
                message: 'Payment authorization failed',
                code: 'AUTHORIZATION_FAILED',
                error: paymentIntent.last_payment_error?.message || 'Unknown error'
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
                authorizedAt: new Date(),
                feeStructure: 'double-sided-15-percent',

                serviceAmountCents: serviceAmountInCents,
                clientPlatformFeeCents: fees.clientPlatformFee,
                taxOnClientFeeCents: fees.taxOnClientFee,
                totalClientPaysCents: fees.totalClientPays,
                taskerPlatformFeeCents: fees.taskerPlatformFee,
                taskerPayoutCents: fees.taskerPayout,
                applicationFeeCents: fees.applicationFee,

                serviceAmount: serviceAmountInCents / 100,
                clientPlatformFee: fees.clientPlatformFee / 100,
                taxOnClientFee: fees.taxOnClientFee / 100,
                totalClientPays: fees.totalClientPays / 100,
                taskerPlatformFee: fees.taskerPlatformFee / 100,
                taskerPayout: fees.taskerPayout / 100,
                applicationFee: fees.applicationFee / 100,
            },

            paymentDetails: {
                amountCaptured: 0,
                currency: 'cad',
                paymentMethodType: 'card',
                billingDetails: {
                    name: clientFullName, // ✅ UPDATED: Use the variable
                    email: client.email,
                    phone: client.phone,
                }
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

            return res.status(500).json({
                message: 'Failed to save booking. Payment was not charged.',
                code: 'DATABASE_ERROR'
            });
        }

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
                `${clientFullName} has booked "${service.title}" on ${formattedDate}. You'll receive $${(fees.taskerPayout / 100).toFixed(2)} upon completion.`,
                "booking-confirmed",
                booking._id
            );
        } catch (e) { console.error("Notification error:", e); }

        try {
            await createNotification(
                clientId,
                "✅ Booking Confirmed!",
                `Your booking for "${service.title}" with ${taskerFullName} on ${formattedDate} is confirmed. Total: $${(fees.totalClientPays / 100).toFixed(2)}`,
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
                clientPlatformFee: fees.clientPlatformFee / 100,
                taxOnClientFee: fees.taxOnClientFee / 100,
                totalClientPays: fees.totalClientPays / 100,
                taskerPlatformFee: fees.taskerPlatformFee / 100,
                taskerPayout: fees.taskerPayout / 100,
                platformTotal: fees.applicationFee / 100,
                currency: 'cad',
                status: 'held',
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

        res.status(500).json({
            message: "Server error while creating booking",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};




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

// Update Booking
// const updateBooking = async (req, res) => {
//     try {
//         const { id } = req.params;
//         const { status, service } = req.body;
//         if (!mongoose.Types.ObjectId.isValid(id)) {
//             return res.status(400).json({ message: "Invalid booking ID" });
//         }
//         const booking = await BookingTasker.findById(id);
//         if (!booking) {
//             return res.status(404).json({ message: "Booking not found" });
//         }
//         if (status) booking.status = status;
//         if (service) booking.service = service;
//         await booking.save();
//         const populatedBooking = await Booking.findById(id)
//             .populate("tasker", "firstName lastName email phone role")
//             .populate("client", "firstName lastName email phone role");
//         res.status(200).json({ message: "Booking updated successfully", booking: populatedBooking });
//     } catch (error) {
//         console.error("Error updating booking:", error);
//         res.status(500).json({ message: "Server error" });
//     }
// };


// export const addReview = async (req, res) => {
//     try {
//         const { bookingId, rating, message } = req.body;
//         const clientId = req.user._id;

//         console.log('Client ID:', clientId, 'Booking ID:', bookingId); // Debug: Log IDs
//         // Validate input
//         if (!bookingId || !rating || !message) {
//             return res.status(400).json({ message: "Booking ID, rating, and message are required" });
//         }

//         if (rating < 0 || rating > 5) {
//             return res.status(400).json({ message: "Rating must be between 0 and 5" });
//         }

//         // Find the booking

//         const booking = await BookingTasker.findById(bookingId);
//         if (!booking) {
//             return res.status(404).json({ message: "Booking not found" });
//         }

//         console.log(booking.client.toString())

//         console.log('Booking Client ID:', booking.client.toString()); // Debug: Log booking client ID

//         // Check if the booking is completed and the client is authorized
//         if (booking.status !== "completed") {
//             return res.status(400).json({ message: "Reviews can only be added for completed bookings" });
//         }
//         if (booking.client.toString() !== clientId.toString()
//         ) {
//             return res.status(403).json({ message: "You are not authorized to review this booking" });
//         }

//         // Check if a review already exists
//         if (booking.review) {
//             return res.status(400).json({ message: "A review has already been submitted for this booking" });
//         }

//         // Find the tasker
//         const tasker = await User.findById(booking.tasker);
//         if (!tasker || tasker.role !== "tasker") {
//             return res.status(404).json({ message: "Tasker not found" });
//         }

//         // Add the review to the booking
//         booking.review = {
//             reviewer: clientId,
//             rating,
//             message,
//             createdAt: new Date(),
//         };

//         // Add the review to the tasker's reviews array
//         tasker.reviews.push({
//             reviewer: clientId,
//             rating,
//             message,
//             bookingId, // Link review to booking
//             createdAt: new Date(),
//         });

//         // Update tasker's rating and review count
//         const totalReviews = tasker.reviews.length;
//         const averageRating =
//             tasker.reviews.reduce((sum, rev) => sum + rev.rating, 0) / totalReviews;

//         tasker.rating = parseFloat(averageRating.toFixed(2));
//         tasker.reviewCount = totalReviews;

//         await booking.save();
//         await tasker.save();

//         res.status(201).json({ message: "Review added successfully", review: booking.review });
//     } catch (error) {
//         console.error("Error adding review:", error);
//         res.status(500).json({ message: "Server error" });
//     }
// };

//  const updateBooking = async (req, res) => {
//     try {
//         const { id } = req.params;
//         const { status, service } = req.body;
//         if (!mongoose.Types.ObjectId.isValid(id)) {
//             return res.status(400).json({ message: "Invalid booking ID" });
//         }
//         const booking = await BookingTasker.findById(id);
//         if (!booking) {
//             return res.status(404).json({ message: "Booking not found" });
//         }

//         const previousStatus = booking.status; // Track for notification
//         const previousService = booking.service; // Track for notification if changed

//         if (status) booking.status = status;
//         if (service) booking.service = service;
//         await booking.save();

//         const populatedBooking = await BookingTasker.findById(id)
//             .populate("tasker", "firstName lastName email phone role")
//             .populate("client", "firstName lastName email phone role");

//         // Create notification for the other party (non-blocking)
//         try {
//             const updaterRole = req.user.role; // Assume req.user has role from middleware
//             const otherPartyId = updaterRole === "client" ? booking.tasker : booking.client;
//             const otherPartyName = updaterRole === "client" ? "Tasker" : "Client";
//             let title = "Booking Updated";
//             let message = `${otherPartyName} updated the booking "${booking.service?.title || 'Booking'}"`;
//             if (status && status !== previousStatus) {
//                 message += ` - Status changed to "${status}"`;
//             }
//             if (service && service.title !== previousService?.title) {
//                 message += ` - Service changed to "${service.title}"`;
//             }
//             await createNotification(
//                 otherPartyId,
//                 title,
//                 message,
//                 "booking-updated",
//                 booking._id // Link to booking
//             );
//             console.log("Notification created for booking update"); // Debug
//         } catch (notifErr) {
//             console.error("Failed to create notification (non-blocking):", notifErr); // Log but don't crash
//         }

//         res.status(200).json({ message: "Booking updated successfully", booking: populatedBooking });
//     } catch (error) {
//         console.error("Error updating booking:", error);
//         res.status(500).json({ message: "Server error" });
//     }
// };

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




// export const updateBookingStatus = async (req, res) => {
//     try {
//         const { id } = req.params;
//         const { status } = req.body;

//         if (!mongoose.Types.ObjectId.isValid(id)) {
//             return res.status(400).json({ message: "Invalid booking ID" });
//         }

//         const booking = await BookingTasker.findById(id)
//             .populate("tasker", "firstName lastName email")
//             .populate("client", "firstName lastName email");

//         if (!booking) {
//             return res.status(404).json({ message: "Booking not found" });
//         }

//         // Log for debugging
//         console.log("Request Params:", req.params);
//         console.log("Request Body:", req.body);
//         console.log("Authenticated User ID:", req.user._id.toString());
//         console.log("Booking Tasker ID:", booking.tasker._id.toString());

//         // Ensure only the tasker associated with the booking can update it
//         const userId = req.user._id.toString();
//         const taskerId = booking.tasker._id.toString();
//         if (taskerId !== userId) {
//             return res.status(403).json({ message: "Unauthorized to update this booking" });
//         }

//         // Validate status
//         const validStatuses = ["pending", "confirmed", "cancelled", "completed"];
//         if (status && !validStatuses.includes(status)) {
//             return res.status(400).json({ message: "Invalid status value" });
//         }

//         const previousStatus = booking.status;
//         if (status) booking.status = status;
//         booking.updatedAt = new Date();
//         await booking.save();

//         const populatedBooking = await BookingTasker.findById(id)
//             .populate("tasker", "firstName lastName email phone role")
//             .populate("client", "firstName lastName email phone role");

//         // FIX: Get tasker details from database
//         const tasker = await User.findById(req.user._id).select("firstName lastName");
//         const taskerName = tasker
//             ? `${tasker.firstName} ${tasker.lastName}`
//             : "The tasker";

//         // Get client details
//         const clientName = booking.client
//             ? `${booking.client.firstName} ${booking.client.lastName}`
//             : "The client";

//         // Format date for notifications
//         const formattedDate = booking.date.toLocaleDateString('en-US', {
//             weekday: 'long',
//             year: 'numeric',
//             month: 'long',
//             day: 'numeric',
//             hour: '2-digit',
//             minute: '2-digit'
//         });

//         // Build status-specific notification content
//         let clientNotificationTitle = "Booking Status Updated";
//         let clientNotificationMessage = "";
//         let clientNotificationType = "booking-status-updated";

//         let taskerNotificationTitle = "Status Update Confirmed";
//         let taskerNotificationMessage = "";

//         switch (status) {
//             case "confirmed":
//                 clientNotificationTitle = "✅ Booking Confirmed!";
//                 clientNotificationMessage = `Great news! ${taskerName} has confirmed your booking for "${booking.service?.title || 'Service'}" on ${formattedDate}. Get ready for your appointment!`;
//                 clientNotificationType = "booking-confirmed";

//                 taskerNotificationTitle = "Booking Confirmation Sent";
//                 taskerNotificationMessage = `You have confirmed the booking with ${clientName} for "${booking.service?.title || 'Service'}" on ${formattedDate}.`;
//                 break;

//             case "cancelled":
//                 clientNotificationTitle = "❌ Booking Cancelled";
//                 clientNotificationMessage = `Unfortunately, ${taskerName} has cancelled the booking for "${booking.service?.title || 'Service'}" on ${formattedDate}. We apologize for the inconvenience.`;
//                 clientNotificationType = "booking-cancelled";

//                 taskerNotificationTitle = "Booking Cancellation Confirmed";
//                 taskerNotificationMessage = `You have cancelled the booking with ${clientName} for "${booking.service?.title || 'Service'}" on ${formattedDate}.`;
//                 break;

//             case "completed":
//                 clientNotificationTitle = "🎉 Booking Completed!";
//                 clientNotificationMessage = `${taskerName} has marked your booking for "${booking.service?.title || 'Service'}" as completed. We hope you had a great experience!`;
//                 clientNotificationType = "booking-completed";

//                 taskerNotificationTitle = "Booking Marked as Completed";
//                 taskerNotificationMessage = `You have marked the booking with ${clientName} for "${booking.service?.title || 'Service'}" as completed. Great job!`;
//                 break;

//             case "pending":
//                 clientNotificationTitle = "⏳ Booking Status Changed to Pending";
//                 clientNotificationMessage = `${taskerName} has changed your booking for "${booking.service?.title || 'Service'}" back to pending status.`;
//                 clientNotificationType = "booking-pending";

//                 taskerNotificationTitle = "Booking Status Changed";
//                 taskerNotificationMessage = `You have changed the booking with ${clientName} for "${booking.service?.title || 'Service'}" to pending status.`;
//                 break;

//             default:
//                 clientNotificationMessage = `${taskerName} updated the status of your booking for "${booking.service?.title || 'Service'}" from "${previousStatus}" to "${status}".`;
//                 taskerNotificationMessage = `You updated the booking status with ${clientName} to "${status}".`;
//         }

//         // Create notification for the client
//         try {
//             // Debug: Log notification details
//             console.log("Creating booking status update notification for client:", {
//                 clientId: booking.client._id,
//                 taskerName,
//                 status,
//                 previousStatus,
//                 serviceTitle: booking.service?.title
//             });

//             await createNotification(
//                 booking.client._id, // Client ID
//                 clientNotificationTitle,
//                 clientNotificationMessage,
//                 clientNotificationType,
//                 id
//             );
//             console.log("✅ Notification created for client - booking status update");

//         } catch (notifErr) {
//             console.error("❌ Failed to create client notification (non-blocking):", notifErr);
//         }

//         // Send confirmation notification to tasker
//         try {
//             await createNotification(
//                 req.user._id, // Tasker ID
//                 taskerNotificationTitle,
//                 taskerNotificationMessage,
//                 "booking-status-update-confirmed",
//                 id
//             );
//             console.log("✅ Confirmation notification sent to tasker");

//         } catch (notifErr) {
//             console.error("❌ Failed to create tasker confirmation notification (non-blocking):", notifErr);
//         }

//         // If booking completed, prompt client for review
//         if (status === "completed") {
//             try {
//                 await createNotification(
//                     booking.client._id, // Client ID
//                     "⭐ Leave a Review",
//                     `How was your experience with ${taskerName} for "${booking.service?.title || 'Service'}"? Leave a review to help others find great taskers!`,
//                     "review-prompt",
//                     id
//                 );
//                 console.log("✅ Review prompt notification sent to client");

//             } catch (notifErr) {
//                 console.error("❌ Failed to create review prompt notification (non-blocking):", notifErr);
//             }

//             // Optional: Send thank you notification to tasker
//             try {
//                 await createNotification(
//                     req.user._id, // Tasker ID
//                     "💰 Earnings Update",
//                     `You've completed the booking for "${booking.service?.title || 'Service'}" with ${clientName}. Your earnings of $${booking.totalAmount || booking.service?.hourlyRate || '0'} will be processed.`,
//                     "earnings-update",
//                     id
//                 );
//                 console.log("✅ Earnings notification sent to tasker");

//             } catch (notifErr) {
//                 console.error("❌ Failed to create earnings notification (non-blocking):", notifErr);
//             }
//         }

//         // If booking cancelled, handle any payment refunds
//         if (status === "cancelled" && booking.paymentIntentId) {
//             try {
//                 const paymentIntent = await stripe.paymentIntents.retrieve(booking.paymentIntentId);

//                 if (paymentIntent.status === 'succeeded') {
//                     // Create refund notification for client
//                     await createNotification(
//                         booking.client._id,
//                         "💳 Refund Initiated",
//                         `A refund for your booking "${booking.service?.title || 'Service'}" has been initiated. The amount of $${booking.totalAmount || booking.service?.hourlyRate || '0'} will be returned to your payment method within 5-10 business days.`,
//                         "refund-initiated",
//                         id
//                     );
//                     console.log("✅ Refund notification sent to client");

//                     // Uncomment to auto-refund:
//                     // await stripe.refunds.create({ payment_intent: booking.paymentIntentId });
//                 }
//             } catch (stripeErr) {
//                 console.error("❌ Failed to handle payment on cancellation:", stripeErr);
//             }
//         }

//         res.status(200).json({ message: "Booking updated successfully", booking: populatedBooking });
//     } catch (error) {
//         console.error("Error updating booking:", error);
//         res.status(500).json({ message: "Server error" });
//     }
// };

// Delete booking


// controllers/bookingController.js

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
        const taskerPayoutFormatted = (taskerPayout / 100).toFixed(2);

        // Handle payment based on status
        if (status === "completed" && paymentIntentId) {
            // ⭐ Capture payment - automatic split happens!
            try {
                const paymentIntent = await stripe.paymentIntents.capture(paymentIntentId);

                if (paymentIntent.status === 'succeeded') {
                    booking.stripeStatus = 'succeeded';
                    booking.payment.status = 'captured';
                    booking.payment.capturedAt = new Date();

                    console.log("✅ Booking payment captured with split");

                    // Update tasker earnings
                    await User.findByIdAndUpdate(booking.tasker._id, {
                        $inc: {
                            'stats.bookingsCompleted': 1,
                            'stats.totalEarnings': taskerPayout,
                        }
                    });
                }
            } catch (stripeErr) {
                console.error("Payment capture failed:", stripeErr);
                return res.status(400).json({ message: "Payment capture failed" });
            }
        }

        if (status === "cancelled" && paymentIntentId) {
            // Check if payment was held or captured
            try {
                const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

                if (paymentIntent.status === 'requires_capture') {
                    // Just cancel the hold
                    await stripe.paymentIntents.cancel(paymentIntentId);
                    booking.payment.status = 'cancelled';

                } else if (paymentIntent.status === 'succeeded') {
                    // Need to refund
                    const refundAmount = booking.calculateRefundAmount();

                    if (refundAmount > 0) {
                        await stripe.refunds.create({
                            payment_intent: paymentIntentId,
                            amount: refundAmount,
                            // Note: This also reverses the proportional transfer
                        });

                        booking.payment.status = refundAmount === booking.payment.grossAmount
                            ? 'refunded'
                            : 'partial_refund';
                        booking.payment.refundAmount = refundAmount;
                        booking.payment.refundedAt = new Date();
                    }
                }

                booking.stripeStatus = 'canceled';
            } catch (stripeErr) {
                console.error("Payment cancellation failed:", stripeErr);
            }
        }

        booking.status = status;
        booking.updatedAt = new Date();
        if (status === "completed") booking.completedAt = new Date();
        if (status === "cancelled") booking.cancelledAt = new Date();

        await booking.save();

        // Notifications
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
                    "💰 Payment Released!",
                    `Booking completed! $${taskerPayoutFormatted} has been released to your account and will be deposited to your bank.`,
                    "earnings-update",
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


// const deleteBooking = async (req, res) => {
//     try {
//         const { id } = req.params;

//         if (!mongoose.Types.ObjectId.isValid(id)) {
//             return res.status(400).json({ message: "Invalid booking ID" });
//         }

//         console.log(req.params);

//         const booking = await BookingTasker.findById(id)
//             .populate("tasker", "firstName lastName email")
//             .populate("client", "firstName lastName email");

//         if (!booking) {
//             return res.status(404).json({ message: "Booking not found" });
//         }

//         // Check if req.user exists before accessing it
//         if (!req.user) {
//             return res.status(401).json({ message: "Unauthorized: No user authenticated" });
//         }

//         const userId = req.user.id || req.user._id.toString();
//         const isClient = booking.client._id.toString() === userId;
//         const isTasker = booking.tasker._id.toString() === userId;

//         if (!isClient && !isTasker) {
//             return res.status(403).json({ message: "Unauthorized to delete this booking" });
//         }

//         // Store booking details before deletion for notifications
//         const bookingService = booking.service;
//         const bookingDate = booking.date;
//         const bookingTaskerId = booking.tasker._id;
//         const bookingClientId = booking.client._id;
//         const taskerName = `${booking.tasker.firstName} ${booking.tasker.lastName}`;
//         const clientName = `${booking.client.firstName} ${booking.client.lastName}`;

//         // FIX: Cancel payment if exists before deleting
//         if (booking.paymentIntentId) {
//             try {
//                 const paymentIntent = await stripe.paymentIntents.retrieve(booking.paymentIntentId);

//                 // Only cancel if it's in a cancellable state
//                 if (['requires_payment_method', 'requires_confirmation', 'requires_action', 'processing'].includes(paymentIntent.status)) {
//                     await stripe.paymentIntents.cancel(booking.paymentIntentId);
//                     console.log("✅ Payment intent canceled for deleted booking");
//                 } else if (paymentIntent.status === 'succeeded') {
//                     // If already paid, you might want to create a refund
//                     console.log("⚠️ Booking was paid - consider refund process");
//                     // Uncomment below to auto-refund:
//                     // await stripe.refunds.create({ payment_intent: booking.paymentIntentId });
//                     // console.log("✅ Refund created for deleted booking");
//                 }
//             } catch (stripeErr) {
//                 console.error("❌ Failed to handle payment on deletion:", stripeErr);
//                 // Continue with deletion even if stripe fails
//             }
//         }

//         // Delete the booking
//         await BookingTasker.findByIdAndDelete(id);

//         // FIX: Get deleter details from database
//         const deleter = await User.findById(userId).select("firstName lastName");
//         const deleterName = deleter
//             ? `${deleter.firstName} ${deleter.lastName}`
//             : "Someone";

//         // Determine who should be notified (the other party)
//         const otherPartyId = isClient ? bookingTaskerId : bookingClientId;
//         const otherPartyType = isClient ? "Tasker" : "Client";

//         // Format date for notifications
//         const formattedDate = bookingDate.toLocaleDateString('en-US', {
//             weekday: 'long',
//             year: 'numeric',
//             month: 'long',
//             day: 'numeric',
//             hour: '2-digit',
//             minute: '2-digit'
//         });

//         // Create notification for the other party
//         try {
//             // Debug: Log notification details
//             console.log("Creating booking deletion notification:", {
//                 recipientId: otherPartyId,
//                 deleterName,
//                 serviceTitle: bookingService?.title,
//                 formattedDate,
//                 isClient
//             });

//             const notificationTitle = "❌ Booking Cancelled";
//             const notificationMessage = `${deleterName} has cancelled the booking for "${bookingService?.title || 'Service'}" that was scheduled for ${formattedDate}.${booking.paymentIntentId ? ' Any payment will be refunded.' : ''}`;

//             await createNotification(
//                 otherPartyId,
//                 notificationTitle,
//                 notificationMessage,
//                 "booking-deleted",
//                 id
//             );
//             console.log("✅ Notification created for other party - booking deleted");

//         } catch (notifErr) {
//             console.error("❌ Failed to create notification (non-blocking):", notifErr);
//         }

//         // Send confirmation notification to the deleter
//         try {
//             const otherPersonName = isClient ? taskerName : clientName;

//             await createNotification(
//                 userId,
//                 "Booking Deletion Confirmed",
//                 `Your booking for "${bookingService?.title || 'Service'}" with ${otherPersonName} on ${formattedDate} has been cancelled successfully.${booking.paymentIntentId ? ' Any payment will be refunded.' : ''}`,
//                 "booking-delete-confirmed",
//                 id
//             );
//             console.log("✅ Confirmation notification sent to deleter");

//         } catch (notifErr) {
//             console.error("❌ Failed to create confirmation notification (non-blocking):", notifErr);
//         }

//         res.status(200).json({ message: "Booking deleted successfully" });
//     } catch (error) {
//         console.error("Error deleting booking:", error);
//         res.status(500).json({ message: "Server error" });
//     }
// };

// Create request quote
//  const createRequestQuote = async (req, res) => {
//     try {
//         const { taskerId, taskTitle, taskDescription, location, budget, preferredDateTime, urgency } = req.body;
//         const clientId = req.user?.id;
//         console.log(clientId)

//         if (!clientId) {
//             return res.status(401).json({ message: "Unauthorized: User not authenticated" });
//         }

//         if (!mongoose.Types.ObjectId.isValid(taskerId) || !mongoose.Types.ObjectId.isValid(clientId)) {
//             return res.status(400).json({ message: "Invalid tasker or client ID" });
//         }

//         if (!taskTitle || !taskDescription || !location) {
//             return res.status(400).json({ message: "Task title, description, and location are required" });
//         }

//         const tasker = await mongoose.models.User.findById(taskerId);
//         if (!tasker || tasker.currentRole !== "tasker") {
//             return res.status(400).json({ message: "Tasker not found or invalid role" });
//         }

//         const client = await mongoose.models.User.findById(clientId);
//         if (!client || client.currentRole !== "client") {
//             return res.status(400).json({ message: "Client not found or invalid role" });
//         }

//         const requestQuote = new RequestQuote({
//             tasker: taskerId,
//             client: clientId,
//             taskTitle,
//             taskDescription,
//             location,
//             budget: budget || null,
//             preferredDateTime: preferredDateTime ? new Date(preferredDateTime) : null,
//             urgency: urgency || "Flexible - Whenever works",
//             status: "pending",
//         });

//         await requestQuote.save();

//         const populatedRequestQuote = await RequestQuote.findById(requestQuote._id)
//             .populate("tasker", "firstName lastName email phone currentRole")
//             .populate("client", "firstName lastName email phone currentRole");

//         // Create notification for the tasker (new quote request) - non-blocking
//         try {
//             await createNotification(
//                 taskerId, // Notify the tasker
//                 "New Quote Request",
//                 `Client "${client.firstName} ${client.lastName}" requested a quote for "${taskTitle}" in ${location}. Budget: $${budget || 'Negotiable'}, Preferred Date: ${preferredDateTime || 'Flexible'}.`,
//                 "quote-request",
//                 requestQuote._id // Link to quote request
//             );
//             console.log("Notification created for new quote request"); // Debug
//         } catch (notifErr) {
//             console.error("Failed to create notification (non-blocking):", notifErr); // Log but don't crash
//         }

//         res.status(201).json({ message: "Quote request created successfully", requestQuote: populatedRequestQuote });
//     } catch (error) {
//         console.error("Error creating quote request:", error);
//         res.status(500).json({ message: "Server error" });
//     }
// };

const createRequestQuote = async (req, res) => {
    try {
        const { taskerId, taskTitle, taskDescription, location, budget, preferredDateTime, urgency } = req.body;
        const clientId = req.user?.id;
        console.log(clientId);

        if (!clientId) {
            return res.status(401).json({ message: "Unauthorized: User not authenticated" });
        }

        if (!mongoose.Types.ObjectId.isValid(taskerId) || !mongoose.Types.ObjectId.isValid(clientId)) {
            return res.status(400).json({ message: "Invalid tasker or client ID" });
        }

        if (!taskTitle || !taskDescription || !location) {
            return res.status(400).json({ message: "Task title, description, and location are required" });
        }

        const tasker = await mongoose.models.User.findById(taskerId);
        if (!tasker || tasker.currentRole !== "tasker") {
            return res.status(400).json({ message: "Tasker not found or invalid role" });
        }

        const client = await mongoose.models.User.findById(clientId);
        if (!client || client.currentRole !== "client") {
            return res.status(400).json({ message: "Client not found or invalid role" });
        }

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

        const populatedRequestQuote = await RequestQuote.findById(requestQuote._id)
            .populate("tasker", "firstName lastName email phone currentRole")
            .populate("client", "firstName lastName email phone currentRole");

        // FIX: Get user names safely
        const clientName = client
            ? `${client.firstName} ${client.lastName}`
            : "A client";

        const taskerName = tasker
            ? `${tasker.firstName} ${tasker.lastName}`
            : "The tasker";

        // Format preferred date for notifications
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

        // Format budget for notifications
        const formattedBudget = budget ? `$${budget}` : "Negotiable";

        // Create notification for the tasker (new quote request)
        try {
            // Debug: Log notification details
            console.log("Creating quote request notification for tasker:", {
                taskerId,
                clientName,
                taskTitle,
                location,
                budget: formattedBudget,
                preferredDateTime: formattedDate
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

        // Create confirmation notification for the client
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

        res.status(201).json({ message: "Quote request created successfully", requestQuote: populatedRequestQuote });
    } catch (error) {
        console.error("Error creating quote request:", error);
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


// export const updateQuoteStatus = async (req, res) => {
//     try {
//         const { taskId } = req.params;
//         const { status } = req.body;
//         const taskerId = req.user.id;

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

//         // Find task with populated data
//         const task = await RequestQuote.findById(taskId)
//             .populate("tasker", "firstName lastName email")
//             .populate("client", "firstName lastName email");

//         if (!task) {
//             return res.status(404).json({ message: 'Task not found' });
//         }

//         // Verify tasker
//         if (task.tasker._id.toString() !== taskerId) {
//             return res.status(403).json({ message: 'Unauthorized: You are not the assigned tasker' });
//         }

//         // Track previous status for notification
//         const previousStatus = task.status;

//         // Update status and updatedAt
//         task.status = status;
//         task.updatedAt = new Date();
//         await task.save();

//         // Populate tasker and client for response
//         const updatedTask = await RequestQuote.findById(taskId)
//             .populate('tasker', 'firstName lastName email phone role')
//             .populate('client', 'firstName lastName email phone role');

//         // FIX: Get tasker details from database
//         const tasker = await User.findById(taskerId).select("firstName lastName");
//         const taskerName = tasker
//             ? `${tasker.firstName} ${tasker.lastName}`
//             : "The tasker";

//         // Get client details
//         const clientName = task.client
//             ? `${task.client.firstName} ${task.client.lastName}`
//             : "The client";

//         // Build status-specific notification content
//         let clientNotificationTitle = "Quote Status Updated";
//         let clientNotificationMessage = "";
//         let clientNotificationType = "quote-status-updated";

//         let taskerNotificationTitle = "Status Update Confirmed";
//         let taskerNotificationMessage = "";

//         switch (status) {
//             case "accepted":
//                 clientNotificationTitle = "🎉 Your Quote Request Was Accepted!";
//                 clientNotificationMessage = `Great news! ${taskerName} has accepted your quote request for "${task.taskTitle}". You can now proceed to book the service or discuss details further.`;
//                 clientNotificationType = "quote-accepted";

//                 taskerNotificationTitle = "Quote Acceptance Confirmed";
//                 taskerNotificationMessage = `You have accepted the quote request for "${task.taskTitle}" from ${clientName}. The client has been notified.`;
//                 break;

//             case "rejected":
//                 clientNotificationTitle = "❌ Quote Request Declined";
//                 clientNotificationMessage = `Unfortunately, ${taskerName} is unable to accept your quote request for "${task.taskTitle}" at this time. You may want to request a quote from another tasker.`;
//                 clientNotificationType = "quote-rejected";

//                 taskerNotificationTitle = "Quote Rejection Confirmed";
//                 taskerNotificationMessage = `You have declined the quote request for "${task.taskTitle}" from ${clientName}. The client has been notified.`;
//                 break;

//             case "completed":
//                 clientNotificationTitle = "🎉 Quote Request Completed!";
//                 clientNotificationMessage = `${taskerName} has marked your quote request for "${task.taskTitle}" as completed. We hope you had a great experience!`;
//                 clientNotificationType = "quote-completed";

//                 taskerNotificationTitle = "Quote Marked as Completed";
//                 taskerNotificationMessage = `You have marked the quote request for "${task.taskTitle}" with ${clientName} as completed. Great job!`;
//                 break;

//             default:
//                 clientNotificationMessage = `${taskerName} updated the status of your quote request for "${task.taskTitle}" from "${previousStatus}" to "${status}".`;
//                 taskerNotificationMessage = `You updated the quote status for "${task.taskTitle}" to "${status}".`;
//         }

//         // Create notification for the client
//         try {
//             // Debug: Log notification details
//             console.log("Creating quote status update notification for client:", {
//                 clientId: task.client._id,
//                 taskerName,
//                 status,
//                 previousStatus,
//                 taskTitle: task.taskTitle
//             });

//             await createNotification(
//                 task.client._id,
//                 clientNotificationTitle,
//                 clientNotificationMessage,
//                 clientNotificationType,
//                 taskId
//             );
//             console.log("✅ Notification created for client - quote status update");

//         } catch (notifErr) {
//             console.error("❌ Failed to create client notification (non-blocking):", notifErr);
//         }

//         // Send confirmation notification to tasker
//         try {
//             await createNotification(
//                 taskerId,
//                 taskerNotificationTitle,
//                 taskerNotificationMessage,
//                 "quote-status-update-confirmed",
//                 taskId
//             );
//             console.log("✅ Confirmation notification sent to tasker");

//         } catch (notifErr) {
//             console.error("❌ Failed to create tasker confirmation notification (non-blocking):", notifErr);
//         }

//         // If quote accepted, prompt to book or schedule
//         if (status === "accepted") {
//             try {
//                 await createNotification(
//                     task.client._id,
//                     "📅 Ready to Book?",
//                     `Your quote for "${task.taskTitle}" was accepted by ${taskerName}. Book now to schedule your service!`,
//                     "booking-prompt",
//                     taskId
//                 );
//                 console.log("✅ Booking prompt notification sent to client");

//             } catch (notifErr) {
//                 console.error("❌ Failed to create booking prompt notification (non-blocking):", notifErr);
//             }
//         }

//         // If quote completed, prompt client for review
//         if (status === "completed") {
//             try {
//                 await createNotification(
//                     task.client._id,
//                     "⭐ Leave a Review",
//                     `How was your experience with ${taskerName} for "${task.taskTitle}"? Leave a review to help others find great taskers!`,
//                     "review-prompt",
//                     taskId
//                 );
//                 console.log("✅ Review prompt notification sent to client");

//             } catch (notifErr) {
//                 console.error("❌ Failed to create review prompt notification (non-blocking):", notifErr);
//             }

//             // Send earnings/thank you notification to tasker
//             try {
//                 await createNotification(
//                     taskerId,
//                     "💪 Great Work!",
//                     `You've completed the quote request for "${task.taskTitle}" with ${clientName}. Keep up the excellent work!`,
//                     "quote-work-completed",
//                     taskId
//                 );
//                 console.log("✅ Work completed notification sent to tasker");

//             } catch (notifErr) {
//                 console.error("❌ Failed to create tasker work completed notification (non-blocking):", notifErr);
//             }
//         }

//         res.status(200).json({ message: 'Task status updated successfully', task: updatedTask });
//     } catch (error) {
//         console.error('Error updating task status:', error);
//         res.status(500).json({ message: 'Server error while updating task status', error: error.message });
//     }
// };


// controllers/requestQuoteController.js

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
        const taskerPayoutFormatted = (taskerPayout / 100).toFixed(2);

        // Handle completed status - capture payment
        if (status === 'completed' && paymentIntentId) {
            try {
                const paymentIntent = await stripe.paymentIntents.capture(paymentIntentId);

                if (paymentIntent.status === 'succeeded') {
                    task.payment.status = 'captured';
                    task.payment.capturedAt = new Date();

                    // Update tasker earnings
                    await User.findByIdAndUpdate(taskerId, {
                        $inc: {
                            'stats.tasksCompleted': 1,
                            'stats.totalEarnings': taskerPayout,
                        }
                    });

                    console.log("✅ Quote payment captured:", taskerPayoutFormatted);
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
            } catch (stripeErr) {
                console.error("Payment cancellation failed:", stripeErr);
            }
        }

        task.status = status;
        task.updatedAt = new Date();
        if (status === 'completed') task.completedAt = new Date();

        await task.save();

        // Notifications
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
                    "💰 Payment Released!",
                    `Work completed! $${taskerPayoutFormatted} has been released and will be deposited to your bank.`,
                    "quote-work-completed",
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



// Delete request quote
//  const deleteRequestQuote = async (req, res) => {
//     try {
//         const { id } = req.params;
//         if (!mongoose.Types.ObjectId.isValid(id)) {
//             return res.status(400).json({ message: "Invalid request quote ID" });
//         }
//         const requestQuote = await RequestQuote.findById(id);
//         if (!requestQuote) {
//             return res.status(404).json({ message: "Request quote not found" });
//         }

//         // Ensure the authenticated user is authorized (client or tasker)
//         const userId = req.user.id;
//         if (requestQuote.client.toString() !== userId && requestQuote.tasker.toString() !== userId) {
//             return res.status(403).json({ message: "Unauthorized to delete this request quote" });
//         }

//         const deletedQuote = await RequestQuote.findByIdAndDelete(id);

//         // Create notification for the other party (non-blocking)
//         try {
//             const deleterRole = req.user.role; // Assume req.user has role from middleware
//             const otherPartyId = deleterRole === "client" ? requestQuote.tasker : requestQuote.client;
//             const otherPartyName = deleterRole === "client" ? "Tasker" : "Client";
//             const deleterName = req.user.firstName + " " + req.user.lastName;
//             await createNotification(
//                 otherPartyId,
//                 "Quote Request Deleted",
//                 `${otherPartyName} "${deleterName}" has deleted the quote request "${requestQuote.taskTitle}".`,
//                 "quote-deleted",
//                 id // Link to quote request (even if deleted)
//             );
//             console.log("Notification created for quote deletion"); // Debug
//         } catch (notifErr) {
//             console.error("Failed to create notification (non-blocking):", notifErr); // Log but don't crash
//         }

//         res.status(200).json({ message: "Request quote deleted successfully" });
//     } catch (error) {
//         console.error("Error deleting request quote:", error);
//         res.status(500).json({ message: "Server error" });
//     }
// };
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

        // Ensure the authenticated user is authorized (client or tasker)
        const userId = req.user.id;
        const isClient = requestQuote.client._id.toString() === userId;
        const isTasker = requestQuote.tasker._id.toString() === userId;

        if (!isClient && !isTasker) {
            return res.status(403).json({ message: "Unauthorized to delete this request quote" });
        }

        // Store quote details before deletion for notifications
        const quoteTaskTitle = requestQuote.taskTitle;
        const quoteTaskerId = requestQuote.tasker._id;
        const quoteClientId = requestQuote.client._id;
        const taskerName = `${requestQuote.tasker.firstName} ${requestQuote.tasker.lastName}`;
        const clientName = `${requestQuote.client.firstName} ${requestQuote.client.lastName}`;
        const quoteBudget = requestQuote.budget;

        // Delete the quote
        await RequestQuote.findByIdAndDelete(id);

        // FIX: Get deleter details from database
        const deleter = await User.findById(userId).select("firstName lastName");
        const deleterName = deleter
            ? `${deleter.firstName} ${deleter.lastName}`
            : "Someone";

        // Determine who should be notified (the other party)
        const otherPartyId = isClient ? quoteTaskerId : quoteClientId;
        const otherPartyName = isClient ? taskerName : clientName;

        // Create notification for the other party
        try {
            // Debug: Log notification details
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

        // Send confirmation notification to the deleter
        try {
            const confirmationMessage = isClient
                ? `Your quote request for "${quoteTaskTitle}" has been deleted successfully. ${taskerName} has been notified.`
                : `You have withdrawn from the quote request "${quoteTaskTitle}" by ${clientName}.`;

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


// export const submitBid = async (req, res) => {
//     try {
//         const { quoteId } = req.params;
//         const { bidAmount, bidDescription, estimatedDuration } = req.body;
//         const taskerId = req.user.id;

//         if (!mongoose.Types.ObjectId.isValid(quoteId)) {
//             return res.status(400).json({ message: 'Invalid quote ID' });
//         }

//         const quote = await RequestQuote.findById(quoteId).populate('tasker', 'currentRole');
//         if (!quote) {
//             return res.status(404).json({ message: 'Quote not found' });
//         }

//         if (quote.tasker._id.toString() !== taskerId) {
//             return res.status(403).json({ message: 'Unauthorized: Only the assigned tasker can bid' });
//         }

//         if (quote.status === 'accepted' || quote.status === 'completed' || quote.status === 'rejected') {
//             return res.status(400).json({ message: 'Cannot bid on this quote' });
//         }

//         // Validate inputs
//         if (!bidAmount || bidAmount <= 0) {
//             return res.status(400).json({ message: 'Valid bid amount is required' });
//         }

//         const newBid = {
//             bidAmount,
//             bidDescription: bidDescription || '',
//             estimatedDuration: estimatedDuration || 1,
//             // submittedAt and status will default via schema
//         };

//         quote.bids.push(newBid);

//         // Set status to 'bidded' if this is the first bid
//         if (quote.bids.length === 1) {
//             quote.status = 'bidded';
//         }

//         await quote.save();

//         const populatedQuote = await RequestQuote.findById(quoteId)
//             .populate("tasker", "firstName lastName email phone currentRole")
//             .populate("client", "firstName lastName email phone currentRole");

//         // Notification to client: new bid received
//         try {
//             const tasker = await User.findById(taskerId).select('firstName lastName');
//             await createNotification(
//                 quote.client,
//                 'New Bid Received',
//                 `Tasker "${tasker.firstName} ${tasker.lastName}" submitted a bid of $${bidAmount} for your quote "${quote.taskTitle}".`,
//                 'new-bid',
//                 quoteId
//             );
//         } catch (notifErr) {
//             console.error("Failed to create notification (non-blocking):", notifErr);
//         }

//         res.status(201).json({ message: 'Bid submitted successfully', quote: populatedQuote });
//     } catch (error) {
//         console.error('Error submitting bid:', error);
//         res.status(500).json({ message: 'Server error' });
//     }
// };

// Fee constants (same as bookings)

// Calculate double-sided fees for quotes
const calculateQuoteFees = (bidAmountInCents) => {
    // Client side: adds 15% + tax on that fee
    const clientPlatformFee = Math.round(bidAmountInCents * PLATFORM_FEE_PERCENT);
    const taxOnClientFee = Math.round(clientPlatformFee * TAX_PERCENT);
    const totalClientPays = bidAmountInCents + clientPlatformFee + taxOnClientFee;

    // Tasker side: deducts 15% from bid amount
    const taskerPlatformFee = Math.round(bidAmountInCents * PLATFORM_FEE_PERCENT);
    const taskerPayout = bidAmountInCents - taskerPlatformFee;

    // Platform keeps both fees
    const platformTotal = clientPlatformFee + taxOnClientFee + taskerPlatformFee;

    return {
        // In cents
        bidAmountCents: bidAmountInCents,
        clientPlatformFeeCents: clientPlatformFee,
        taxOnClientFeeCents: taxOnClientFee,
        totalClientPaysCents: totalClientPays,
        taskerPlatformFeeCents: taskerPlatformFee,
        taskerPayoutCents: taskerPayout,
        platformTotalCents: platformTotal,

        // In dollars (for display)
        bidAmount: bidAmountInCents / 100,
        clientPlatformFee: clientPlatformFee / 100,
        taxOnClientFee: taxOnClientFee / 100,
        totalClientPays: totalClientPays / 100,
        taskerPlatformFee: taskerPlatformFee / 100,
        taskerPayout: taskerPayout / 100,
        platformTotal: platformTotal / 100,
    };
};

// NEW: Preview fees endpoint (for the modal)
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

        console.log('💰 Quote Bid Fee Preview:');
        console.log(`   Bid Amount:           $${fees.bidAmount.toFixed(2)}`);
        console.log(`   Client Fee (15%):     $${fees.clientPlatformFee.toFixed(2)}`);
        console.log(`   Tax (13% HST):        $${fees.taxOnClientFee.toFixed(2)}`);
        console.log(`   CLIENT PAYS:          $${fees.totalClientPays.toFixed(2)}`);
        console.log(`   Tasker Fee (15%):    -$${fees.taskerPlatformFee.toFixed(2)}`);
        console.log(`   TASKER RECEIVES:      $${fees.taskerPayout.toFixed(2)}`);

        res.status(200).json({
            success: true,
            fees: {
                bidAmount: fees.bidAmount,
                clientPlatformFee: fees.clientPlatformFee,
                taxOnClientFee: fees.taxOnClientFee,
                totalClientPays: fees.totalClientPays,
                taskerPlatformFee: fees.taskerPlatformFee,
                taskerPayout: fees.taskerPayout,
                platformTotal: fees.platformTotal,
            }
        });

    } catch (error) {
        console.error('Error calculating fees:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const submitBid = async (req, res) => {
    try {
        const { quoteId } = req.params;
        const { bidAmount, bidDescription, estimatedDuration } = req.body;
        const taskerId = req.user.id;

        console.log('=== SUBMIT BID ===');
        console.log('quoteId:', quoteId);
        console.log('taskerId:', taskerId);
        console.log('body:', req.body);

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
        if (bidAmountInCents < 100) { // Minimum $1
            return res.status(400).json({
                message: 'Minimum bid amount is $1.00'
            });
        }

        // Find the quote
        const quote = await RequestQuote.findById(quoteId);

        if (!quote) {
            return res.status(404).json({ message: 'Quote not found' });
        }

        console.log('Quote tasker ID (raw):', quote.tasker);
        console.log('Logged in taskerId:', taskerId);

        // Check ownership
        if (!quote.tasker) {
            return res.status(400).json({ message: 'This quote has no assigned tasker' });
        }

        if (quote.tasker.toString() !== taskerId) {
            return res.status(403).json({
                message: 'Unauthorized: Only the assigned tasker can bid on this quote'
            });
        }

        // Check if quote status allows bidding
        const nonBiddableStatuses = ['accepted', 'completed', 'in_progress', 'cancelled', 'expired'];
        if (nonBiddableStatuses.includes(quote.status)) {
            return res.status(400).json({
                message: `Cannot bid on a quote with status: ${quote.status}`
            });
        }

        // ✅ Calculate fees
        const fees = calculateQuoteFees(bidAmountInCents);

        console.log('💰 DOUBLE-SIDED FEE Quote Bid Breakdown:');
        console.log(`   Bid Amount:           $${fees.bidAmount.toFixed(2)}`);
        console.log(`   Client Fee (15%):     $${fees.clientPlatformFee.toFixed(2)}`);
        console.log(`   Tax (13% HST):        $${fees.taxOnClientFee.toFixed(2)}`);
        console.log(`   TOTAL CLIENT PAYS:    $${fees.totalClientPays.toFixed(2)}`);
        console.log(`   Tasker Fee (15%):    -$${fees.taskerPlatformFee.toFixed(2)}`);
        console.log(`   TASKER RECEIVES:      $${fees.taskerPayout.toFixed(2)}`);
        console.log(`   PLATFORM KEEPS:       $${fees.platformTotal.toFixed(2)}`);

        // ✅ CREATE BID WITH FEE BREAKDOWN
        const newBid = {
            tasker: new mongoose.Types.ObjectId(taskerId),
            bidAmount: Number(bidAmount),
            bidDescription: bidDescription?.trim() || '',
            estimatedDuration: Number(estimatedDuration) || 1,
            submittedAt: new Date(),
            status: 'pending',

            // Store fee breakdown for later use when accepted
            feeBreakdown: {
                bidAmountCents: fees.bidAmountCents,
                clientPlatformFeeCents: fees.clientPlatformFeeCents,
                taxOnClientFeeCents: fees.taxOnClientFeeCents,
                totalClientPaysCents: fees.totalClientPaysCents,
                taskerPlatformFeeCents: fees.taskerPlatformFeeCents,
                taskerPayoutCents: fees.taskerPayoutCents,
                platformTotalCents: fees.platformTotalCents,
            }
        };

        console.log('=== NEW BID OBJECT ===');
        console.log(JSON.stringify(newBid, null, 2));

        // Add bid to the quote
        quote.bids.push(newBid);

        // Update status to 'bidded' if first bid or still pending
        if (quote.status === 'pending' || quote.status === 'rejected') {
            quote.status = 'bidded';
        }

        // Save the updated quote
        await quote.save();

        // Populate for response
        const populatedQuote = await RequestQuote.findById(quoteId)
            .populate('tasker', 'firstName lastName email phone currentRole')
            .populate('client', 'firstName lastName email phone currentRole')
            .populate('bids.tasker', 'firstName lastName');

        if (!populatedQuote) {
            return res.status(500).json({ message: 'Error retrieving updated quote' });
        }

        // Get names for notifications
        const taskerName = populatedQuote.tasker
            ? `${populatedQuote.tasker.firstName} ${populatedQuote.tasker.lastName}`
            : 'The tasker';

        const clientName = populatedQuote.client
            ? `${populatedQuote.client.firstName} ${populatedQuote.client.lastName}`
            : 'The client';

        // Format duration
        const duration = Number(estimatedDuration) || 1;
        const durationText = `${duration} hour${duration !== 1 ? 's' : ''}`;

        // Notification to client (show what they'll pay)
        try {
            const isFirstBid = quote.bids.length === 1;

            const notificationTitle = isFirstBid
                ? '🎉 First Bid Received!'
                : '💰 New Bid Received!';

            let notificationMessage = `${taskerName} submitted a bid of $${bidAmount} for your quote request "${populatedQuote.taskTitle}". `;
            notificationMessage += `Total with fees: $${fees.totalClientPays.toFixed(2)}. `;
            notificationMessage += `Estimated duration: ${durationText}.`;

            if (bidDescription && bidDescription.trim()) {
                const truncatedDescription = bidDescription.length > 50
                    ? `${bidDescription.substring(0, 50)}...`
                    : bidDescription;
                notificationMessage += ` Note: "${truncatedDescription}"`;
            }

            notificationMessage += ' Review and respond!';

            if (populatedQuote.client?._id) {
                await createNotification(
                    populatedQuote.client._id,
                    notificationTitle,
                    notificationMessage,
                    'quote-bid-received',
                    quoteId
                );
                console.log('✅ Notification sent to client');
            }
        } catch (notifErr) {
            console.error('❌ Client notification failed:', notifErr.message);
        }

        // Notification to tasker (show what they'll receive)
        try {
            await createNotification(
                taskerId,
                '✅ Bid Submitted Successfully',
                `Your bid of $${bidAmount} for "${populatedQuote.taskTitle}" has been submitted. You'll receive $${fees.taskerPayout.toFixed(2)} (after 15% platform fee) when completed. ${clientName} will be notified.`,
                'quote-bid-submitted',
                quoteId
            );
            console.log('✅ Confirmation sent to tasker');
        } catch (notifErr) {
            console.error('❌ Tasker notification failed:', notifErr.message);
        }

        // Success - include fee breakdown in response
        console.log('=== BID SUBMITTED SUCCESSFULLY ===');
        res.status(201).json({
            success: true,
            message: 'Bid submitted successfully',
            quote: populatedQuote,
            feeBreakdown: {
                bidAmount: fees.bidAmount,
                clientPlatformFee: fees.clientPlatformFee,
                taxOnClientFee: fees.taxOnClientFee,
                totalClientPays: fees.totalClientPays,
                taskerPlatformFee: fees.taskerPlatformFee,
                taskerPayout: fees.taskerPayout,
                platformTotal: fees.platformTotal,
            }
        });

    } catch (error) {
        console.error('=== ERROR SUBMITTING BID ===');
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);

        if (error.name === 'ValidationError') {
            console.error('Validation errors:');
            for (const field in error.errors) {
                console.error(`  ${field}: ${error.errors[field].message}`);
            }
            const messages = Object.values(error.errors).map(e => e.message);
            return res.status(400).json({
                message: 'Validation error',
                errors: messages
            });
        }

        if (error.name === 'CastError') {
            return res.status(400).json({ message: 'Invalid ID format' });
        }

        res.status(500).json({
            message: 'Server error while submitting bid',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};





// export const acceptBid = async (req, res) => {
//     try {
//         const { quoteId, bidId } = req.params;
//         const clientId = req.user.id;

//         const quote = await RequestQuote.findById(quoteId)
//             .populate('client', 'firstName lastName email stripeCustomerId defaultPaymentMethod')
//             .populate('tasker', 'firstName lastName email stripeConnectAccountId stripeConnectStatus');

//         if (!quote) {
//             return res.status(404).json({ message: 'Quote not found' });
//         }

//         if (quote.client._id.toString() !== clientId) {
//             return res.status(403).json({ message: 'Unauthorized' });
//         }

//         const bid = quote.bids.id(bidId);
//         if (!bid || bid.status !== 'pending') {
//             return res.status(400).json({ message: 'Bid not found or already decided' });
//         }

//         // ⭐ Validate tasker can receive payments
//         let taskerStripeAccountId;
//         try {
//             taskerStripeAccountId = await validateTaskerCanReceivePayments(quote.tasker._id);
//         } catch (connectError) {
//             return res.status(400).json({
//                 error: connectError.message,
//                 code: 'TASKER_PAYMENT_NOT_SETUP',
//             });
//         }

//         // Get client payment info
//         const client = quote.client;
//         if (!client.stripeCustomerId || !client.defaultPaymentMethod) {
//             return res.status(400).json({
//                 message: 'Please add a payment method first',
//                 code: 'NO_PAYMENT_METHOD'
//             });
//         }

//         // Calculate amounts
//         const amountInCents = Math.round(bid.bidAmount * 100);
//         const { platformFee, taskerPayout } = calculateFees(amountInCents);

//         // ⭐ Create PaymentIntent with split
//         const paymentIntent = await stripe.paymentIntents.create({
//             amount: amountInCents,
//             currency: 'cad',
//             customer: client.stripeCustomerId,
//             payment_method: client.defaultPaymentMethod,
//             capture_method: 'manual',
//             description: `Quote: ${quote.taskTitle}`,

//             application_fee_amount: platformFee,
//             transfer_data: {
//                 destination: taskerStripeAccountId,
//             },

//             metadata: {
//                 type: 'quote',
//                 quoteId: quoteId,
//                 bidId: bidId,
//             },
//             automatic_payment_methods: {
//                 enabled: true,
//                 allow_redirects: 'never'
//             },
//             confirm: true,
//         });

//         if (paymentIntent.status !== 'requires_capture') {
//             return res.status(400).json({
//                 message: 'Payment authorization failed',
//                 error: paymentIntent.last_payment_error?.message
//             });
//         }

//         // Update bid status
//         bid.status = 'accepted';
//         quote.bids.forEach(b => {
//             if (b._id.toString() !== bidId) b.status = 'rejected';
//         });

//         quote.status = 'accepted';
//         quote.acceptedBid = {
//             bidId: bid._id,
//             tasker: quote.tasker._id,
//             bidAmount: bid.bidAmount,
//             bidDescription: bid.bidDescription,
//             acceptedAt: new Date(),
//         };

//         // ⭐ Save payment info
//         quote.payment = {
//             paymentIntentId: paymentIntent.id,
//             status: 'held',
//             grossAmount: amountInCents,
//             platformFee: platformFee,
//             taskerPayout: taskerPayout,
//             currency: 'cad',
//             authorizedAt: new Date(),
//         };

//         await quote.save();

//         // Notifications
//         const clientName = `${client.firstName} ${client.lastName}`;
//         const taskerName = `${quote.tasker.firstName} ${quote.tasker.lastName}`;
//         const taskerPayoutFormatted = (taskerPayout / 100).toFixed(2);

//         try {
//             await createNotification(
//                 quote.tasker._id,
//                 "🎉 Your Bid Was Accepted!",
//                 `${clientName} has accepted your bid of $${bid.bidAmount} for "${quote.taskTitle}". Payment is held. You'll receive $${taskerPayoutFormatted} when completed.`,
//                 'quote-bid-accepted',
//                 quoteId
//             );
//         } catch (notifErr) {
//             console.error("Notification failed:", notifErr);
//         }

//         res.status(200).json({
//             message: 'Bid accepted successfully',
//             quote,
//             paymentBreakdown: {
//                 total: bid.bidAmount,
//                 platformFee: platformFee / 100,
//                 taskerPayout: taskerPayout / 100,
//             }
//         });

//     } catch (error) {
//         console.error('Error accepting bid:', error);
//         res.status(500).json({ message: 'Server error' });
//     }
// };




const calculateQuoteFeesClient = (bidAmountInCents) => {
    // Client side: adds 15% + tax on that fee
    const clientPlatformFee = Math.round(bidAmountInCents * PLATFORM_FEE_PERCENT);
    const taxOnClientFee = Math.round(clientPlatformFee * TAX_PERCENT);
    const totalClientPays = bidAmountInCents + clientPlatformFee + taxOnClientFee;

    // Tasker side: deducts 15% from bid amount
    const taskerPlatformFee = Math.round(bidAmountInCents * PLATFORM_FEE_PERCENT);
    const taskerPayout = bidAmountInCents - taskerPlatformFee;

    // Platform keeps both fees (client fee + tax + tasker fee)
    const platformTotal = clientPlatformFee + taxOnClientFee + taskerPlatformFee;

    // Application fee for Stripe = totalClientPays - taskerPayout
    const applicationFee = totalClientPays - taskerPayout;

    return {
        // In cents
        bidAmountCents: bidAmountInCents,
        clientPlatformFeeCents: clientPlatformFee,
        taxOnClientFeeCents: taxOnClientFee,
        totalClientPaysCents: totalClientPays,
        taskerPlatformFeeCents: taskerPlatformFee,
        taskerPayoutCents: taskerPayout,
        platformTotalCents: platformTotal,
        applicationFeeCents: applicationFee,

        // In dollars (for display)
        bidAmount: bidAmountInCents / 100,
        clientPlatformFee: clientPlatformFee / 100,
        taxOnClientFee: taxOnClientFee / 100,
        totalClientPays: totalClientPays / 100,
        taskerPlatformFee: taskerPlatformFee / 100,
        taskerPayout: taskerPayout / 100,
        platformTotal: platformTotal / 100,
        applicationFee: applicationFee / 100,
    };
};

// NEW: Preview fees endpoint for client (before accepting bid)
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
        const fees = calculateQuoteFeesClient(bidAmountInCents);

        console.log('💰 Quote Accept Fee Preview:');
        console.log(`   Bid Amount:           $${fees.bidAmount.toFixed(2)}`);
        console.log(`   Client Fee (15%):     $${fees.clientPlatformFee.toFixed(2)}`);
        console.log(`   Tax (13% HST):        $${fees.taxOnClientFee.toFixed(2)}`);
        console.log(`   YOU PAY:              $${fees.totalClientPays.toFixed(2)}`);
        console.log(`   Tasker Fee (15%):    -$${fees.taskerPlatformFee.toFixed(2)}`);
        console.log(`   TASKER RECEIVES:      $${fees.taskerPayout.toFixed(2)}`);

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
                clientPlatformFee: fees.clientPlatformFee,
                taxOnClientFee: fees.taxOnClientFee,
                totalClientPays: fees.totalClientPays,
                taskerPlatformFee: fees.taskerPlatformFee,
                taskerPayout: fees.taskerPayout,
                platformTotal: fees.platformTotal,
            }
        });

    } catch (error) {
        console.error('Error previewing fees:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const acceptBid = async (req, res) => {
    console.log('=== ACCEPT BID REQUEST ===');
    console.log('req.body:', req.body);

    try {
        const { quoteId, bidId } = req.params;
        const clientId = req.user.id;

        const body = req.body || {};
        const paymentMethodId = body.paymentMethodId || null;

        console.log('=== ACCEPT BID WITH DOUBLE-SIDED FEES ===');
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
            .populate('client', 'firstName lastName email phone stripeCustomerId defaultPaymentMethod address')
            .populate('tasker', 'firstName lastName email phone stripeConnectAccountId stripeConnectStatus');

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

        // Validate tasker can receive payments
        let taskerStripeAccountId;
        try {
            taskerStripeAccountId = await validateTaskerCanReceivePayments(quote.tasker._id);
            console.log('✅ Tasker Stripe Connect validated:', taskerStripeAccountId);
        } catch (connectError) {
            return res.status(400).json({
                message: connectError.message,
                code: 'TASKER_PAYMENT_NOT_SETUP',
            });
        }

        // Get client payment info
        const client = quote.client;
        const customerPaymentMethod = paymentMethodId || client.defaultPaymentMethod;

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
                // Add address if available
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
            // Don't fail the transaction, just log
        }

        // Calculate DOUBLE-SIDED fees
        const bidAmountInCents = Math.round(bid.bidAmount * 100);
        const fees = calculateQuoteFeesClient(bidAmountInCents);

        console.log('💰 DOUBLE-SIDED FEE Quote Payment Breakdown:');
        console.log(`   Bid Amount:           $${fees.bidAmount.toFixed(2)}`);
        console.log(`   Client Fee (15%):     $${fees.clientPlatformFee.toFixed(2)}`);
        console.log(`   Tax (13% HST):        $${fees.taxOnClientFee.toFixed(2)}`);
        console.log(`   TOTAL CLIENT PAYS:    $${fees.totalClientPays.toFixed(2)}`);
        console.log(`   Tasker Fee (15%):    -$${fees.taskerPlatformFee.toFixed(2)}`);
        console.log(`   TASKER RECEIVES:      $${fees.taskerPayout.toFixed(2)}`);
        console.log(`   PLATFORM KEEPS:       $${fees.platformTotal.toFixed(2)}`);
        console.log(`   Application Fee:      $${fees.applicationFee.toFixed(2)}`);

        // Minimum amount check
        if (fees.totalClientPaysCents < 50) {
            return res.status(400).json({
                message: 'Minimum payment amount is $0.50 CAD',
                code: 'AMOUNT_TOO_SMALL'
            });
        }

        // ✅ Create PaymentIntent with detailed description and receipt email
        const clientFullName = `${client.firstName} ${client.lastName}`.trim();
        const taskerFullName = `${quote.tasker.firstName} ${quote.tasker.lastName}`.trim();

        let paymentIntent;
        try {
            paymentIntent = await stripe.paymentIntents.create({
                amount: fees.totalClientPaysCents,
                currency: 'cad',
                customer: client.stripeCustomerId,
                payment_method: customerPaymentMethod,
                capture_method: 'manual',

                // ✅ Add detailed description
                description: `Quote Payment: "${quote.taskTitle}" | Client: ${clientFullName} | Tasker: ${taskerFullName}`,

                // ✅ Send receipt to client's email
                receipt_email: client.email,

                // ✅ Statement descriptor (appears on bank/card statement - max 22 chars)
                statement_descriptor: 'TASKALLO QUOTE',
                statement_descriptor_suffix: quote.taskTitle.substring(0, 10).toUpperCase(),

                application_fee_amount: fees.applicationFeeCents,

                transfer_data: {
                    destination: taskerStripeAccountId,
                },

                // ✅ Enhanced metadata
                metadata: {
                    type: 'quote',
                    quoteId: quoteId,
                    bidId: bidId,
                    taskTitle: quote.taskTitle.substring(0, 100),

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
                    totalClientPays: fees.totalClientPays.toString(),
                    taskerPayout: fees.taskerPayout.toString(),
                    platformFee: fees.platformTotal.toString(),

                    feeStructure: 'double-sided-15-percent',
                    platform: 'taskallo',
                },

                // ✅ Shipping/billing details (optional - for better records)
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

        // Update bid status
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
            acceptedAt: new Date(),
        };

        // Save COMPLETE payment info with fee breakdown
        quote.payment = {
            paymentIntentId: paymentIntent.id,
            status: 'held',
            currency: 'cad',
            authorizedAt: new Date(),
            feeStructure: 'double-sided-15-percent',

            bidAmountCents: fees.bidAmountCents,
            clientPlatformFeeCents: fees.clientPlatformFeeCents,
            taxOnClientFeeCents: fees.taxOnClientFeeCents,
            totalClientPaysCents: fees.totalClientPaysCents,
            taskerPlatformFeeCents: fees.taskerPlatformFeeCents,
            taskerPayoutCents: fees.taskerPayoutCents,
            applicationFeeCents: fees.applicationFeeCents,

            grossAmount: fees.totalClientPaysCents,
            platformFee: fees.applicationFeeCents,
            taskerPayout: fees.taskerPayoutCents,
        };

        await quote.save();
        console.log('✅ Quote updated and saved');

        // Notifications
        try {
            await createNotification(
                quote.tasker._id,
                "🎉 Your Bid Was Accepted!",
                `${clientFullName} has accepted your bid of $${fees.bidAmount.toFixed(2)} for "${quote.taskTitle}". Payment of $${fees.totalClientPays.toFixed(2)} is held. You'll receive $${fees.taskerPayout.toFixed(2)} when completed.`,
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
                `You've accepted ${taskerFullName}'s bid of $${fees.bidAmount.toFixed(2)} for "${quote.taskTitle}". Total charged: $${fees.totalClientPays.toFixed(2)}. Payment is held until completion.`,
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

        console.log('=== BID ACCEPTED SUCCESSFULLY ===');

        res.status(200).json({
            success: true,
            message: 'Bid accepted successfully',
            quote: populatedQuote,
            paymentBreakdown: {
                bidAmount: fees.bidAmount,
                clientPlatformFee: fees.clientPlatformFee,
                taxOnClientFee: fees.taxOnClientFee,
                totalClientPays: fees.totalClientPays,
                taskerPlatformFee: fees.taskerPlatformFee,
                taskerPayout: fees.taskerPayout,
                platformTotal: fees.platformTotal,
                applicationFee: fees.applicationFee,
                currency: 'cad',
                status: 'held',
            }
        });

    } catch (error) {
        console.error('=== ERROR ACCEPTING BID ===');
        console.error('Error:', error);
        res.status(500).json({
            message: 'Server error while accepting bid',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};
// Helper function - make sure this is defined
// const validateTaskerCanReceivePayments = async (taskerId) => {
//     const tasker = await User.findById(taskerId);

//     if (!tasker) {
//         throw new Error('Tasker not found');
//     }

//     if (!tasker.stripeConnectAccountId) {
//         throw new Error('Tasker has not set up payment receiving');
//     }

//     if (tasker.stripeConnectStatus !== 'active') {
//         throw new Error('Tasker payment account is not active');
//     }

//     // Verify with Stripe
//     const account = await stripe.accounts.retrieve(tasker.stripeConnectAccountId);

//     if (!account.charges_enabled || !account.payouts_enabled) {
//         throw new Error('Tasker payment account is not fully set up');
//     }

//     return tasker.stripeConnectAccountId;
// };









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



// ... (rest of existing code remains unchanged)

export { createBooking, getAllBookings, getBookingsByUserId, updateBooking, deleteBooking, createRequestQuote, getAllRequestQuotes, getRequestQuotesByClientId, updateRequestQuote, deleteRequestQuote, };