import { useState, useEffect } from 'react';
import { getStableSceneTimings } from '../stores/renderTimingStore';

function msColor(ms: number) {
  if (ms <= 20) return '#4ade80';
  if (ms <= 33) return '#facc15';
  return '#f87171';
}

interface Props {
  sceneId: string;
}

export function SceneRenderTime({ sceneId }: Props) {
  const [ms, setMs] = useState<number | null>(null);

  useEffect(() => {
    const id = setInterval(() => {
      const t = getStableSceneTimings().get(sceneId) ?? null;
      setMs(t);
    }, 500);
    return () => clearInterval(id);
  }, [sceneId]);

  if (ms === null) return null;

  return (
    <div style={{
      position: 'absolute',
      bottom: 10,
      left: 10,
      zIndex: 10,
      fontFamily: 'monospace',
      fontSize: 12,
      fontWeight: 700,
      color: msColor(ms),
      background: 'rgba(0,0,0,0.55)',
      backdropFilter: 'blur(4px)',
      padding: '3px 8px',
      borderRadius: 5,
      border: `1px solid ${msColor(ms)}44`,
      pointerEvents: 'none',
      userSelect: 'none',
    }}>
      {ms.toFixed(1)} ms
    </div>
  );
}
