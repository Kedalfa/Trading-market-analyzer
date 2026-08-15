import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  mongoUri: process.env.MONGODB_URI || '',
  frontendOrigin: process.env.FRONTEND_ORIGIN || 'http://localhost:3000',
  marketDataCacheTtl: parseInt(process.env.MARKET_DATA_CACHE_TTL || '30', 10),
  newsCacheTtl: parseInt(process.env.NEWS_CACHE_TTL || '300', 10),
};

if (!config.mongoUri) {
  console.error('[CONFIG] MONGODB_URI is not set. Please create backend/.env with your MongoDB connection string.');
  process.exit(1);
}
