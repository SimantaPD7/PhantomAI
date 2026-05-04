import { useChatStore, THEMES } from '../../lib/store';
import { Plus, MessageSquare, Trash2, Cpu, ChevronLeft, Zap, Sun, Moon, Layers } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const THEME_CONFIG = {
  dark:    { icon: Moon,   label: 'Dark',    next: 'light'   },
  light:   { icon: Sun,    label: 'Light',   next: 'frosted' },
  frosted: { icon: Layers, label: 'Frosted', next: 'dark'    },
};

export default function Sidebar() {
  const { sessions, activeSessionId, createSession, setActiveSession, deleteSession, setSidebarOpen, theme, setTheme } = useChatStore();

  const handleDelete = (e, id) => {
    e.stopPropagation();
    deleteSession(id);
    if (sessions.length <= 1) setTimeout(() => createSession(), 30);
  };

  const cfg = THEME_CONFIG[theme] || THEME_CONFIG.dark;
  const ThemeIcon = cfg.icon;

  const sidebarBg = theme === 'light'
    ? 'rgba(255,255,255,0.97)'
    : theme === 'frosted'
    ? 'rgba(15,10,46,0.55)'
    : 'rgba(4,4,14,0.94)';

  const borderColor = theme === 'light'
    ? 'rgba(0,0,0,0.08)'
    : theme === 'frosted'
    ? 'rgba(255,255,255,0.1)'
    : 'rgba(255,255,255,0.06)';

  return (
    <div style={{
      height: '100vh', display: 'flex', flexDirection: 'column', width: 260,
      background: sidebarBg,
      backdropFilter: 'blur(32px)', WebkitBackdropFilter: 'blur(32px)',
      borderRight: `1px solid ${borderColor}`,
      transition: 'background 0.3s ease',
    }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 16px', borderBottom:`1px solid ${borderColor}` }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:30, height:30, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', background:'linear-gradient(135deg,#7c3aed,#3b82f6)', boxShadow:'0 0 18px rgba(124,58,237,0.6)' }}>
            <Cpu size={14} color="white" />
          </div>
          <div>
            <div className="gradient-text" style={{ fontWeight:700, fontSize:13, letterSpacing:'0.03em' }}>PhantomAI</div>
            <div style={{ display:'flex', alignItems:'center', gap:4, marginTop:2 }}>
              <div style={{ width:5, height:5, borderRadius:'50%', background:'#4ade80', boxShadow:'0 0 6px rgba(74,222,128,0.9)' }} />
              <span style={{ fontSize:9, textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--muted)' }}>Online</span>
            </div>
          </div>
        </div>
        <button onClick={() => setSidebarOpen(false)}
          style={{ background:'none', border:'none', cursor:'pointer', color:'var(--muted)', padding:6, borderRadius:8 }}
          onMouseEnter={e => e.currentTarget.style.background='rgba(124,58,237,0.08)'}
          onMouseLeave={e => e.currentTarget.style.background='none'}>
          <ChevronLeft size={15} />
        </button>
      </div>

      {/* Theme toggle */}
      <div style={{ padding:'8px 12px', borderBottom:`1px solid ${borderColor}` }}>
        <div style={{ display:'flex', gap:4 }}>
          {THEMES.map(t => {
            const c = THEME_CONFIG[t];
            const Icon = c.icon;
            const active = theme === t;
            return (
              <button key={t} onClick={() => setTheme(t)}
                title={c.label}
                style={{
                  flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:5,
                  padding:'7px 0', borderRadius:10, border:'none', cursor:'pointer',
                  fontFamily:'inherit', fontSize:10, fontWeight:600, letterSpacing:'0.03em',
                  transition:'all 0.2s ease',
                  background: active ? 'linear-gradient(135deg,#7c3aed,#3b82f6)' : 'rgba(124,58,237,0.07)',
                  color: active ? 'white' : 'var(--muted)',
                  boxShadow: active ? '0 2px 12px rgba(124,58,237,0.35)' : 'none',
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background='rgba(124,58,237,0.13)'; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background='rgba(124,58,237,0.07)'; }}>
                <Icon size={11} />
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* New chat button */}
      <div style={{ padding:'10px 12px' }}>
        <button onClick={() => createSession()}
          style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:7, padding:'10px 14px', borderRadius:12, border:'none', cursor:'pointer', background:'linear-gradient(135deg,#7c3aed,#3b82f6)', color:'white', fontWeight:600, fontSize:13, fontFamily:'inherit', boxShadow:'0 4px 20px rgba(124,58,237,0.35)', letterSpacing:'0.02em' }}
          onMouseEnter={e => e.currentTarget.style.filter='brightness(1.1)'}
          onMouseLeave={e => e.currentTarget.style.filter='none'}
          onMouseDown={e => e.currentTarget.style.transform='scale(0.97)'}
          onMouseUp={e => e.currentTarget.style.transform='none'}>
          <Plus size={14} strokeWidth={2.5} /> New Chat
        </button>
      </div>

      {/* Chat list */}
      <div style={{ flex:1, overflowY:'auto', padding:'0 8px 12px' }}>
        {sessions.length === 0 ? (
          <div style={{ textAlign:'center', padding:'40px 16px', color:'var(--muted)' }}>
            <MessageSquare size={24} style={{ margin:'0 auto 12px', opacity:0.2 }} />
            <p style={{ fontSize:12 }}>No conversations yet</p>
          </div>
        ) : sessions.map(sess => {
          const active = sess.id === activeSessionId;
          return (
            <div key={sess.id} onClick={() => setActiveSession(sess.id)}
              className="chat-item"
              style={{ display:'flex', alignItems:'flex-start', gap:9, padding:'9px 10px', borderRadius:12, cursor:'pointer', marginBottom:2, background: active ? 'rgba(124,58,237,0.11)' : 'transparent', border:`1px solid ${active ? 'rgba(124,58,237,0.28)' : 'transparent'}`, transition:'all 0.15s' }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.background='rgba(124,58,237,0.06)'; }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.background='transparent'; }}>
              <MessageSquare size={12} style={{ color: active ? '#a78bfa' : 'var(--muted)', flexShrink:0, marginTop:2 }} />
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:12.5, fontWeight:500, color: active ? 'var(--text)' : 'var(--muted)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {sess.title || 'New Chat'}
                </div>
                <div style={{ fontSize:10, color:'var(--muted)', opacity:0.5, marginTop:2 }}>
                  {formatDistanceToNow(new Date(sess.createdAt), { addSuffix: true })}
                </div>
              </div>
              <button onClick={e => handleDelete(e, sess.id)}
                className="del-btn"
                style={{ background:'none', border:'none', cursor:'pointer', color:'var(--muted)', padding:4, borderRadius:6, flexShrink:0, transition:'opacity 0.15s, color 0.15s, background 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.color='#f87171'; e.currentTarget.style.background='rgba(239,68,68,0.1)'; }}
                onMouseLeave={e => { e.currentTarget.style.color='var(--muted)'; e.currentTarget.style.background='none'; }}>
                <Trash2 size={11} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div style={{ padding:'10px 12px', borderTop:`1px solid ${borderColor}` }}>
        <div className="glass" style={{ borderRadius:10, padding:'9px 12px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:10, color:'var(--muted)' }}>
            <Zap size={9} color="var(--phantom)" />
            Planner · Research · Reasoning
          </div>
          <div style={{ fontSize:10, color:'var(--muted)', opacity:0.4, marginTop:3 }}>
            Memory · RAG · 100+ languages
          </div>
        </div>
      </div>

      <style>{`
        .del-btn { opacity: 0; }
        .chat-item:hover .del-btn { opacity: 1; }
        @media (hover: none) { .del-btn { opacity: 0.5; } }
      `}</style>
    </div>
  );
}