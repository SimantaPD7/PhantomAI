import { useChatStore } from '../../lib/store';
import { Plus, MessageSquare, Trash2, Cpu, ChevronLeft, Zap } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function Sidebar() {
  const { sessions, activeSessionId, createSession, setActiveSession, deleteSession, setSidebarOpen } = useChatStore();

  const handleDelete = (e, id) => {
    e.stopPropagation();
    deleteSession(id);
    if (sessions.length <= 1) setTimeout(() => createSession(), 30);
  };

  return (
    <div style={{ height:'100vh', display:'flex', flexDirection:'column', width:260, background:'rgba(4,4,14,0.94)', backdropFilter:'blur(32px)', WebkitBackdropFilter:'blur(32px)', borderRight:'1px solid rgba(255,255,255,0.06)' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 16px', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
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
        <button onClick={() => setSidebarOpen(false)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--muted)', padding:6, borderRadius:8 }}
          onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.05)'}
          onMouseLeave={e => e.currentTarget.style.background='none'}>
          <ChevronLeft size={15} />
        </button>
      </div>

      {/* New chat button */}
      <div style={{ padding:'10px 12px' }}>
        <button onClick={() => createSession()} style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:7, padding:'10px 14px', borderRadius:12, border:'none', cursor:'pointer', background:'linear-gradient(135deg,#7c3aed,#3b82f6)', color:'white', fontWeight:600, fontSize:13, fontFamily:'inherit', boxShadow:'0 4px 20px rgba(124,58,237,0.35)', letterSpacing:'0.02em' }}
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
              style={{ display:'flex', alignItems:'flex-start', gap:9, padding:'9px 10px', borderRadius:12, cursor:'pointer', marginBottom:2, background: active ? 'rgba(124,58,237,0.11)' : 'transparent', border: `1px solid ${active ? 'rgba(124,58,237,0.28)' : 'transparent'}`, transition:'all 0.15s' }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.background='rgba(255,255,255,0.04)'; }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.background='transparent'; }}>
              <MessageSquare size={12} style={{ color: active ? '#a78bfa' : 'rgba(255,255,255,0.2)', flexShrink:0, marginTop:2 }} />
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:12.5, fontWeight:500, color: active ? 'var(--text)' : 'var(--muted)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {sess.title || 'New Chat'}
                </div>
                <div style={{ fontSize:10, color:'rgba(255,255,255,0.18)', marginTop:2 }}>
                  {formatDistanceToNow(new Date(sess.createdAt), { addSuffix: true })}
                </div>
              </div>
              <button onClick={e => handleDelete(e, sess.id)}
                style={{ background:'none', border:'none', cursor:'pointer', color:'rgba(255,255,255,0.15)', padding:4, borderRadius:6, opacity:0, transition:'opacity 0.15s', flexShrink:0 }}
                onMouseEnter={e => { e.currentTarget.style.color='#f87171'; e.currentTarget.style.background='rgba(239,68,68,0.1)'; }}
                onMouseLeave={e => { e.currentTarget.style.color='rgba(255,255,255,0.15)'; e.currentTarget.style.background='none'; }}
                className="del-btn">
                <Trash2 size={11} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div style={{ padding:'10px 12px', borderTop:'1px solid rgba(255,255,255,0.06)' }}>
        <div className="glass" style={{ borderRadius:10, padding:'9px 12px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:10, color:'var(--muted)' }}>
            <Zap size={9} color="var(--phantom)" />
            Planner · Research · Reasoning
          </div>
          <div style={{ fontSize:10, color:'rgba(255,255,255,0.13)', marginTop:3 }}>
            Memory · RAG · 100+ languages
          </div>
        </div>
      </div>

      <style>{`.del-btn { opacity: 0 } div:hover > div > .del-btn { opacity: 1 }`}</style>
    </div>
  );
}