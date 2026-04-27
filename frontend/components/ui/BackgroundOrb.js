import { useEffect, useRef } from 'react';
export default function BackgroundOrb() {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let w = canvas.width = window.innerWidth;
    let h = canvas.height = window.innerHeight;
    let t = 0, raf;
    const resize = () => { w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight; };
    window.addEventListener('resize', resize);
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      t += 0.003;
      const cx = w*0.5 + Math.sin(t*0.7)*w*0.07;
      const cy = h*0.28 + Math.cos(t*0.5)*h*0.05;
      const r = Math.min(w,h)*0.42;
      const g = ctx.createRadialGradient(cx,cy,0,cx,cy,r);
      g.addColorStop(0, 'rgba(124,58,237,0.16)');
      g.addColorStop(0.5, 'rgba(99,47,200,0.06)');
      g.addColorStop(1, 'transparent');
      ctx.fillStyle = g; ctx.fillRect(0,0,w,h);
      const cx2 = w*0.78 + Math.cos(t*0.55)*w*0.05;
      const cy2 = h*0.72 + Math.sin(t*0.4)*h*0.05;
      const g2 = ctx.createRadialGradient(cx2,cy2,0,cx2,cy2,r*0.55);
      g2.addColorStop(0, 'rgba(59,130,246,0.09)');
      g2.addColorStop(1, 'transparent');
      ctx.fillStyle = g2; ctx.fillRect(0,0,w,h);
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);
  return <canvas ref={ref} style={{ position:'fixed', inset:0, pointerEvents:'none', zIndex:0, opacity:0.85 }} />;
}