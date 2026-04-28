import { useState, useEffect, useCallback } from 'react';
import { TouchInput } from './TouchInput';
import {
  exportTelemetryCsv,
  getTelemetryRowCount,
  startRecording,
  stopRecording,
} from '../hooks/useTelemetry';
import { useSceneStore } from '../stores/sceneStore';

function downloadCsv() {
  const csv = exportTelemetryCsv();
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `hmi_telemetry_${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export function HUD() {
  const palletLayers = useSceneStore((s) => s.palletLayers);
  const setParam = useSceneStore((s) => s.setParam);
  const addStack = useSceneStore((s) => s.addStack);
  const remountAll = useSceneStore((s) => s.remountAll);

  const [layerInput, setLayerInput] = useState(String(palletLayers));
  const [recState, setRecState] = useState<'idle' | 'recording' | 'stopped'>('idle');
  const [elapsedSec, setElapsedSec] = useState(0);
  const [rowCount, setRowCount] = useState(0);

  const handleRender = useCallback(() => {
    const n = parseInt(layerInput, 10);
    if (!isNaN(n) && n >= 1) setParam('palletLayers', n);
  }, [layerInput, setParam]);

  const handleRecStop = useCallback(() => {
    if (recState === 'recording') {
      stopRecording();
      setRecState('stopped');
      setRowCount(getTelemetryRowCount());
    } else {
      startRecording();
      setElapsedSec(0);
      setRowCount(0);
      setRecState('recording');
    }
  }, [recState]);

  // Tick elapsed time while recording
  useEffect(() => {
    if (recState !== 'recording') return;
    const id = setInterval(() => {
      setElapsedSec((s) => s + 1);
      setRowCount(getTelemetryRowCount());
    }, 1000);
    return () => clearInterval(id);
  }, [recState]);

  const recLabel = recState === 'recording'
    ? `■ Stop  ${formatElapsed(elapsedSec)}`
    : recState === 'stopped'
    ? '● Rec again'
    : '● Rec';

  const recColor = recState === 'recording' ? '#f87171' : '#a3e635';

  return (
    <div style={{
      background: 'rgba(0,0,0,0.75)',
      backdropFilter: 'blur(8px)',
      borderTop: '1px solid rgba(255,255,255,0.07)',
      padding: '12px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: 24,
      flexShrink: 0,
    }}>
      {/* Layer count control */}
      <TouchInput
        label="Layers"
        value={layerInput}
        onChange={setLayerInput}
        layout="numeric"
        placeholder="3"
        style={{ minWidth: 100 }}
      />
      <button
        onClick={handleRender}
        style={{
          minHeight: 48, minWidth: 100, borderRadius: 8,
          border: '1px solid rgba(99,202,183,0.4)',
          background: 'rgba(99,202,183,0.12)',
          color: '#63cab7',
          fontFamily: 'system-ui, sans-serif', fontSize: 15, fontWeight: 600,
          cursor: 'pointer', letterSpacing: '0.03em', flexShrink: 0,
        }}
      >
        Render!
      </button>

      <button
        onClick={addStack}
        style={{
          minHeight: 48, minWidth: 110, borderRadius: 8,
          border: '1px solid rgba(255,255,255,0.15)',
          background: 'rgba(255,255,255,0.06)',
          color: '#e5e7eb',
          fontFamily: 'system-ui, sans-serif', fontSize: 15, fontWeight: 500,
          cursor: 'pointer', flexShrink: 0,
        }}
      >
        + Add stack
      </button>

      <button
        onClick={remountAll}
        title="Destroy and re-mount all stacks"
        style={{
          minHeight: 48, minWidth: 110, borderRadius: 8,
          border: '1px solid rgba(251,191,36,0.3)',
          background: 'rgba(251,191,36,0.07)',
          color: '#fbbf24',
          fontFamily: 'system-ui, sans-serif', fontSize: 15, fontWeight: 500,
          cursor: 'pointer', flexShrink: 0,
        }}
      >
        ↺ Remount all
      </button>

      {/* Recording controls */}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={handleRecStop}
          title={recState === 'recording' ? 'Stop recording' : 'Start recording telemetry'}
          style={{
            minHeight: 48, minWidth: 140, borderRadius: 8,
            border: `1px solid ${recColor}44`,
            background: `${recColor}11`,
            color: recColor,
            fontFamily: 'system-ui, sans-serif', fontSize: 14, fontWeight: 600,
            cursor: 'pointer', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          {recState === 'recording' && (
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: recColor, flexShrink: 0,
              animation: 'hmi-blink 1s step-start infinite',
            }} />
          )}
          {recLabel}
        </button>

        {recState !== 'idle' && rowCount > 0 && (
          <button
            onClick={downloadCsv}
            title={`Download CSV — ${rowCount} samples`}
            style={{
              minHeight: 48, minWidth: 110, borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.15)',
              background: 'rgba(255,255,255,0.06)',
              color: '#e5e7eb',
              fontFamily: 'system-ui, sans-serif', fontSize: 13, fontWeight: 500,
              cursor: 'pointer', flexShrink: 0,
            }}
          >
            ↓ CSV ({rowCount})
          </button>
        )}
      </div>

      <style>{`
        @keyframes hmi-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
