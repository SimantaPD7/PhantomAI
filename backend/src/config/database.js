import mongoose from 'mongoose';
import { logger } from '../utils/logger.js';

export async function connectDB() {
  const uri = process.env.MONGODB_URI;

  if (!uri || uri.includes('USERNAME:PASSWORD') || uri.includes('xxxxx')) {
    logger.warn('⚠️  MONGODB_URI is not configured — running WITHOUT database persistence.');
    logger.warn('   Chat history, memory, and uploads will NOT be saved across restarts.');
    logger.warn('   Set MONGODB_URI in backend/.env to enable persistence.');
    return; // Graceful — don't crash, just skip
  }

  mongoose.connection.on('connected', () => logger.info('MongoDB connected'));
  mongoose.connection.on('error', (err) => logger.error('MongoDB error:', err));
  mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
  } catch (err) {
    logger.warn(`⚠️  MongoDB connection failed: ${err.message}`);
    logger.warn('   Running WITHOUT database persistence. Fix MONGODB_URI to enable it.');
    // Don't throw — allow server to start without DB
  }
}
