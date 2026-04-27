import { vectorService } from './vectorService.js';
import { logger } from '../utils/logger.js';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import fs from 'fs';

class RAGService {
  constructor() {
    this.chunkSize = 500; // tokens roughly
    this.chunkOverlap = 50;
  }

  // ─── DOCUMENT PARSING ─────────────────────────────────────────────────────

  async parseDocument(filePath, mimeType) {
    try {
      if (mimeType === 'application/pdf' || filePath.endsWith('.pdf')) {
        return await this._parsePDF(filePath);
      }
      if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || filePath.endsWith('.docx')) {
        return await this._parseDocx(filePath);
      }
      if (mimeType?.startsWith('text/') || filePath.endsWith('.txt') || filePath.endsWith('.md')) {
        return await this._parseText(filePath);
      }
      throw new Error(`Unsupported file type: ${mimeType}`);
    } catch (error) {
      logger.error('Document parse error:', error);
      throw error;
    }
  }

  async _parsePDF(filePath) {
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);
    return {
      text: data.text,
      pageCount: data.numpages,
      metadata: { type: 'pdf', pages: data.numpages },
    };
  }

  async _parseDocx(filePath) {
    const buffer = fs.readFileSync(filePath);
    const result = await mammoth.extractRawText({ buffer });
    return {
      text: result.value,
      metadata: { type: 'docx' },
    };
  }

  async _parseText(filePath) {
    const text = fs.readFileSync(filePath, 'utf-8');
    return {
      text,
      metadata: { type: 'text' },
    };
  }

  // ─── CHUNKING ─────────────────────────────────────────────────────────────

  chunkText(text, chunkSize = this.chunkSize, overlap = this.chunkOverlap) {
    const sentences = text.split(/(?<=[.!?])\s+/);
    const chunks = [];
    let currentChunk = [];
    let currentSize = 0;

    for (const sentence of sentences) {
      const sentenceSize = sentence.split(' ').length;
      
      if (currentSize + sentenceSize > chunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.join(' '));
        
        // Overlap: keep last few sentences
        const overlapSentences = currentChunk.slice(-2);
        currentChunk = [...overlapSentences, sentence];
        currentSize = overlapSentences.reduce((s, sent) => s + sent.split(' ').length, 0) + sentenceSize;
      } else {
        currentChunk.push(sentence);
        currentSize += sentenceSize;
      }
    }

    if (currentChunk.length > 0) {
      chunks.push(currentChunk.join(' '));
    }

    return chunks.filter(c => c.trim().length > 20);
  }

  // ─── INDEXING ─────────────────────────────────────────────────────────────

  async indexDocument(namespace, document, metadata = {}) {
    const { text, metadata: docMeta } = document;
    const chunks = this.chunkText(text);
    
    logger.info(`Indexing ${chunks.length} chunks into namespace: ${namespace}`);

    const items = chunks.map((chunk, i) => ({
      text: chunk,
      metadata: {
        ...metadata,
        ...docMeta,
        chunkIndex: i,
        totalChunks: chunks.length,
        indexedAt: new Date().toISOString(),
      },
    }));

    await vectorService.upsert(namespace, items);
    
    return { chunksIndexed: chunks.length, namespace };
  }

  // ─── RETRIEVAL ────────────────────────────────────────────────────────────

  async retrieve(namespace, query, topK = 5) {
    const results = await vectorService.search(namespace, query, topK);
    return results;
  }

  // ─── CONTEXT INJECTION ────────────────────────────────────────────────────

  buildRAGContext(results, query) {
    if (!results || results.length === 0) return '';

    let context = `## Relevant Document Excerpts\n`;
    context += `*Based on your uploaded documents, here are the most relevant sections for: "${query}"*\n\n`;
    
    results.forEach((r, i) => {
      context += `### Excerpt ${i + 1} (relevance: ${(r.score * 100).toFixed(0)}%)\n`;
      context += `${r.text}\n\n`;
    });

    context += `---\n*Use the above document context to answer the user's question accurately.*\n`;
    
    return context;
  }

  // ─── SESSION NAMESPACE ────────────────────────────────────────────────────

  getSessionNamespace(sessionId) {
    return `session_${sessionId}`;
  }

  async clearSessionDocuments(sessionId) {
    await vectorService.deleteNamespace(this.getSessionNamespace(sessionId));
  }
}

export const ragService = new RAGService();
