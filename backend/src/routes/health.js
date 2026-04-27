import express from 'express';
import mongoose from 'mongoose';

const router = express.Router();

router.get('/', async (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.json({
    status: 'ok',
    service: 'PhantomAI Backend',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    db: dbStatus,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  });
});

export default router;
