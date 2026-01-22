import mongoose from 'mongoose';

const adminPaymentPlatformConfigSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true, default: 'fees' },
    clientPlatformFeePercent: { type: Number, default: 0.10 },
    reservationFeeCents: { type: Number, default: 500 }, // $5.00
    clientTaxPercent: { type: Number, default: 0.13 },
    taskerPlatformFeePercent: { type: Number, default: 0.12 },
    taskerTaxPercent: { type: Number, default: 0.13 },
    lastUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

export default mongoose.model('adminPaymentPlatformConfigSchema', adminPaymentPlatformConfigSchema);