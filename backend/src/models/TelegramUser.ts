import { Schema, model, Document } from 'mongoose';

export interface ITelegramUserSettings {
  minQuality: 'HIGH' | 'HIGH_AND_WATCH';
  timeframes: {
    htf: string;
    intermediate: string;
    setup: string;
    entry: string;
  };
  sessions: string[];
  newsFilter: 'BLOCK_HIGH' | 'WARN_ONLY' | 'IGNORE';
  alertTypes: {
    newSetup: boolean;
    entryApproaching: boolean;
    entryTriggered: boolean;
    tp1: boolean;
    tp2: boolean;
    tp3: boolean;
    sl: boolean;
    invalidated: boolean;
    expired: boolean;
  };
  isMuted: boolean;
  accountBalance?: number;
  accountRiskPercent?: number;
}

export interface ITelegramUser extends Document {
  userId: string;
  chatId?: number;
  telegramUsername?: string;
  firstName?: string;
  connectionCode?: string;
  codeExpiresAt?: Date;
  isConnected: boolean;
  connectedAt?: Date;
  lastActiveAt?: Date;
  watchlist: string[];
  settings: ITelegramUserSettings;
  isAuthorized: boolean;
  authorizedAt?: Date;
  verificationCodeHash?: string;
  verificationExpiresAt?: Date;
  verificationAttempts: number;
  lastCodeRequestedAt?: Date;
}

const telegramUserSchema = new Schema<ITelegramUser>(
  {
    userId: { type: String, required: true, unique: true, index: true },
    chatId: { type: Number, index: true, sparse: true },
    telegramUsername: String,
    firstName: String,
    connectionCode: { type: String, index: true },
    codeExpiresAt: Date,
    isConnected: { type: Boolean, default: false, index: true },
    connectedAt: Date,
    lastActiveAt: Date,
    isAuthorized: { type: Boolean, default: false, index: true },
    authorizedAt: Date,
    verificationCodeHash: String,
    verificationExpiresAt: Date,
    verificationAttempts: { type: Number, default: 0 },
    lastCodeRequestedAt: Date,
    watchlist: {
      type: [String],
      default: ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', 'BTCUSDT'],
    },
    settings: {
      minQuality: { type: String, enum: ['HIGH', 'HIGH_AND_WATCH'], default: 'HIGH' },
      timeframes: {
        htf: { type: String, default: '4H' },
        intermediate: { type: String, default: '1H' },
        setup: { type: String, default: '15M' },
        entry: { type: String, default: '5M' },
      },
      sessions: {
        type: [String],
        default: ['London', 'New York', 'London / New York Overlap'],
      },
      newsFilter: { type: String, enum: ['BLOCK_HIGH', 'WARN_ONLY', 'IGNORE'], default: 'BLOCK_HIGH' },
      alertTypes: {
        newSetup: { type: Boolean, default: true },
        entryApproaching: { type: Boolean, default: true },
        entryTriggered: { type: Boolean, default: true },
        tp1: { type: Boolean, default: true },
        tp2: { type: Boolean, default: true },
        tp3: { type: Boolean, default: true },
        sl: { type: Boolean, default: true },
        invalidated: { type: Boolean, default: true },
        expired: { type: Boolean, default: false },
      },
      isMuted: { type: Boolean, default: false },
      accountBalance: Number,
      accountRiskPercent: Number,
    },
  },
  { timestamps: true }
);

export const TelegramUser = model<ITelegramUser>('TelegramUser', telegramUserSchema);
