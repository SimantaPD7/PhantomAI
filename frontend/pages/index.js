import dynamic from 'next/dynamic';

// Shell page with ZERO hooks — safe for SSR
// Everything is loaded client-side only
const App = dynamic(() => import('../components/App'), { ssr: false });

export default function Page() {
  return <App />;
}
