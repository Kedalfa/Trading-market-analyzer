import mongoose from 'mongoose';
import { config } from './config';

let isConnected = false;

export async function connectDB(): Promise<void> {
  if (isConnected) return;

  try {
    await mongoose.connect(config.mongoUri, {
      serverSelectionTimeoutMS: 5000,
    });
    isConnected = true;
    console.log('[MongoDB] Connected successfully');

    mongoose.connection.on('disconnected', () => {
      isConnected = false;
      console.warn('[MongoDB] Disconnected. Will reconnect on next request.');
    });

    mongoose.connection.on('error', (err) => {
      console.error('[MongoDB] Connection error:', err);
    });
  } catch (err) {
    console.error('[MongoDB] Failed to connect:', err);
    throw err;
  }
}
