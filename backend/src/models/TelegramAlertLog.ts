import { Schema, model, Document } from 'mongoose';

export interface ITelegramAlertLog extends Document {
  setupId: string;
  chatId: number;
  userId?: string;
  symbol: string;
  alertType: 'NEW_SETUP' | 'ENTRY_APPROACHING' | 'ENTRY_TRIGGERED' | 'TP_HIT' | 'SL_HIT' | 'INVALIDATED' | 'EXPIRED';
  stage: string;
  message: string;
  deliveryStatus: 'SENT' | 'FAILED';
  error?: string;
  sentAt: Date;
}

const telegramAlertLogSchema = new Schema<ITelegramAlertLog>(
  {
    setupId: { type: String, required: true, index: true },
    chatId: { type: Number, required: true, index: true },
    userId: { type: String, index: true },
    symbol: { type: String, required: true, index: true },
    alertType: {
      type: String,
      enum: ['NEW_SETUP', 'ENTRY_APPROACHING', 'ENTRY_TRIGGERED', 'TP_HIT', 'SL_HIT', 'INVALIDATED', 'EXPIRED'],
      required: true,
      index: true,
    },
    stage: { type: String, required: true },
    message: { type: String, required: true },
    deliveryStatus: { type: String, enum: ['SENT', 'FAILED'], default: 'SENT' },
    error: String,
    sentAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

telegramAlertLogSchema.index({ setupId: 1, alertType: 1, chatId: 1 });

export const TelegramAlertLog = model<ITelegramAlertLog>('TelegramAlertLog', telegramAlertLogSchema);
