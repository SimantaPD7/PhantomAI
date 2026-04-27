import { useEffect, useRef, useState, useCallback } from 'react';
import { useChatStore } from '../../lib/store';
import { streamChat } from '../../lib/api';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import AgentStatus from '../agents/AgentStatus';
import { PanelLeftOpen, Cpu, Globe, Zap } from 'lucide-react';

function WelcomeScreen({ onSend }) {
  const starters = [
    { e:'⚡', t:'Explain quantum entanglement in simple terms' },
    { e:'🐍', t:'Write a Python async web scraper with rate limiting' },
    { e:'🌐', t:"What are today's biggest AI news stories?" },
    { e:'🏗️', t:'Microservices vs monolith — detailed comparison' },
  ];
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', padding:'0 24px', textAlign:'center', animation:'fadeUp 0.5s ease forwards' }}>
      <div style={{ position:'relative', marginBottom:32 }}>
        <div style={{ width:80, height:80, borderRadius:24, display:'flex', alignItems:'center', justifyContent:'center', background:'linear-gradient(135deg,#7c3aed,#3b82f6)', boxShadow:'0 0 60px rgba(124,58,237,0.5)', fontSize:36 }}>✦</div>
      </div>
      <h1 className="gradient-text" style={{ fontSize:38, fontWeight:800, marginBottom:8, letterSpacing:'-0.02em' }}>PhantomAI</h1>
      <p style={{ fontSize:14, color:'var(--muted)', maxWidth:380, lineHeight:1.65, marginBottom:40 }}>
        Multi-agent intelligence with real-time search, document understanding, memory, and 100+ language support.
      </p>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, width:'100%', maxWidth:520 }}>
        {starters.map((s,i) => (
          <button key={i} onClick={() => onSend(s.t)}
            style={{ display:'flex', alignItems:'flex-start', gap:11, padding:'14px 16px', borderRadius:16, border:'1px solid rgba(255,255,255,0.07)', background:'rgba(8,8,18,0.65)', backdropFilter:'blur(20px)', cursor:'pointer', textAlign:'left', transition:'all 0.2s', color:'var(--muted)', fontFamily:'inherit', fontSize:13, lineHeight:1.45, animationDelay:`${i*0.07}s` }}
            onMouseEnter={e => { e.currentTarget.style.color='var(--text)'; e.currentTarget.style.background='rgba(124,58,237,0.07)'; e.currentTarget.style.borderColor='rgba(124,58,237,0.3)'; }}
            onMouseLeave={e => { e.currentTarget.style.color='var(--muted)'; e.currentTarget.style.background='rgba(8,8,18,0.65)'; e.currentTarget.style.borderColor='rgba(255,255,255,0.07)'; }}>
            <span style={{ fontSize:18, flexShrink:0 }}>{s.e}</span>
            <span>{s.t}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ChatPanel() {
  const { sessions, activeSessionId, addMessage, updateLastMsg, sidebarOpen, setSidebarOpen, userId } = useChatStore();
  const bottomRef = useRef(null);
  const abortRef = useRef(null);
  const [streaming, setStreaming] = useState(false);
  const [stage, setStage] = useState(null);
  const [stageLabel, setStageLabel] = useState('');

  const session = sessions.find(s => s.id === activeSessionId);
  const messages = session?.messages || [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, messages[messages.length-1]?.content?.length]);

  const send = useCallback((text) => {
    if (!text.trim() || streaming || !activeSessionId) return;
    addMessage(activeSessionId, { role: 'user', content: text });
    addMessage(activeSessionId, { role: 'assistant', content: '' });
    setStreaming(true);
    setStage('planning');
    setStageLabel('Planning your request…');

    const history = messages.slice(-12)
      .filter(m => m.content)
      .map(m => ({ role: m.role, content: m.content }));

    let full = '';
    const abort = streamChat({
      message: text, sessionId: activeSessionId, userId, history,
      onChunk: chunk => { full += chunk; updateLastMsg(activeSessionId, full); },
      onPlan: () => {},
      onStage: ({ stage: s, label: l }) => { setStage(s); setStageLabel(l || s); },
      onSearchDone: () => {},
      onDone: data => {
        setStreaming(false); setStage(null); setStageLabel('');
        updateLastMsg(activeSessionId, data.content || full, {
          model: data.model, usedSearch: data.usedSearch, usedRAG: data.usedRAG,
          memoryUsed: data.memoryUsed, elapsed: data.elapsed,
        });
      },
      onError: err => {
        setStreaming(false); setStage(null); setStageLabel('');
        updateLastMsg(activeSessionId, '⚠️ ' + (err || 'Error — check backend and API key.'));
      },
    });
    abortRef.current = abort;
  }, [activeSessionId, messages, streaming, userId, addMessage, updateLastMsg]);

  const stop = () => {
    abortRef.current?.();
    setStreaming(false); setStage(null); setStageLabel('');
    updateLastMsg(activeSessionId, null);
  };

  const turnCount = messages.filter(m => m.role==='user').length;

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      {/* Topbar */}
      <div style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 18px', flexShrink:0, borderBottom:'1px solid rgba(255,255,255,0.06)', background:'rgba(4,4,14,0.6)', backdropFilter:'blur(20px)' }}>
        {!sidebarOpen && (
          <button onClick={() => setSidebarOpen(true)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--muted)', padding:5, borderRadius:8 }}
            onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.05)'}
            onMouseLeave={e => e.currentTarget.style.background='none'}>
            <PanelLeftOpen size={17} />
          </button>
        )}
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ width:24, height:24, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', background:'linear-gradient(135deg,#7c3aed,#3b82f6)', boxShadow:'0 0 10px rgba(124,58,237,0.5)' }}>
            <Cpu size={11} color="white" />
          </div>
          <span className="gradient-text" style={{ fontWeight:700, fontSize:13 }}>PhantomAI</span>
          <span style={{ fontSize:10, color:'rgba(255,255,255,0.2)', marginLeft:4 }}>v5</span>
        </div>
        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:12 }}>
          {streaming && (
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <div style={{ width:6, height:6, borderRadius:'50%', background:'#a78bfa', animation:'glowPulse 1.4s ease-in-out infinite' }} />
              <span style={{ fontSize:11, color:'#a78bfa', fontWeight:500 }}>{stageLabel || 'Thinking…'}</span>
            </div>
          )}
          <span style={{ fontSize:11, color:'rgba(255,255,255,0.15)' }}>{turnCount} turn{turnCount !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex:1, overflowY:'auto', paddingTop:8, paddingBottom:4 }}>
        {messages.length === 0 ? (
          <WelcomeScreen onSend={send} />
        ) : (
          <>
            {messages.map((m, i) => (
              <ChatMessage key={m.id || i} message={m}
                isStreaming={streaming && i === messages.length-1 && m.role==='assistant'} />
            ))}
            <div ref={bottomRef} style={{ height:8 }} />
          </>
        )}
      </div>

      {/* Agent status */}
      <AgentStatus stage={stage} label={stageLabel} visible={streaming} />

      {/* Input */}
      <div style={{ padding:'8px 16px 18px', flexShrink:0 }}>
        <ChatInput onSend={send} onStop={stop} isStreaming={streaming} />
        <p style={{ textAlign:'center', fontSize:11, color:'rgba(255,255,255,0.14)', marginTop:7 }}>
          Enter to send · Shift+Enter for newline · Supports 100+ languages
        </p>
      </div>
    </div>
  );
}