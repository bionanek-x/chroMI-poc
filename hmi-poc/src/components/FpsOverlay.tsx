import { useState, useEffect } from 'react';

function fpsColor(fps: number) {
  if (fps >= 50) return '#4ade80';
  if (fps >= 30) return '#facc15';
  return '#f87171';
}

export function FpsIndicator() {
  const [fps, setFps] = useState(0);

  useEffect(() => {
    let frames = 0;
    let lastTime = performance.now();
    let rafId: number;

    function tick() {
      frames++;
      const now = performance.now();
      if (now - lastTime >= 1000) {
        setFps(Math.round(frames * 1000 / (now - lastTime)));
        frames = 0;
        lastTime = now;
      }
      rafId = requestAnimationFrame(tick);
    }

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <div style={{
      fontFamily: 'monospace',
      fontSize: 13,
      fontWeight: 700,
      color: fpsColor(fps),
      letterSpacing: '0.05em',
      pointerEvents: 'none',
      userSelect: 'none',
      whiteSpace: 'nowrap',
    }}>
      {fps} fps
    </div>
  );
}
