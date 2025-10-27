// import mongoose from "mongoose";
// import bcrypt from "bcrypt";

// const serviceSchema = new mongoose.Schema({
//   title: String,
//   description: String,
//   hourlyRate: Number,
//   estimatedDuration: String,
// });

// const availabilitySchema = new mongoose.Schema({
//   day: String,
//   from: String,
//   to: String,
// });

// const reviewSchema = new mongoose.Schema({
//   reviewer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
//   rating: { type: Number, min: 0, max: 5, required: true },
//   message: { type: String, required: true },
//   createdAt: { type: Date, default: Date.now },
// });

// const userSchema = new mongoose.Schema(
//   {
//     role: { type: String, enum: ["client", "tasker"], required: true },
//     // roles: {
//     //   type: [String],
//     //   enum: ["client", "tasker"],
//     //   default: ["client"], // used only if frontend doesn’t send a role
//     // },
//     // currentRole: {
//     //   type: String,
//     //   enum: ["client", "tasker"],
//     //   default: "client",
//     // },

//     firstName: { type: String, required: true },
//     lastName: { type: String, required: true },
//     email: { type: String, required: true, unique: true },
//     phone: { type: String, required: true },
//     postalCode: { type: String, required: true },
//     password: { type: String, required: true },
//     isBlocked: { type: Boolean, default: false },

//     about: {
//       type: String,
//       required: [
//         function () {
//           return this.role === "tasker";
//         },
//         "About section is required for taskers",
//       ],
//     },

//     profilePicture: {
//       type: String,
//       required: [
//         function () {
//           return this.role === "tasker";
//         },
//         "Profile picture is required for taskers",
//       ],
//     },
//     dob: Date,
//     address: {
//       street: String,
//       city: String,
//       postalCode: String,
//     },
//     language: String,
//     about: String,
//     travelDistance: String,
//     categories: [String],
//     skills: [String],

//     yearsOfExperience: String,
//     qualifications: [String],
//     services: [serviceSchema],

//     idType: { type: String, enum: ["passport", "governmentID"] },
//     governmentId: String,
//     govIDBack: String,
//     sin: String,
//     certifications: [String],
//     backgroundCheckConsent: Boolean,
//     hasInsurance: Boolean,

//     rating: {
//       type: Number,
//       min: [0, "Rating cannot be less than 0"],
//       max: [5, "Rating cannot be more than 5"],
//       default: function () {
//         return this.role === "tasker" ? 0 : null;
//       },
//       validate: {
//         validator: function (value) {
//           return this.role === "tasker" ? value !== null : value === null;
//         },
//         message: "Rating is only applicable for taskers",
//       },
//     },
//     reviewCount: {
//       type: Number,
//       default: function () {
//         return this.role === "tasker" ? 0 : null;
//       },
//       validate: {
//         validator: function (value) {
//           return this.role === "tasker" ? value !== null : value === null;
//         },
//         message: "Review count is only applicable for taskers",
//       },
//     },
//     reviews: [reviewSchema], // New field for storing reviews

//     pricingType: { type: String, enum: ["Hourly Rate", "Fixed Price", "Both"] },
//     chargesGST: Boolean,
//     availability: [availabilitySchema],
//     advanceNotice: String,
//     serviceAreas: [String],

//     acceptedTerms: Boolean,
//     acceptedTaxResponsibility: Boolean,
//     confirmedInfo: Boolean,
//     acceptedPipeda: Boolean,
//   },
//   { timestamps: true }
// );

// // Indexes for performance
// userSchema.index({ role: 1 });
// userSchema.index({ rating: 1 });

// userSchema.methods.comparePassword = async function (enteredPassword) {
//   return await bcrypt.compare(enteredPassword, this.password);
// };

// export default mongoose.models.User || mongoose.model("User", userSchema);


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
      enum: ["client", "tasker"],
      default: ["client"],
    },
    currentRole: {
      type: String,
      enum: ["client", "tasker"],
      required: true,
      default: "client",
    },

    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String, required: true },
    postalCode: { type: String, required: true },
    password: { type: String, required: true },
    isBlocked: { type: Boolean, default: false },

    // Tasker-specific fields (optional in schema; enforced in API)
    profilePicture: String,
    about: String,
    dob: Date,
    address: {
      street: String,
      city: String,
      province: String,  // Added (from your signup)
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
    governmentId: String,
    govIDBack: String,
    sin: String,
    certifications: [String],
    backgroundCheckConsent: Boolean,
    hasInsurance: Boolean,

    rating: {
      type: Number,
      min: [0, "Rating cannot be less than 0"],
      max: [5, "Rating cannot be more than 5"],
      default: function () {
        return this.roles.includes("tasker") ? 0 : null;
      },
      validate: {
        validator: function (value) {
          return this.roles.includes("tasker") ? value !== null : value === null;
        },
        message: "Rating is only applicable for taskers",
      },
    },
    reviewCount: {
      type: Number,
      default: function () {
        return this.roles.includes("tasker") ? 0 : null;
      },
      validate: {
        validator: function (value) {
          return this.roles.includes("tasker") ? value !== null : value === null;
        },
        message: "Review count is only applicable for taskers",
      },
    },
    reviews: [reviewSchema],

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

// Indexes for performance
userSchema.index({ currentRole: 1 });
userSchema.index({ rating: 1 });

userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

export default mongoose.models.User || mongoose.model("User", userSchema);