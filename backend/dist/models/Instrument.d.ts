import { Document } from 'mongoose';
export interface IInstrument extends Document {
    id: string;
    symbol: string;
    name: string;
    assetClass: 'forex' | 'crypto' | 'indices' | 'commodities';
    baseCurrency: string;
    quoteCurrency: string;
    pipSize: number;
    tickSize: number;
    defaultTimeframe: string;
    provider: 'binance' | 'yahoo' | 'custom';
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export declare const Instrument: import("mongoose").Model<IInstrument, {}, {}, {}, Document<unknown, {}, IInstrument, {}, {}> & IInstrument & Required<{
    _id: import("mongoose").Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=Instrument.d.ts.map