import '../styles/globals.css';
import { useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import { useChatStore } from '../lib/store';

export default function App({ Component, pageProps }) {
  useEffect(() => {
    // Load saved data from localStorage on first client render only
    useChatStore.getState().hydrate();
  }, []);

  return (
    <>
      <Component {...pageProps} />
      <Toaster position="top-right" toastOptions={{
        style: {
          background: 'rgba(8,8,20,0.96)',
          border: '1px solid rgba(124,58,237,0.3)',
          color: '#e8e8f4',
          backdropFilter: 'blur(20px)',
          borderRadius: '12px',
          fontSize: '13px',
          fontFamily: 'Sora,system-ui,sans-serif',
        },
        success: { iconTheme: { primary: '#8b5cf6', secondary: '#02020a' } },
        error: { iconTheme: { primary: '#ef4444', secondary: '#02020a' } },
      }} />
    </>
  );
}
