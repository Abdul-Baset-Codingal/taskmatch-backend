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

const userSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ["client", "tasker"], required: true },
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String, required: true },
    province: { type: String, required: true },
    password: { type: String, required: true },

    profilePicture: String,
    dob: Date,
    address: {
      street: String,
      city: String,
      postalCode: String,
    },
    language: String,
    about: String,
    travelDistance: String,
    categories: [String],
    skills: [String],
    yearsOfExperience: String,
    qualifications: [String],
    services: [serviceSchema],

    governmentId: String,
    sin: String,
    certifications: [String],
    backgroundCheckConsent: Boolean,
    hasInsurance: Boolean,

    pricingType: { type: String, enum: ["Hourly Rate", "Fixed Price", "Both"] },
    chargesGST: Boolean,
    availability: [availabilitySchema],
    advanceNotice: String,
    serviceAreas: [String],

    acceptedTerms: Boolean,
    acceptedTaxResponsibility: Boolean,
    confirmedInfo: Boolean,
    acceptedPipeda: Boolean,
  },
  { timestamps: true }
);

// 🔐 Pre-save hook to hash password
userSchema.pre("save", async function (next) {
  // Only hash if password is modified or new
  if (!this.isModified("password")) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Optional: Method to compare passwords
userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

export default mongoose.models.User || mongoose.model("User", userSchema);
