import mongoose from 'mongoose';

const DocumentSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, index: true },
  userId: { type: String, index: true },
  filename: { type: String, required: true },
  originalName: { type: String, required: true },
  mimeType: { type: String },
  size: { type: Number },
  path: { type: String },
  chunksIndexed: { type: Number, default: 0 },
  status: { 
    type: String, 
    enum: ['processing', 'ready', 'error'], 
    default: 'processing' 
  },
  error: { type: String },
  createdAt: { type: Date, default: Date.now },
});

export const Document = mongoose.model('Document', DocumentSchema);
