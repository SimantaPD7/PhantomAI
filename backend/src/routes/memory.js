import express from 'express';
import { memoryService } from '../services/memoryService.js';
import { Memory } from '../models/Memory.js';

const router = express.Router();

router.get('/:userId', async (req, res) => {
  const memories = await memoryService.getLongTerm(req.params.userId);
  res.json({ memories });
});

router.post('/preference', async (req, res) => {
  const { userId, key, value } = req.body;
  if (!userId || !key) return res.status(400).json({ error: 'userId and key required' });
  await memoryService.updatePreference(userId, key, value);
  res.json({ success: true });
});

router.delete('/:userId', async (req, res) => {
  await Memory.deleteMany({ userId: req.params.userId });
  res.json({ success: true });
});

export default router;
