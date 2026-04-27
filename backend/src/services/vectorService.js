import { logger } from '../utils/logger.js';
import fs from 'fs';
import path from 'path';

// Lazy-load transformers to avoid startup delay
let pipeline = null;
let embedder = null;

async function getEmbedder() {
  if (embedder) return embedder;
  try {
    const transformers = await import('@xenova/transformers');
    pipeline = transformers.pipeline;
    embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
      quantized: true,
    });
    logger.info('Embeddings model loaded');
    return embedder;
  } catch (error) {
    logger.error('Failed to load embeddings model:', error);
    throw error;
  }
}

// Pure JS cosine similarity — replaces hnswlib-node
function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

class VectorService {
  constructor() {
    this.dbPath = process.env.VECTOR_DB_PATH || './data/vectordb';
    this.dimension = 384;
    this.store = new Map(); // namespace -> [{ id, text, embedding, metadata, createdAt }]
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;
    try {
      await getEmbedder();
      await this._loadExistingIndices();
      this.initialized = true;
      logger.info('Vector service initialized');
    } catch (error) {
      logger.warn('Vector service init failed (embeddings disabled):', error.message);
      this.initialized = false;
    }
  }

  async _loadExistingIndices() {
    if (!fs.existsSync(this.dbPath)) return;
    const files = fs.readdirSync(this.dbPath);
    for (const file of files) {
      if (file.endsWith('.vec.json')) {
        const namespace = file.replace('.vec.json', '');
        await this._loadIndex(namespace);
      }
    }
  }

  async _loadIndex(namespace) {
    const storePath = path.join(this.dbPath, `${namespace}.vec.json`);
    if (!fs.existsSync(storePath)) return;
    try {
      const data = JSON.parse(fs.readFileSync(storePath, 'utf-8'));
      this.store.set(namespace, data);
      logger.debug(`Loaded index: ${namespace}`);
    } catch (error) {
      logger.error(`Failed to load index ${namespace}:`, error);
    }
  }

  async embed(text) {
    const model = await getEmbedder();
    const output = await model(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
  }

  async upsert(namespace, items) {
    if (!this.initialized) {
      logger.warn('Vector service not initialized, skipping upsert');
      return;
    }
    try {
      if (!this.store.has(namespace)) this.store.set(namespace, []);
      const store = this.store.get(namespace);
      for (const item of items) {
        const embedding = await this.embed(item.text);
        store.push({
          id: store.length,
          text: item.text,
          embedding,
          metadata: item.metadata || {},
          createdAt: new Date().toISOString(),
        });
      }
      await this._saveIndex(namespace);
    } catch (error) {
      logger.error('Vector upsert error:', error);
    }
  }

  async search(namespace, query, topK = 5) {
    if (!this.initialized || !this.store.has(namespace)) return [];
    try {
      const store = this.store.get(namespace) || [];
      if (store.length === 0) return [];
      const queryEmbedding = await this.embed(query);
      return store
        .map((item) => ({ ...item, score: cosineSimilarity(queryEmbedding, item.embedding) }))
        .filter((r) => r.score > 0.3)
        .sort((a, b) => b.score - a.score)
        .slice(0, topK)
        .map(({ embedding: _e, ...rest }) => rest);
    } catch (error) {
      logger.error('Vector search error:', error);
      return [];
    }
  }

  async _saveIndex(namespace) {
    try {
      if (!fs.existsSync(this.dbPath)) fs.mkdirSync(this.dbPath, { recursive: true });
      fs.writeFileSync(
        path.join(this.dbPath, `${namespace}.vec.json`),
        JSON.stringify(this.store.get(namespace))
      );
    } catch (error) {
      logger.error('Failed to save index:', error);
    }
  }

  async deleteNamespace(namespace) {
    this.store.delete(namespace);
    const storePath = path.join(this.dbPath, `${namespace}.vec.json`);
    if (fs.existsSync(storePath)) fs.unlinkSync(storePath);
  }
}

export const vectorService = new VectorService();
export async function initVectorDB() { await vectorService.init(); }
