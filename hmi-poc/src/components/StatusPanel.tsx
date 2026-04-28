import { useSceneStore } from '../stores/sceneStore';

export function StatusPanel() {
  const fps = useSceneStore((s) => s.fps);
  const productCount = useSceneStore((s) => s.productCount);
  const shadowMapSize = useSceneStore((s) => s.shadowMapSize);
  const pixelRatio = useSceneStore((s) => s.pixelRatio);
  const postFX = useSceneStore((s) => s.postFX);
  const materialQuality = useSceneStore((s) => s.materialQuality);
  const conveyorSpeed = useSceneStore((s) => s.conveyorSpeed);
  const robotRunning = useSceneStore((s) => s.robotRunning);

  const fpsColor = fps >= 55 ? '#22c55e' : fps >= 30 ? '#f59e0b' : '#ef4444';

  return (
    <div style={{
      position: 'absolute',
      top: 12,
      left: 12,
      background: 'rgba(0,0,0,0.65)',
      backdropFilter: 'blur(6px)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 8,
      padding: '10px 14px',
      fontFamily: 'monospace',
      fontSize: 12,
      color: '#d1d5db',
      lineHeight: 1.7,
      minWidth: 200,
      pointerEvents: 'none',
      userSelect: 'none',
    }}>
      <div style={{ fontSize: 18, fontWeight: 700, color: fpsColor, marginBottom: 4 }}>
        {fps.toFixed(1)} <span style={{ fontSize: 11, fontWeight: 400, color: '#6b7280' }}>FPS</span>
      </div>
      <Row label="Products" value={productCount} />
      <Row label="Shadows" value={shadowMapSize === 0 ? 'off' : `${shadowMapSize}px`} />
      <Row label="DPR" value={pixelRatio.toFixed(2)} />
      <Row label="PostFX" value={postFX} />
      <Row label="Material" value={materialQuality} />
      <Row label="Conveyor" value={robotRunning ? `${conveyorSpeed.toFixed(1)}×` : 'stopped'} />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
      <span style={{ color: '#6b7280' }}>{label}</span>
      <span>{value}</span>
    </div>
  );
}
