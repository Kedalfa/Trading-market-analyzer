import { Schema, model, Document } from 'mongoose';

export interface IInstrument extends Document {
  id: string;                // e.g. 'BTCUSDT'
  symbol: string;            // e.g. 'BTC/USDT'
  name: string;
  assetClass: 'forex' | 'crypto' | 'indices' | 'commodities';
  baseCurrency: string;
  quoteCurrency: string;
  pipSize: number;
  tickSize: number;
  defaultTimeframe: string;
  provider: 'binance' | 'yahoo' | 'exness' | 'custom';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const instrumentSchema = new Schema<IInstrument>(
  {
    id: { type: String, required: true, unique: true, index: true },
    symbol: { type: String, required: true },
    name: { type: String, required: true },
    assetClass: {
      type: String,
      required: true,
      enum: ['forex', 'crypto', 'indices', 'commodities'],
    },
    baseCurrency: { type: String, required: true },
    quoteCurrency: { type: String, required: true },
    pipSize: { type: Number, required: true },
    tickSize: { type: Number, required: true },
    defaultTimeframe: { type: String, default: '15M' },
    provider: {
      type: String,
      required: true,
      enum: ['binance', 'yahoo', 'exness', 'custom'],
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Instrument = model<IInstrument>('Instrument', instrumentSchema);
