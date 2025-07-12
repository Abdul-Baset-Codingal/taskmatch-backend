// models/service.js
import mongoose from 'mongoose';

const { Schema } = mongoose;

const PopularOptionSchema = new Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  details: [String],
  label: String,
}, { _id: false });

const AddonSchema = new Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
}, { _id: false });

// ✅ New Package schema
const PackageSchema = new Schema({
  name: { type: String, required: true }, // e.g., "Basic Service"
  icon: { type: String }, // Optional emoji or icon (e.g., "🛠️")
  title: { type: String }, // e.g., "Basic Service"
  price: { type: Number, required: true }, // e.g., 99
  description: { type: String }, 
}, { _id: false });

const ServiceSchema = new Schema({
  id: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  category: String,
  description: String,
  basePrice: Number,
  tags: [String],
  popularOptions: [PopularOptionSchema],
  addons: [AddonSchema],
  inputFields: [{ type: String }],
  photos: [String],
  packages: [PackageSchema], 
}, {
  timestamps: true,
});

const Service = mongoose.model('Service', ServiceSchema);
export default Service;
