import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { runAgentPipeline } from '../agents/pipeline.js';
import { Chat } from '../models/Chat.js';
import { memoryService } from '../services/memoryService.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// 🔥 ADD THIS (language control)
const systemPrompt = `
You are PhantomAI.

CRITICAL RULE:
- Detect the user's language and reply in the EXACT same language.
- Never switch language randomly.
- Keep answers simple and helpful.
`;

// ─── STREAM CHAT — TRUE SSE WITH PER-CHUNK FLUSH ─────────────────────────────

router.post('/stream', async (req, res) => {
  const { message, sessionId: clientSessionId, userId, conversationHistory = [] } = req.body;

  if (!message?.trim()) {
    return res.status(400).json({ error: 'Message is required' });
  }

  const sessionId = clientSessionId || uuidv4();

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.flushHeaders();

  const send = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    if (typeof res.flush === 'function') res.flush();
  };

  const keepalive = setInterval(() => {
    res.write(': ping\n\n');
    if (typeof res.flush === 'function') res.flush();
  }, 15000);

  let aborted = false;
  req.on('close', () => { aborted = true; clearInterval(keepalive); });

  try {
    send('session', { sessionId });
    send('stage', { stage: 'planning', label: 'Planning your request…' });

    const result = await runAgentPipeline({
      userMessage: message,
      conversationHistory: conversationHistory.slice(-12).map(m => ({
        role: m.role,
        content: m.content,
      })),
      sessionId,
      userId,

      systemPrompt, // 🔥 ONLY ADD THIS LINE

      onChunk: (chunk) => {
        if (!aborted) send('chunk', { content: chunk });
      },

      onPlanReady: (plan) => {
        if (aborted) return;
        send('plan', { plan });
        send('stage', {
          stage: plan.requiresSearch ? 'research' : 'reasoning',
          label: plan.requiresSearch ? 'Searching the web…' : 'Generating response…',
        });
      },

      onResearchDone: (info) => {
        if (aborted) return;
        send('stage', { stage: 'reasoning', label: 'Generating response…' });
        if (info?.searchUsed) send('search_done', { resultCount: info.resultCount });
        if (info?.ragUsed) send('rag_done', { chunkCount: info.chunkCount });
      },
    });

    if (!aborted) {
      send('done', {
        content: result.content,
        model: result.model,
        taskType: result.taskType,
        usedSearch: result.usedSearch,
        usedRAG: result.usedRAG,
        ragChunks: result.ragChunks,
        plan: result.plan,
        elapsed: result.elapsed,
        memoryUsed: result.memoryUsed,
      });
    }

    setImmediate(async () => {
      try {
        let chat = await Chat.findOne({ sessionId });
        if (!chat) chat = new Chat({ sessionId, userId });
        chat.messages.push({ role: 'user', content: message });
        chat.messages.push({
          role: 'assistant',
          content: result.content,
          model: result.model,
          taskType: result.taskType,
          usedSearch: result.usedSearch,
          usedRAG: result.usedRAG,
          plan: result.plan,
        });
        await chat.save();
      } catch (err) {
        logger.error('Chat persist error:', err);
      }
    });

  } catch (error) {
    logger.error('Stream chat error:', error);
    if (!aborted) send('error', { message: error.message || 'An error occurred' });
  } finally {
    clearInterval(keepalive);
    res.end();
  }
});

// باقي code unchanged
router.get('/history', async (req, res) => {
  const { userId, limit = 30, skip = 0 } = req.query;
  const query = userId ? { userId } : {};
  const chats = await Chat.find(query)
    .select('sessionId title createdAt updatedAt metadata')
    .sort({ updatedAt: -1 })
    .limit(parseInt(limit))
    .skip(parseInt(skip))
    .lean();
  res.json({ chats });
});

router.get('/:sessionId', async (req, res) => {
  const chat = await Chat.findOne({ sessionId: req.params.sessionId }).lean();
  if (!chat) return res.status(404).json({ error: 'Chat not found' });
  res.json({ chat });
});

router.delete('/:sessionId', async (req, res) => {
  await Chat.deleteOne({ sessionId: req.params.sessionId });
  memoryService.clearShortTerm(req.params.sessionId);
  res.json({ success: true });
});

router.post('/new', async (req, res) => {
  const sessionId = uuidv4();
  const { userId } = req.body;
  const chat = new Chat({ sessionId, userId });
  await chat.save();
  res.json({ sessionId });
});

export default router;