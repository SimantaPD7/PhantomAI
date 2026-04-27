import express from 'express';
import { searchService } from '../services/searchService.js';

const router = express.Router();

router.post('/', async (req, res) => {
  const { query, depth, maxResults } = req.body;
  if (!query) return res.status(400).json({ error: 'query is required' });

  const results = await searchService.search(query, { depth, maxResults });
  res.json(results);
});

export default router;
