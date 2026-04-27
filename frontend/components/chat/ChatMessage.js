import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Check, Globe, FileText, Brain } from 'lucide-react';

function CopyBtn({ text }) {
  const [ok, setOk] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 2000); }}
      style={{ position:'absolute', top:8, right:8, background:'rgba(255,255,255,0.08)', border:'none', cursor:'pointer', color: ok ? '#4ade80' : 'rgba(255,255,255,0.45)', padding:'4px 6px', borderRadius:7, display:'flex', alignItems:'center', gap:4, fontSize:11, opacity:0, transition:'opacity 0.15s' }}
      className="copy-btn">
      {ok ? <Check size={11} /> : <Copy size={11} />}
    </button>
  );
}

function ThinkingDots() {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, padding:'4px 0' }}>
      <span className="dot" style={{ width:7, height:7, background:'rgba(139,92,246,0.6)' }} />
      <span className="dot" style={{ width:9, height:9, background:'linear-gradient(135deg,#a78bfa,#818cf8)', boxShadow:'0 0 10px rgba(139,92,246,0.8)' }} />
      <span className="dot" style={{ width:7, height:7, background:'rgba(139,92,246,0.6)' }} />
    </div>
  );
}

const mdComponents = {
  code({ inline, className, children }) {
    const match = /language-(\w+)/.exec(className || '');
    const code = String(children).replace(/\n$/, '');
    if (!inline && match) {
      return (
        <div style={{ position:'relative' }} className="code-block">
          <div style={{ position:'absolute', top:0, left:0, right:0, display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 14px', background:'rgba(0,0,0,0.4)', borderBottom:'1px solid rgba(124,58,237,0.15)', borderRadius:'11px 11px 0 0', zIndex:1 }}>
            <span style={{ fontSize:11, fontFamily:'var(--mono)', color:'#a78bfa' }}>{match[1]}</span>
          </div>
          <CopyBtn text={code} />
          <SyntaxHighlighter style={oneDark} language={match[1]} PreTag="div"
            customStyle={{ margin:0, paddingTop:'2.2em', borderRadius:11, background:'rgba(4,4,18,0.92)', border:'1px solid rgba(124,58,237,0.15)', fontSize:13 }}>
            {code}
          </SyntaxHighlighter>
          <style>{'.code-block:hover .copy-btn { opacity: 1 }'}</style>
        </div>
      );
    }
    return <code className={className}>{children}</code>;
  },
};

export default function ChatMessage({ message, isStreaming }) {
  const isUser = message.role === 'user';
  const isEmpty = !message.content && isStreaming;

  if (isUser) {
    return (
      <div style={{ display:'flex', justifyContent:'flex-end', padding:'6px 16px' }}>
        <div style={{ maxWidth:'70%', padding:'11px 16px', borderRadius:'18px 18px 4px 18px', background:'linear-gradient(135deg,rgba(124,58,237,0.22),rgba(59,130,246,0.16))', border:'1px solid rgba(124,58,237,0.22)', fontSize:14, lineHeight:1.6, color:'var(--text)', wordBreak:'break-word' }}>
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display:'flex', gap:12, padding:'8px 16px' }}>
      {/* Avatar */}
      <div style={{ flexShrink:0, width:32, height:32, borderRadius:11, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:12, color:'white', background:'linear-gradient(135deg,#7c3aed,#3b82f6)', animation: isStreaming ? 'glowPulse 2s ease-in-out infinite' : 'none', boxShadow:'0 0 10px rgba(124,58,237,0.5)' }}>
        P
      </div>
      {/* Content */}
      <div style={{ flex:1, minWidth:0, paddingTop:2 }}>
        {isEmpty ? <ThinkingDots /> : (
          <>
            <div className="prose" style={{ fontSize:14 }}>
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                {message.content || ''}
              </ReactMarkdown>
            </div>
            {/* Meta badges */}
            {(message.usedSearch || message.usedRAG || message.memoryUsed) && (
              <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:10 }}>
                {message.usedSearch && (
                  <span style={{ display:'flex', alignItems:'center', gap:4, fontSize:10, padding:'2px 8px', borderRadius:99, background:'rgba(59,130,246,0.1)', border:'1px solid rgba(59,130,246,0.2)', color:'#60a5fa' }}>
                    <Globe size={9} /> web search
                  </span>
                )}
                {message.usedRAG && (
                  <span style={{ display:'flex', alignItems:'center', gap:4, fontSize:10, padding:'2px 8px', borderRadius:99, background:'rgba(124,58,237,0.1)', border:'1px solid rgba(124,58,237,0.2)', color:'#a78bfa' }}>
                    <FileText size={9} /> docs
                  </span>
                )}
                {message.memoryUsed && (
                  <span style={{ display:'flex', alignItems:'center', gap:4, fontSize:10, padding:'2px 8px', borderRadius:99, background:'rgba(6,182,212,0.08)', border:'1px solid rgba(6,182,212,0.15)', color:'#22d3ee' }}>
                    <Brain size={9} /> memory
                  </span>
                )}
              </div>
            )}
            {message.elapsed && (
              <div style={{ fontSize:10, color:'rgba(255,255,255,0.15)', marginTop:6 }}>
                {message.model ? `⚡ ${message.model.split('/').pop()} · ` : ''}{(message.elapsed/1000).toFixed(1)}s
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}