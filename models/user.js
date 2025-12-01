import mongoose from "mongoose";
import bcrypt from "bcrypt";

const serviceSchema = new mongoose.Schema({
  title: String,
  description: String,
  hourlyRate: Number,
  estimatedDuration: String,
});

const availabilitySchema = new mongoose.Schema({
  day: String,
  from: String,
  to: String,
});

const reviewSchema = new mongoose.Schema({
  reviewer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  rating: { type: Number, min: 0, max: 5, required: true },
  message: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const userSchema = new mongoose.Schema(
  {
    roles: {
      type: [String],
      enum: ["client", "tasker", "admin"],
      default: ["client"],
    },
    currentRole: {
      type: String,
      enum: ["client", "tasker"],
      required: true,
      default: "client",
    },

    // NEW: Tasker approval flow
    taskerStatus: {
      type: String,
      enum: ["not_applied", "under_review", "approved", "rejected"],
      default: "not_applied",
    },
    taskerAppliedAt: { type: Date },
    taskerApprovedAt: { type: Date },
    taskerRejectedAt: { type: Date },
    taskerRejectionReason: { type: String },
    // -----------------------------------------------
    taskerProfileCheck: { type: Boolean, default: false },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String, required: true },
    postalCode: { type: String, required: true },
    password: { type: String, required: true },
    isBlocked: { type: Boolean, default: false },
    stripeCustomerId: { type: String },
    defaultPaymentMethod: { type: String },

    // Optional fields
    profilePicture: String,
    about: String,
    dob: Date,
    address: {
      street: String,
      city: String,
      province: String,
      postalCode: String,
    },
    language: String,
    travelDistance: String,
    categories: [String],
    skills: [String],
    yearsOfExperience: String,
    qualifications: [String],
    services: [serviceSchema],
    idType: { type: String, enum: ["passport", "governmentID"] },

    // ID files
    passportUrl: String,
    governmentIdFront: String,
    governmentIdBack: String,

    // Bank details
    accountHolder: { type: String },
    accountNumber: { type: String },
    routingNumber: { type: String },
    // Dates
    issueDate: { type: Date },
    expiryDate: { type: Date },

    sin: String,
    certifications: [String],
    backgroundCheckConsent: Boolean,
    hasInsurance: Boolean,
    insuranceDocument: String,

    // Ratings & reviews
    rating: {
      type: Number,
      min: [0, "Rating cannot be less than 0"],
      max: [5, "Rating cannot be more than 5"],
      default: 0,
    },
    reviewCount: { type: Number, default: 0 },
    reviews: [reviewSchema],

    // Service info
    pricingType: { type: String, enum: ["Hourly Rate", "Fixed Price", "Both"] },
    chargesGST: Boolean,
    availability: [availabilitySchema],
    advanceNotice: String,
    serviceAreas: [String],

    // Agreements
    acceptedTerms: Boolean,
    acceptedTaxResponsibility: Boolean,
    confirmedInfo: Boolean,
    acceptedPipeda: Boolean,

    // Tasker profile check (now generic)
    taskerProfileCheck: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Indexes for performance
userSchema.index({ currentRole: 1 });
userSchema.index({ rating: 1 });

// Password comparison method
userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

export default mongoose.models.User || mongoose.model("User", userSchema);
