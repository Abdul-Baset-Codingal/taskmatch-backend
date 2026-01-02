// models/PlatformSettings.js
import mongoose from 'mongoose';

const platformSettingsSchema = new mongoose.Schema({
    key: {
        type: String,
        unique: true,
        required: true
    },
    value: mongoose.Schema.Types.Mixed,
    description: String,
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, { timestamps: true });

// Create default settings
platformSettingsSchema.statics.getSettings = async function () {
    let settings = await this.findOne({ key: 'payment_settings' });

    if (!settings) {
        settings = await this.create({
            key: 'payment_settings',
            value: {
                platformFeePercentage: 8,      // 15% platform fee
                minimumPayoutAmount: 2500,       // $25.00 minimum payout
                payoutSchedule: 'weekly',        // weekly, biweekly, monthly
                payoutDay: 'friday',             // Day of week for payouts
                autoPayoutEnabled: false,        // Auto process payouts
                holdPeriodDays: 7                // Hold period after task completion
            }
        });
    }

    return settings.value;
};

export default mongoose.model('PlatformSettings', platformSettingsSchema);