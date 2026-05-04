import { create } from 'zustand';

function genId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export const THEMES = ['dark', 'light', 'frosted'];

export const useChatStore = create((set, get) => ({
  sessions: [],
  activeSessionId: null,
  sidebarOpen: true,
  isStreaming: false,
  userId: null,
  theme: 'dark',

  initUser: () => { if (!get().userId) set({ userId: genId() }); },

  setTheme: (theme) => {
    set({ theme });
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme);
    }
  },

  createSession: (title = 'New Chat') => {
    const id = genId();
    set(s => ({
      sessions: [{ id, title, createdAt: new Date().toISOString(), messages: [] }, ...s.sessions],
      activeSessionId: id,
      isStreaming: false,
    }));
    return id;
  },

  setActiveSession: (id) => set({ activeSessionId: id, isStreaming: false }),

  deleteSession: (id) => set(s => {
    const sessions = s.sessions.filter(x => x.id !== id);
    const activeSessionId = s.activeSessionId === id ? (sessions[0]?.id ?? null) : s.activeSessionId;
    return { sessions, activeSessionId };
  }),

  addMessage: (sessionId, msg) => set(s => ({
    sessions: s.sessions.map(sess => {
      if (sess.id !== sessionId) return sess;
      const first = sess.messages.length === 0 && msg.role === 'user';
      return {
        ...sess,
        messages: [...sess.messages, { ...msg, id: genId(), ts: Date.now() }],
        title: first ? msg.content.slice(0, 52) + (msg.content.length > 52 ? '…' : '') : sess.title,
      };
    }),
  })),

  updateLastMsg: (sessionId, content, meta = {}) => set(s => ({
    sessions: s.sessions.map(sess => {
      if (sess.id !== sessionId) return sess;
      const msgs = [...sess.messages];
      const i = msgs.length - 1;
      if (i >= 0 && msgs[i].role === 'assistant') {
        if (content === null) msgs.splice(i, 1);
        else msgs[i] = { ...msgs[i], content, ...meta };
      }
      return { ...sess, messages: msgs };
    }),
  })),

  setSidebarOpen: (v) => set({ sidebarOpen: v }),
  setStreaming: (v) => set({ isStreaming: v }),
  clearAll: () => set({ sessions: [], activeSessionId: null, isStreaming: false }),

  hydrate: () => {
    try {
      const raw = localStorage.getItem('phantomai-v5');
      if (!raw) return;
      const saved = JSON.parse(raw);
      const theme = saved.theme || 'dark';
      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-theme', theme);
      }
      set({
        sessions: saved.sessions || [],
        activeSessionId: saved.activeSessionId || null,
        sidebarOpen: saved.sidebarOpen ?? true,
        userId: saved.userId || null,
        theme,
      });
    } catch {}
  },
}));

// Auto-save to localStorage on every state change (client only)
if (typeof window !== 'undefined') {
  useChatStore.subscribe((state) => {
    try {
      localStorage.setItem('phantomai-v5', JSON.stringify({
        sessions: state.sessions.map(x => ({ ...x, messages: x.messages.slice(-80) })),
        activeSessionId: state.activeSessionId,
        sidebarOpen: state.sidebarOpen,
        userId: state.userId,
        theme: state.theme,
      }));
    } catch {}
  });
}