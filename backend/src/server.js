import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import { rateLimit } from 'express-rate-limit';

import dotenv from 'dotenv';
import { connectDB } from './config/database.js';
import { logger } from './utils/logger.js';
import chatRoutes from './routes/chat.js';
import memoryRoutes from './routes/memory.js';
import uploadRoutes from './routes/upload.js';
import searchRoutes from './routes/search.js';
import healthRoutes from './routes/health.js';
import { errorHandler } from './middleware/errorHandler.js';
import { initVectorDB } from './services/vectorService.js';
import fs from 'fs';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Ensure required directories exist
for (const dir of [
  process.env.UPLOAD_DIR || './uploads',
  process.env.VECTOR_DB_PATH || './data/vectordb',
  './logs',
]) {
  if (!fs.existsSync(dir)) {
    try { fs.mkdirSync(dir, { recursive: true }); } catch (_) {}
  }
}

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// CORS
const corsOrigin = process.env.CORS_ORIGIN || '*';

const allowedOrigins = corsOrigin === '*'
  ? true
  : corsOrigin.split(',').map(o => o.trim());

app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Session-Id'],
  credentials: corsOrigin !== '*',
}));

// Compression
app.use(compression());

// Logging
app.use(morgan('combined', {
  stream: { write: (msg) => logger.info(msg.trim()) },
}));

// Body parsing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

app.use('/api/', limiter);



// ================== 🔥 IMPORTANT ADD ==================
// Root route (fixes "Cannot GET /")
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: '🚀 PhantomAI Backend is running',
    endpoints: [
      '/api/health',
      '/api/chat',
      '/api/memory',
      '/api/upload',
      '/api/search'
    ]
  });
});
// =====================================================


// Routes
app.use('/api/health', healthRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/memory', memoryRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/search', searchRoutes);

// Error handler — must be last
app.use(errorHandler);

// Crash safety
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection:', reason);
});
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception:', err);
});

// Start server
async function startServer() {
  try {
    await connectDB();

    try {
      await initVectorDB();
      logger.info('✅ Vector DB initialized');
    } catch (err) {
      logger.warn(`⚠️ Vector DB skipped: ${err.message}`);
    }

    app.listen(PORT, () => {
      logger.info(`🚀 PhantomAI Backend running on port ${PORT}`);
      logger.info(`🌍 Environment: ${process.env.NODE_ENV}`);
      logger.info(`🤖 AI Model: openrouter/auto`);
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

export default app;