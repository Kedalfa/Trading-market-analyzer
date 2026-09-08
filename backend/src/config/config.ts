import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  mongoUri: process.env.MONGODB_URI || '',
  frontendOrigin: process.env.FRONTEND_ORIGIN || 'http://localhost:3000',
  marketDataCacheTtl: parseInt(process.env.MARKET_DATA_CACHE_TTL || '30', 10),
  newsCacheTtl: parseInt(process.env.NEWS_CACHE_TTL || '300', 10),
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '8845842296:AAFGUYzQWIVYqwHV3wybu4USxmQUMaC8VIg',
  telegramBotUsername: process.env.TELEGRAM_BOT_USERNAME || 'Caleb_SMC_bot',
  
  // Exness Broker & Bridge Configuration
  exness: {
    enabled: process.env.EXNESS_ENABLED === 'true',
    apiUrl: process.env.EXNESS_API_URL || 'https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai',
    accountId: process.env.EXNESS_ACCOUNT_ID || '',
    token: process.env.EXNESS_TOKEN || '',
    server: process.env.EXNESS_SERVER || 'Exness-Real19',
    accountType: (process.env.EXNESS_ACCOUNT_TYPE || 'standard') as 'standard' | 'raw_spread' | 'pro' | 'zero',
    autoExecute: process.env.EXNESS_AUTO_EXECUTE === 'true',
    maxRiskPercent: parseFloat(process.env.EXNESS_MAX_RISK_PERCENT || '1.0'),
    defaultLotSize: parseFloat(process.env.EXNESS_DEFAULT_LOT_SIZE || '0.01'),
  },
};

if (!config.mongoUri) {
  console.error('[CONFIG] MONGODB_URI is not set. Please create backend/.env with your MongoDB connection string.');
  process.exit(1);
}
