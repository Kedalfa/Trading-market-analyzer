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

export interface IVerificationHistoryEntry {
  timestamp: Date;
  success: boolean;
  codeHashPrefix: string; // first 8 chars of SHA256 — never exposes full hash
  ipHint?: string;
}

export interface ITelegramUser extends Document {
  // ── Web account linkage ────────────────────────────────────────
  userId: string;                      // Internal web account ID (e.g. 'user_1')
  linkedWebUserId: string;             // Explicit web account owner (same as userId)

  // ── Telegram identity ─────────────────────────────────────────
  telegramUserId?: number;             // Numeric Telegram user ID (authoritative identity)
  chatId?: number;                     // Telegram chat ID (matches DM chat)
  telegramUsername?: string;           // @handle (optional, can change)
  firstName?: string;
  lastName?: string;
  languageCode?: string;

  // ── Connection state ──────────────────────────────────────────
  isConnected: boolean;
  connectedAt?: Date;
  lastActiveAt?: Date;

  // ── Legacy pairing code (website → bot connect) ───────────────
  connectionCode?: string;
  codeExpiresAt?: Date;

  // ── Authorization state (permanent flag) ─────────────────────
  isAuthorized: boolean;
  authorizedAt?: Date;

  // ── Active session (resets on every /start) ───────────────────
  sessionToken?: string;              // Random UUID for current login session
  sessionCreatedAt?: Date;            // When this session was created
  sessionExpiresAt?: Date;            // Session expiry (24h after creation)
  sessionLastActivityAt?: Date;       // Updated on each bot interaction
  sessionIsActive: boolean;           // Explicitly invalidated on disconnect/revoke

  // ── Verification code (SHA-256 hashed, website-generated) ─────
  verificationCodeHash?: string;
  verificationExpiresAt?: Date;
  verificationAttempts: number;
  lastCodeRequestedAt?: Date;

  // ── Rate limiting / brute-force protection ────────────────────
  failedAuthAttempts: number;         // Account-level failed /start code attempts
  lastFailedAuthAt?: Date;
  codeLockedUntil?: Date;             // Locked out after too many failures

  // ── Audit history ─────────────────────────────────────────────
  verificationHistory: IVerificationHistoryEntry[];

  // ── Preferences ───────────────────────────────────────────────
  watchlist: string[];
  settings: ITelegramUserSettings;
}

const telegramUserSchema = new Schema<ITelegramUser>(
  {
    // Web account linkage
    userId: { type: String, required: true, unique: true, index: true },
    linkedWebUserId: { type: String, default: 'user_1', index: true },

    // Telegram identity
    telegramUserId: { type: Number, index: true, sparse: true, unique: true },
    chatId: { type: Number, index: true, sparse: true },
    telegramUsername: String,
    firstName: String,
    lastName: String,
    languageCode: String,

    // Connection state
    isConnected: { type: Boolean, default: false, index: true },
    connectedAt: Date,
    lastActiveAt: Date,

    // Legacy pairing code
    connectionCode: { type: String, index: true, sparse: true },
    codeExpiresAt: Date,

    // Authorization state
    isAuthorized: { type: Boolean, default: false, index: true },
    authorizedAt: Date,

    // Active session
    sessionToken: { type: String, index: true, sparse: true },
    sessionCreatedAt: Date,
    sessionExpiresAt: Date,
    sessionLastActivityAt: Date,
    sessionIsActive: { type: Boolean, default: false, index: true },

    // Verification code
    verificationCodeHash: String,
    verificationExpiresAt: Date,
    verificationAttempts: { type: Number, default: 0 },
    lastCodeRequestedAt: Date,

    // Rate limiting
    failedAuthAttempts: { type: Number, default: 0 },
    lastFailedAuthAt: Date,
    codeLockedUntil: Date,

    // Audit history
    verificationHistory: {
      type: [
        {
          timestamp: { type: Date, required: true },
          success: { type: Boolean, required: true },
          codeHashPrefix: { type: String, required: true },
          ipHint: String,
        },
      ],
      default: [],
    },

    // Preferences
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
