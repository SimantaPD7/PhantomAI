import mongoose from 'mongoose';

const MemorySchema = new mongoose.Schema({
  sessionId: { type: String, index: true },
  userId: { type: String, index: true },
  preferences: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {},
  },
  facts: [{ type: String }],
  summary: { type: String, default: '' },
  semanticKeys: [{ type: String }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

export const Memory = mongoose.model('Memory', MemorySchema);
