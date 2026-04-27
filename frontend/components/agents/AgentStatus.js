import { Sparkles, Search, Brain, CheckCircle2 } from 'lucide-react';

const STAGES = {
  planning:  { Icon: Sparkles,      label: 'Planning your request…', color: '#a78bfa' },
  research:  { Icon: Search,        label: 'Searching the web…',     color: '#60a5fa' },
  reasoning: { Icon: Brain,         label: 'Generating response…',   color: '#c4b5fd' },
  done:      { Icon: CheckCircle2,  label: 'Done',                   color: '#4ade80' },
};

export default function AgentStatus({ stage, label, visible }) {
  if (!visible || !stage) return null;
  const { Icon, color } = STAGES[stage] || STAGES.reasoning;
  return (
    <div style={{ padding:'4px 16px 6px', flexShrink:0 }}>
      <div className="glass" style={{ borderRadius:12, padding:'7px 14px', display:'flex', alignItems:'center', gap:10 }}>
        <Icon size={13} color={color} />
        <span style={{ fontSize:12, fontWeight:500, color, flex:1 }}>{label || STAGES[stage]?.label}</span>
        <div style={{ display:'flex', gap:5 }}>
          {[0,1,2].map(i => (
            <span key={i} className="dot" style={{ width:4, height:4, background:color, opacity:0.7 }} />
          ))}
        </div>
      </div>
    </div>
  );
}