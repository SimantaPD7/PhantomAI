import { useState, useRef, useCallback } from 'react';
import { Send, Square, Paperclip } from 'lucide-react';

export default function ChatInput({ onSend, onStop, isStreaming }) {
  const [text, setText] = useState('');
  const [active, setActive] = useState(false);
  const ref = useRef(null);

  const submit = useCallback(() => {
    if (text.trim() && !isStreaming) {
      onSend(text.trim());
      setText('');
      if (ref.current) { ref.current.style.height = 'auto'; }
    }
  }, [text, isStreaming, onSend]);

  const onKey = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
  }, [submit]);

  const onInput = (e) => {
    setText(e.target.value);
    if (ref.current) { ref.current.style.height = 'auto'; ref.current.style.height = Math.min(ref.current.scrollHeight, 180) + 'px'; }
  };

  const isActive = active || text.length > 0 || isStreaming;

  return (
    <div className={`input-frost${isActive ? ' typing' : ''}`} style={{ borderRadius:20, padding:'10px 14px', display:'flex', alignItems:'flex-end', gap:10 }}>
      <button style={{ background:'none', border:'none', cursor:'pointer', color:'rgba(255,255,255,0.2)', padding:4, borderRadius:8, flexShrink:0, marginBottom:2 }}
        onMouseEnter={e => e.currentTarget.style.color='rgba(255,255,255,0.45)'}
        onMouseLeave={e => e.currentTarget.style.color='rgba(255,255,255,0.2)'}>
        <Paperclip size={16} />
      </button>
      <textarea ref={ref} value={text} onChange={onInput} onKeyDown={onKey}
        onFocus={() => setActive(true)} onBlur={() => setActive(false)}
        placeholder="Ask PhantomAI anything…" rows={1}
        style={{ flex:1, background:'transparent', border:'none', outline:'none', resize:'none', color:'var(--text)', fontSize:14, lineHeight:1.6, fontFamily:'inherit', minHeight:24, maxHeight:180, overflowY:'auto' }}
      />
      {isStreaming ? (
        <button onClick={onStop} style={{ width:36, height:36, borderRadius:11, border:'1px solid rgba(239,68,68,0.35)', background:'rgba(239,68,68,0.12)', color:'#f87171', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0, marginBottom:2 }}>
          <Square size={13} fill="#f87171" />
        </button>
      ) : (
        <button onClick={submit} disabled={!text.trim()}
          style={{ width:36, height:36, borderRadius:11, border:'none', background: text.trim() ? 'linear-gradient(135deg,#7c3aed,#3b82f6)' : 'rgba(255,255,255,0.06)', color: text.trim() ? 'white' : 'rgba(255,255,255,0.2)', display:'flex', alignItems:'center', justifyContent:'center', cursor: text.trim() ? 'pointer' : 'not-allowed', flexShrink:0, marginBottom:2, boxShadow: text.trim() ? '0 4px 16px rgba(124,58,237,0.4)' : 'none', transition:'all 0.2s' }}>
          <Send size={14} />
        </button>
      )}
    </div>
  );
}