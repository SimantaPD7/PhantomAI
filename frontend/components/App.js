import { useEffect, useState } from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import { useChatStore } from '../lib/store';

const Sidebar = dynamic(() => import('./sidebar/Sidebar'), { ssr: false });
const ChatPanel = dynamic(() => import('./chat/ChatPanel'), { ssr: false });
const BackgroundOrb = dynamic(() => import('./ui/BackgroundOrb'), { ssr: false });

function Splash() {
  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#02020a', zIndex: 999 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <span className="dot" style={{ width: 8, height: 8, background: 'rgba(139,92,246,0.6)' }} />
        <span className="dot" style={{ width: 10, height: 10, background: 'linear-gradient(135deg,#a78bfa,#818cf8)', boxShadow: '0 0 12px rgba(139,92,246,0.8)' }} />
        <span className="dot" style={{ width: 8, height: 8, background: 'rgba(139,92,246,0.6)' }} />
      </div>
    </div>
  );
}

export default function App() {
  const [mounted, setMounted] = useState(false);
  const { initUser, createSession, activeSessionId, sidebarOpen } = useChatStore();

  useEffect(() => {
    initUser();
    if (!activeSessionId) createSession();
    setMounted(true);
  }, []);

  if (!mounted) return <Splash />;

  return (
    <>
      <Head>
        <title>PhantomAI — Next-Generation Intelligence</title>
        <meta name="description" content="Multi-agent AI with real-time search, memory, RAG and multilingual support." />
      </Head>

      <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', background: 'var(--bg)', position: 'relative' }}>
        <BackgroundOrb />

        <div style={{
          flexShrink: 0,
          width: sidebarOpen ? 260 : 0,
          minWidth: 0,
          overflow: 'hidden',
          transition: 'width 0.28s cubic-bezier(0.4,0,0.2,1)',
          position: 'relative',
          zIndex: 20,
        }}>
          {sidebarOpen && <Sidebar />}
        </div>

        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', zIndex: 10, minWidth: 0 }}>
          <ChatPanel />
        </main>
      </div>
    </>
  );
}
