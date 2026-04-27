import mongoose from 'mongoose';

const MessageSchema = new mongoose.Schema({
  role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
  content: { type: String, required: true },
  model: { type: String },
  taskType: { type: String },
  usedSearch: { type: Boolean, default: false },
  usedRAG: { type: Boolean, default: false },
  searchResults: { type: mongoose.Schema.Types.Mixed },
  plan: { type: mongoose.Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now },
});

const ChatSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true, index: true },
  userId: { type: String, index: true },
  title: { type: String, default: 'New Chat' },
  messages: [MessageSchema],
  metadata: {
    model: String,
    totalMessages: { type: Number, default: 0 },
    hasDocuments: { type: Boolean, default: false },
    documentCount: { type: Number, default: 0 },
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

ChatSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  this.metadata.totalMessages = this.messages.length;
  if (this.messages.length === 1 && this.title === 'New Chat') {
    const firstMsg = this.messages[0].content;
    this.title = firstMsg.slice(0, 60) + (firstMsg.length > 60 ? '...' : '');
  }
  next();
});

export const Chat = mongoose.model('Chat', ChatSchema);
