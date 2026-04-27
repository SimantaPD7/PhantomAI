import express from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { ragService } from '../services/ragService.js';
import { Document } from '../models/Document.js';
import { Chat } from '../models/Chat.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

const storage = multer.diskStorage({
  destination: process.env.UPLOAD_DIR || './uploads',
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: (parseInt(process.env.MAX_FILE_SIZE_MB) || 10) * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/pdf',
      'text/plain',
      'text/markdown',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (allowed.includes(file.mimetype) || file.originalname.match(/\.(pdf|txt|md|docx)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, TXT, MD, and DOCX files are supported'));
    }
  },
});

// ─── UPLOAD DOCUMENT ─────────────────────────────────────────────────────────

router.post('/', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const { sessionId, userId } = req.body;
  if (!sessionId) {
    return res.status(400).json({ error: 'sessionId is required' });
  }

  let doc;
  try {
    doc = new Document({
      sessionId,
      userId,
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      path: req.file.path,
      status: 'processing',
    });
    await doc.save();
  } catch (dbErr) {
    logger.warn('MongoDB unavailable — document metadata not persisted:', dbErr.message);
    // Continue without DB: still index the file into the vector store
    doc = {
      _id: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      status: 'processing',
      save: async () => {},
    };
  }

  // Process async
  setImmediate(async () => {
    try {
      const parsedDoc = await ragService.parseDocument(req.file.path, req.file.mimetype);
      const namespace = ragService.getSessionNamespace(sessionId);
      
      const result = await ragService.indexDocument(namespace, parsedDoc, {
        documentId: doc._id.toString(),
        filename: req.file.originalname,
        sessionId,
      });

      doc.chunksIndexed = result.chunksIndexed;
      doc.status = 'ready';
      await doc.save();

      // Update chat metadata
      await Chat.findOneAndUpdate(
        { sessionId },
        {
          $inc: { 'metadata.documentCount': 1 },
          $set: { 'metadata.hasDocuments': true },
        }
      );

      logger.info(`Document processed: ${req.file.originalname}, chunks: ${result.chunksIndexed}`);
    } catch (error) {
      logger.error('Document processing error:', error);
      doc.status = 'error';
      doc.error = error.message;
      await doc.save();
    }
  });

  res.json({
    success: true,
    document: {
      id: doc._id,
      filename: doc.originalName,
      size: doc.size,
      status: doc.status,
    },
    message: 'Document uploaded and being processed...',
  });
});

// ─── GET DOCUMENTS FOR SESSION ────────────────────────────────────────────────

router.get('/session/:sessionId', async (req, res) => {
  const docs = await Document.find({ sessionId: req.params.sessionId })
    .select('originalName size status chunksIndexed createdAt')
    .lean();
  
  res.json({ documents: docs });
});

// ─── DELETE DOCUMENT ─────────────────────────────────────────────────────────

router.delete('/:id', async (req, res) => {
  const doc = await Document.findByIdAndDelete(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Document not found' });

  // Note: We don't remove from vector DB here to avoid complexity
  // In production, you'd track individual document chunks
  res.json({ success: true });
});

export default router;
