


// // models/User.js
// import mongoose from "mongoose";
// import bcrypt from "bcrypt";

// const serviceSchema = new mongoose.Schema({
//   title: String,
//   description: String,
//   hourlyRate: Number,
//   fixedPrice: Number,
//   estimatedDuration: String,
//   category: String,
//   isActive: { type: Boolean, default: true },
// });

// const availabilitySchema = new mongoose.Schema({
//   day: {
//     type: String,
//     enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
//   },
//   from: String,  // "09:00"
//   to: String,    // "17:00"
//   isAvailable: { type: Boolean, default: true },
// });

// const reviewSchema = new mongoose.Schema({
//   reviewer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
//   taskId: { type: mongoose.Schema.Types.ObjectId, ref: "Task" },
//   bookingId: { type: mongoose.Schema.Types.ObjectId, ref: "Booking" },
//   rating: { type: Number, min: 1, max: 5, required: true },
//   message: { type: String, required: true },
//   createdAt: { type: Date, default: Date.now },
// });

// const userSchema = new mongoose.Schema(
//   {
//     // ==================== ROLE MANAGEMENT ====================
//     roles: {
//       type: [String],
//       enum: ["client", "tasker", "admin"],
//       default: ["client"],
//     },
//     currentRole: {
//       type: String,
//       enum: ["client", "tasker", "admin"],
//       default: "client",
//     },

//     // ==================== BASIC INFO ====================
//     firstName: { type: String, required: true },
//     lastName: { type: String, required: true },
//     email: { type: String, required: true, unique: true, lowercase: true },
//     phone: { type: String, required: true },
//     password: { type: String, required: true },
//     profilePicture: String,
//     about: String,
//     dob: Date,
//     language: { type: String, default: 'en' },

//     // ==================== ADDRESS ====================
//     address: {
//       street: String,
//       city: String,
//       province: String,
//       postalCode: String,
//       country: { type: String, default: 'CA' },
//       coordinates: {
//         lat: Number,
//         lng: Number,
//       },
//     },

//     // ==================== ACCOUNT STATUS ====================
//     isBlocked: { type: Boolean, default: false },
//     isEmailVerified: { type: Boolean, default: false },
//     isPhoneVerified: { type: Boolean, default: false },

//     // ==================== STRIPE - CLIENT (for paying) ====================
//     stripeCustomerId: { type: String },
//     defaultPaymentMethodId: { type: String },
//     paymentMethods: [{
//       id: String,
//       brand: String,       // visa, mastercard
//       last4: String,       // last 4 digits
//       expiryMonth: Number,
//       expiryYear: Number,
//       isDefault: Boolean,
//     }],

//     // ==================== STRIPE CONNECT - TASKER (for receiving) ====================
//     stripeConnectAccountId: { type: String },
//     stripeConnectStatus: {
//       type: String,
//       enum: [
//         'not_connected',      // Haven't started
//         'onboarding_started', // Started but not completed
//         'pending',            // Submitted, waiting for Stripe
//         'active',             // Fully verified, can receive payments
//         'restricted',         // Some issue, limited functionality
//         'rejected'            // Rejected by Stripe
//       ],
//       default: 'not_connected'
//     },
//     stripeConnectDetails: {
//       chargesEnabled: { type: Boolean, default: false },
//       payoutsEnabled: { type: Boolean, default: false },
//       detailsSubmitted: { type: Boolean, default: false },
//       currentlyDue: [String],      // Required fields
//       eventuallyDue: [String],
//       pastDue: [String],           // Overdue requirements
//       disabledReason: String,
//     },
//     stripeConnectCreatedAt: Date,
//     stripeConnectVerifiedAt: Date,

//     // ==================== TASKER APPLICATION ====================
//     taskerStatus: {
//       type: String,
//       enum: ["not_applied", "under_review", "approved", "rejected"],
//       default: "not_applied",
//     },
//     taskerAppliedAt: Date,
//     taskerApprovedAt: Date,
//     taskerRejectedAt: Date,
//     taskerRejectionReason: String,
//     taskerProfileComplete: { type: Boolean, default: false },

//     // ==================== TASKER PROFILE ====================
//     categories: [String],
//     skills: [String],
//     services: [serviceSchema],
//     availability: [availabilitySchema],

//     travelDistance: { type: Number, default: 25 },  // km
//     serviceAreas: [String],
//     yearsOfExperience: Number,
//     qualifications: [String],
//     certifications: [String],

//     // ==================== TASKER VERIFICATION ====================
//     idVerification: {
//       type: { type: String, enum: ["passport", "governmentID", "driverLicense"] },
//       documentFront: String,
//       issueDate: Date,      // ADD THIS
//       expiryDate: Date,
//       documentBack: String,
//       verified: { type: Boolean, default: false },
//       verifiedAt: Date,
//     },
//     backgroundCheck: {
//       consented: { type: Boolean, default: false },
//       completed: { type: Boolean, default: false },
//       completedAt: Date,
//       status: { type: String, enum: ['pending', 'passed', 'failed'] },
//     },
//     insurance: {
//       hasInsurance: { type: Boolean, default: false },
//       documentUrl: String,
//       expiryDate: Date,
//       verified: { type: Boolean, default: false },
//     },

//     // ==================== TASKER SETTINGS ====================
//     pricingType: {
//       type: String,
//       enum: ["hourly", "fixed", "both"],
//       default: "hourly"
//     },
//     chargesGST: { type: Boolean, default: false },
//     advanceNotice: { type: Number, default: 24 },  // hours

//     // ==================== RATINGS ====================
//     rating: {
//       type: Number,
//       min: 0,
//       max: 5,
//       default: 0,
//     },
//     reviewCount: { type: Number, default: 0 },
//     reviews: [reviewSchema],

//     // ==================== STATS ====================
//     stats: {
//       tasksCompleted: { type: Number, default: 0 },
//       bookingsCompleted: { type: Number, default: 0 },
//       totalEarnings: { type: Number, default: 0 },  // in cents
//       responseRate: { type: Number, default: 100 }, // percentage
//       completionRate: { type: Number, default: 100 },
//     },

//     // ==================== AGREEMENTS ====================
//     agreements: {
//       terms: { accepted: Boolean, acceptedAt: Date },
//       privacy: { accepted: Boolean, acceptedAt: Date },
//       taxResponsibility: { accepted: Boolean, acceptedAt: Date },
//     },
//   },
//   { timestamps: true }
// );

// // ==================== INDEXES ====================
// userSchema.index({ email: 1 });
// userSchema.index({ currentRole: 1 });
// userSchema.index({ taskerStatus: 1 });
// userSchema.index({ 'address.city': 1 });
// userSchema.index({ categories: 1 });
// userSchema.index({ rating: -1 });
// userSchema.index({ stripeConnectAccountId: 1 });
// userSchema.index({ stripeCustomerId: 1 });

// // ==================== VIRTUALS ====================
// userSchema.virtual('fullName').get(function () {
//   return `${this.firstName} ${this.lastName}`;
// });

// userSchema.virtual('isTasker').get(function () {
//   return this.roles.includes('tasker') && this.taskerStatus === 'approved';
// });

// userSchema.virtual('canReceivePayments').get(function () {
//   return this.stripeConnectStatus === 'active' &&
//     this.stripeConnectDetails?.payoutsEnabled === true;
// });

// // ==================== METHODS ====================
// userSchema.methods.comparePassword = async function (enteredPassword) {
//   return await bcrypt.compare(enteredPassword, this.password);
// };

// // ==================== PRE-SAVE ====================
// userSchema.pre('save', async function (next) {
//   if (!this.isModified('password')) return next();
//   this.password = await bcrypt.hash(this.password, 10);
//   next();
// });

// export default mongoose.models.User || mongoose.model("User", userSchema);


// models/User.js
import mongoose from "mongoose";
import bcrypt from "bcrypt";

const serviceSchema = new mongoose.Schema({
  title: String,
  description: String,
  hourlyRate: Number,
  fixedPrice: Number,
  estimatedDuration: String,
  category: String,
  isActive: { type: Boolean, default: true },
});

const availabilitySchema = new mongoose.Schema({
  day: {
    type: String,
    enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  },
  from: String,  // "09:00"
  to: String,    // "17:00"
  isAvailable: { type: Boolean, default: true },
});

const reviewSchema = new mongoose.Schema({
  reviewer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  taskId: { type: mongoose.Schema.Types.ObjectId, ref: "Task" },
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: "Booking" },
  rating: { type: Number, min: 1, max: 5, required: true },
  message: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const userSchema = new mongoose.Schema(
  {
    // ==================== ROLE MANAGEMENT ====================
    roles: {
      type: [String],
      enum: ["client", "tasker", "admin"],
      default: ["client"],
    },
    currentRole: {
      type: String,
      enum: ["client", "tasker", "admin"],
      default: "client",
    },

    // ==================== BASIC INFO ====================
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    phone: { type: String, required: true },
    password: { type: String, required: true },
    profilePicture: String,
    about: String,
    dob: Date,
    language: { type: String, default: 'en' },

    // ==================== ADDRESS ====================
    address: {
      street: String,
      city: String,
      province: String,
      postalCode: String,
      country: { type: String, default: 'CA' },
      coordinates: {
        lat: Number,
        lng: Number,
      },
    },

    // ==================== ACCOUNT STATUS ====================
    isBlocked: { type: Boolean, default: false },
    isEmailVerified: { type: Boolean, default: false },
    isPhoneVerified: { type: Boolean, default: false },

    // ==================== STRIPE - CLIENT (for paying) ====================
    stripeCustomerId: { type: String },
    defaultPaymentMethodId: { type: String },
    paymentMethods: [{
      id: String,
      brand: String,       // visa, mastercard
      last4: String,       // last 4 digits
      expiryMonth: Number,
      expiryYear: Number,
      isDefault: Boolean,
    }],

    // ==================== STRIPE CONNECT - TASKER (for receiving) - DEPRECATED ====================
    // ⚠️ These fields are kept for backward compatibility but no longer used
    stripeConnectAccountId: { type: String },
    stripeConnectStatus: {
      type: String,
      enum: [
        'not_connected',
        'onboarding_started',
        'pending',
        'active',
        'restricted',
        'rejected'
      ],
      default: 'not_connected'
    },
    stripeConnectDetails: {
      chargesEnabled: { type: Boolean, default: false },
      payoutsEnabled: { type: Boolean, default: false },
      detailsSubmitted: { type: Boolean, default: false },
      currentlyDue: [String],
      eventuallyDue: [String],
      pastDue: [String],
      disabledReason: String,
    },
    stripeConnectCreatedAt: Date,
    stripeConnectVerifiedAt: Date,

    // ==================== BANK ACCOUNT - NEW (for manual payouts) ====================
    bankAccount: {
      accountHolderName: {
        type: String,
        trim: true,
      },
      accountNumber: {
        type: String,
        // ⚠️ In production, this should be encrypted at rest
      },
      routingNumber: {
        type: String,
        trim: true,
      },
      bankName: {
        type: String,
        trim: true,
      },
      accountType: {
        type: String,
        enum: ['checking', 'savings'],
        default: 'checking'
      },
      verified: {
        type: Boolean,
        default: false
      },
      verifiedAt: Date,
      verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      addedAt: {
        type: Date,
        default: Date.now
      },
      // Security: Last 4 digits only for display
      last4: String,
    },

    // ==================== TASKER APPLICATION ====================
    taskerStatus: {
      type: String,
      enum: ["not_applied", "under_review", "approved", "rejected"],
      default: "not_applied",
    },
    taskerAppliedAt: Date,
    taskerApprovedAt: Date,
    taskerRejectedAt: Date,
    taskerRejectionReason: String,
    taskerProfileComplete: { type: Boolean, default: false },

    // ==================== TASKER PROFILE ====================
    categories: [String],
    skills: [String],
    services: [serviceSchema],
    availability: [availabilitySchema],

    travelDistance: { type: Number, default: 25 },  // km
    serviceAreas: [String],
    yearsOfExperience: Number,
    qualifications: [String],
    certifications: [String],

    // ==================== TASKER VERIFICATION ====================
    idVerification: {
      type: { type: String, enum: ["passport", "governmentID", "driverLicense"] },
      documentFront: String,
      issueDate: Date,
      expiryDate: Date,
      documentBack: String,
      verified: { type: Boolean, default: false },
      verifiedAt: Date,
    },
    backgroundCheck: {
      consented: { type: Boolean, default: false },
      completed: { type: Boolean, default: false },
      completedAt: Date,
      status: { type: String, enum: ['pending', 'passed', 'failed'] },
    },
    insurance: {
      hasInsurance: { type: Boolean, default: false },
      documentUrl: String,
      expiryDate: Date,
      verified: { type: Boolean, default: false },
    },

    // ==================== TASKER SETTINGS ====================
    pricingType: {
      type: String,
      enum: ["hourly", "fixed", "both"],
      default: "hourly"
    },
    chargesGST: { type: Boolean, default: false },
    advanceNotice: { type: Number, default: 24 },  // hours

    // ==================== RATINGS ====================
    rating: {
      type: Number,
      min: 0,
      max: 5,
      default: 0,
    },
    reviewCount: { type: Number, default: 0 },
    reviews: [reviewSchema],

    // Add to your User model (models/User.js)

    // Inside userSchema, add:
    wallet: {
      balance: { type: Number, default: 0 },           // Current available balance (in dollars)
      pendingWithdrawal: { type: Number, default: 0 }, // Amount in pending withdrawals
      totalEarned: { type: Number, default: 0 },       // Lifetime earnings
      totalWithdrawn: { type: Number, default: 0 },    // Lifetime withdrawals
      lastUpdated: { type: Date, default: Date.now },
    },
    // ==================== STATS ====================
    stats: {
      tasksCompleted: { type: Number, default: 0 },
      bookingsCompleted: { type: Number, default: 0 },
      totalEarnings: { type: Number, default: 0 },  // in cents
      responseRate: { type: Number, default: 100 }, // percentage
      completionRate: { type: Number, default: 100 },
    },

    // ==================== AGREEMENTS ====================
    agreements: {
      terms: { accepted: Boolean, acceptedAt: Date },
      privacy: { accepted: Boolean, acceptedAt: Date },
      taxResponsibility: { accepted: Boolean, acceptedAt: Date },
    },
  },
  { timestamps: true }
);

// ==================== INDEXES ====================
userSchema.index({ email: 1 });
userSchema.index({ currentRole: 1 });
userSchema.index({ taskerStatus: 1 });
userSchema.index({ 'address.city': 1 });
userSchema.index({ categories: 1 });
userSchema.index({ rating: -1 });
userSchema.index({ stripeConnectAccountId: 1 });
userSchema.index({ stripeCustomerId: 1 });
userSchema.index({ 'bankAccount.verified': 1 }); // ⭐ NEW INDEX

// ==================== VIRTUALS ====================
userSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

userSchema.virtual('isTasker').get(function () {
  return this.roles.includes('tasker') && this.taskerStatus === 'approved';
});

// ⭐ UPDATED: New payment eligibility check
userSchema.virtual('canReceivePayments').get(function () {
  // Now based on bank account verification instead of Stripe Connect
  return this.bankAccount &&
    this.bankAccount.verified === true &&
    this.bankAccount.accountNumber &&
    this.bankAccount.routingNumber;
});

// ⭐ NEW: Check if bank account is complete
userSchema.virtual('hasBankAccount').get(function () {
  return this.bankAccount &&
    this.bankAccount.accountHolderName &&
    this.bankAccount.accountNumber &&
    this.bankAccount.routingNumber &&
    this.bankAccount.bankName;
});

// ==================== METHODS ====================
userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// ⭐ NEW: Method to securely get bank account info (hide full account number)
userSchema.methods.getSafeBankAccountInfo = function () {
  if (!this.bankAccount) return null;

  return {
    accountHolderName: this.bankAccount.accountHolderName,
    bankName: this.bankAccount.bankName,
    accountType: this.bankAccount.accountType,
    last4: this.bankAccount.last4 || this.bankAccount.accountNumber?.slice(-4),
    verified: this.bankAccount.verified,
    verifiedAt: this.bankAccount.verifiedAt,
    addedAt: this.bankAccount.addedAt,
  };
};

// ==================== PRE-SAVE ====================
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// ⭐ NEW: Auto-populate last4 when account number changes
userSchema.pre('save', function (next) {
  if (this.isModified('bankAccount.accountNumber') && this.bankAccount?.accountNumber) {
    this.bankAccount.last4 = this.bankAccount.accountNumber.slice(-4);
  }
  next();
});

export default mongoose.models.User || mongoose.model("User", userSchema);