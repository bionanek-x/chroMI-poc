import { useState, useEffect } from 'react';
import { getStableSceneTimings } from '../stores/renderTimingStore';

// Thresholds for total mount duration (first frame → 60-frame steady state)
function mountColor(ms: number) {
  if (ms <= 1500) return '#4ade80';
  if (ms <= 3000) return '#facc15';
  return '#f87171';
}

function fmtMount(ms: number) {
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(2)} s`;
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

  const color = mountColor(ms);
  return (
    <div style={{
      position: 'absolute',
      bottom: 10,
      left: 10,
      zIndex: 10,
      fontFamily: 'monospace',
      fontSize: 12,
      fontWeight: 700,
      color,
      background: 'rgba(0,0,0,0.55)',
      backdropFilter: 'blur(4px)',
      padding: '3px 8px',
      borderRadius: 5,
      border: `1px solid ${color}44`,
      pointerEvents: 'none',
      userSelect: 'none',
    }}>
      {fmtMount(ms)}
    </div>
  );
}
