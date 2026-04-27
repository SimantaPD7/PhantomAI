import { vectorService } from './vectorService.js';
import { Memory } from '../models/Memory.js';
import { logger } from '../utils/logger.js';

class MemoryService {
  constructor() {
    this.shortTermCache = new Map(); // sessionId -> messages[]
    this.maxShortTermMessages = 20;
  }

  // ─── SHORT-TERM (in-memory, per session) ─────────────────────────────────

  addToShortTerm(sessionId, message) {
    if (!this.shortTermCache.has(sessionId)) {
      this.shortTermCache.set(sessionId, []);
    }
    const messages = this.shortTermCache.get(sessionId);
    messages.push({ ...message, timestamp: new Date().toISOString() });
    if (messages.length > this.maxShortTermMessages) {
      messages.splice(0, messages.length - this.maxShortTermMessages);
    }
    this.shortTermCache.set(sessionId, messages);
  }

  getShortTerm(sessionId, limit = 10) {
    return (this.shortTermCache.get(sessionId) || []).slice(-limit);
  }

  clearShortTerm(sessionId) {
    this.shortTermCache.delete(sessionId);
  }

  // ─── LONG-TERM (MongoDB) ─────────────────────────────────────────────────

  async saveLongTerm(userId, data) {
    try {
      await Memory.findOneAndUpdate(
        { userId },
        {
          $set: {
            userId,
            preferences: data.preferences || {},
            summary: data.summary || '',
            updatedAt: new Date(),
          },
          $addToSet: {
            facts: { $each: data.facts || [] },
          },
        },
        { upsert: true, new: true }
      );
    } catch (error) {
      logger.error('Long-term memory save error:', error);
    }
  }

  async getLongTerm(userId) {
    try {
      const memories = await Memory.find({ userId })
        .sort({ updatedAt: -1 })
        .limit(3)
        .lean();
      return memories;
    } catch (error) {
      logger.error('Long-term memory fetch error:', error);
      return [];
    }
  }

  async updatePreference(userId, key, value) {
    try {
      await Memory.findOneAndUpdate(
        { userId },
        { $set: { [`preferences.${key}`]: value, updatedAt: new Date() } },
        { upsert: true }
      );
    } catch (error) {
      logger.error('Preference update error:', error);
    }
  }

  // ─── SEMANTIC MEMORY (HNSWLib vectors) ───────────────────────────────────

  async addSemanticMemory(userId, text, metadata = {}) {
    try {
      const namespace = `user_${userId}`;
      await vectorService.upsert(namespace, [{
        text,
        metadata: { ...metadata, userId, timestamp: new Date().toISOString() },
      }]);
      logger.debug(`Semantic memory added for user ${userId}: "${text.slice(0, 60)}…"`);
    } catch (error) {
      logger.error('Semantic memory add error:', error);
    }
  }

  async searchSemanticMemory(userId, query, topK = 4) {
    try {
      const namespace = `user_${userId}`;
      const results = await vectorService.search(namespace, query, topK);
      logger.debug(`Semantic search for "${query.slice(0, 40)}": ${results.length} results`);
      return results;
    } catch (error) {
      logger.error('Semantic memory search error:', error);
      return [];
    }
  }

  // ─── COMBINED CONTEXT BUILDER ─────────────────────────────────────────────

  async buildMemoryContext(sessionId, userId, query) {
    const contexts = [];

    // Short-term: last few turns (injected directly into message history, noted here)
    const shortTerm = this.getShortTerm(sessionId, 6);
    if (shortTerm.length > 0) {
      contexts.push({ type: 'short_term', data: shortTerm });
    }

    if (userId) {
      // Long-term: preferences + facts
      const ltMemories = await this.getLongTerm(userId);
      if (ltMemories.length > 0) {
        const merged = ltMemories.reduce((acc, m) => {
          acc.preferences = { ...acc.preferences, ...(m.preferences || {}) };
          acc.facts = [...(acc.facts || []), ...(m.facts || [])];
          return acc;
        }, { preferences: {}, facts: [] });

        if (Object.keys(merged.preferences).length > 0 || merged.facts.length > 0) {
          contexts.push({ type: 'long_term', data: merged });
        }
      }

      // Semantic: similar past exchanges
      const semantic = await this.searchSemanticMemory(userId, query, 3);
      if (semantic.length > 0) {
        contexts.push({ type: 'semantic', data: semantic });
      }
    }

    return contexts;
  }

  formatMemoryContextForPrompt(contexts) {
    if (!contexts.length) return '';
    let prompt = '\n## Memory Context\n';
    let hasContent = false;

    for (const ctx of contexts) {
      if (ctx.type === 'long_term' && ctx.data) {
        const { preferences, facts } = ctx.data;
        if (Object.keys(preferences || {}).length > 0) {
          hasContent = true;
          prompt += '\n**User Preferences:**\n';
          for (const [k, v] of Object.entries(preferences)) {
            prompt += `- ${k}: ${v}\n`;
          }
        }
        if ((facts || []).length > 0) {
          hasContent = true;
          prompt += '\n**Known Facts:**\n';
          facts.slice(0, 10).forEach(f => { prompt += `- ${f}\n`; });
        }
      }

      if (ctx.type === 'semantic' && ctx.data?.length > 0) {
        hasContent = true;
        prompt += '\n**Relevant Past Conversations:**\n';
        ctx.data.forEach(r => {
          prompt += `- (${(r.score * 100).toFixed(0)}% match) ${r.text.slice(0, 200)}\n`;
        });
      }
    }

    return hasContent ? prompt : '';
  }

  // ─── LLM-POWERED INSIGHT EXTRACTION ──────────────────────────────────────
  // Extracts facts and preferences from conversation and stores them

  async extractAndPersistInsights(userId, sessionId, userMessage, assistantResponse) {
    try {
      // Heuristic extraction (no extra LLM call to keep latency low)
      const facts = [];
      const preferences = {};

      // Detect language preferences
      if (/\bi (prefer|like|love|use|work with)\b/i.test(userMessage)) {
        const match = userMessage.match(/i (?:prefer|like|love|use|work with) ([\w\s]+?)(?:\.|,|$)/i);
        if (match) facts.push(`User prefers: ${match[1].trim()}`);
      }

      // Detect programming language mentions
      const langs = userMessage.match(/\b(python|javascript|typescript|rust|go|java|c\+\+|kotlin|swift|ruby|php)\b/gi);
      if (langs) {
        const unique = [...new Set(langs.map(l => l.toLowerCase()))];
        unique.forEach(l => { preferences[`language_${l}`] = 'used'; });
      }

      // Detect role/profession
      const roleMatch = userMessage.match(/\bi(?:'m| am) (?:a |an )?([\w\s]+?)(?: who| that| and|\.|,|$)/i);
      if (roleMatch && roleMatch[1].length < 40) {
        facts.push(`User is: ${roleMatch[1].trim()}`);
      }

      // Only save if we extracted something
      if (facts.length > 0 || Object.keys(preferences).length > 0) {
        await this.saveLongTerm(userId, { facts, preferences });
        logger.debug(`Persisted insights for ${userId}: ${facts.length} facts, ${Object.keys(preferences).length} prefs`);
      }
    } catch (error) {
      logger.error('Insight extraction error:', error);
    }
  }
}

export const memoryService = new MemoryService();
