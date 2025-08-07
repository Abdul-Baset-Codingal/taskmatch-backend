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
    postalCode: { type: String, required: true },
    password: { type: String, required: true },
    isBlocked: { type: Boolean, default: false },

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


// Optional: Method to compare passwords
userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

export default mongoose.models.User || mongoose.model("User", userSchema);
