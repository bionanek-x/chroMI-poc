import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { TouchInput } from './TouchInput';
import {
  exportTelemetryCsv,
  getTelemetryRowCount,
  startRecording,
  stopRecording,
} from '../hooks/useTelemetry';
import { startShot, type ShotResult } from '../hooks/useShotBenchmark';
import { useSceneStore } from '../stores/sceneStore';
import { FpsIndicator } from './FpsOverlay';
import { ShotReport } from './ShotReport';
import { HelpModal } from './HelpModal';

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
  const stacks = useSceneStore((s) => s.stacks);

  const [layerInput, setLayerInput] = useState(String(palletLayers));
  const [recState, setRecState] = useState<'idle' | 'recording' | 'stopped'>('idle');
  const [elapsedSec, setElapsedSec] = useState(0);
  const [rowCount, setRowCount] = useState(0);
  const startTimeRef = useRef<number>(0);

  const [shotPhase, setShotPhase] = useState<'idle' | 'capturing'>('idle');
  const [lastShotResult, setLastShotResult] = useState<ShotResult | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

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
      startTimeRef.current = Date.now();
      setElapsedSec(0);
      setRowCount(0);
      setRecState('recording');
    }
  }, [recState]);

  const handleTakeShot = useCallback(() => {
    if (shotPhase === 'capturing') return;
    setShotPhase('capturing');
    startShot(stacks.map((s) => s.id), (result) => {
      setLastShotResult(result);
      setShowReport(true);
      setShotPhase('idle');
    });
    remountAll();
  }, [shotPhase, stacks, remountAll]);

  // Tick elapsed time while recording — derived from wall-clock, not tick count
  useEffect(() => {
    if (recState !== 'recording') return;
    const id = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - startTimeRef.current) / 1000));
      setRowCount(getTelemetryRowCount());
    }, 250);
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
      <FpsIndicator />

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

      <button
        onClick={handleTakeShot}
        disabled={shotPhase === 'capturing'}
        title="Remount all stacks and benchmark mount time, FPS, and memory"
        style={{
          minHeight: 48, minWidth: 130, borderRadius: 8,
          border: `1px solid ${shotPhase === 'capturing' ? 'rgba(167,139,250,0.5)' : 'rgba(167,139,250,0.3)'}`,
          background: shotPhase === 'capturing' ? 'rgba(167,139,250,0.15)' : 'rgba(167,139,250,0.07)',
          color: '#a78bfa',
          fontFamily: 'system-ui, sans-serif', fontSize: 15, fontWeight: 500,
          cursor: shotPhase === 'capturing' ? 'default' : 'pointer', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          opacity: shotPhase === 'capturing' ? 0.7 : 1,
        }}
      >
        {shotPhase === 'capturing' && (
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: '#a78bfa', flexShrink: 0,
            animation: 'hmi-blink 1s step-start infinite',
          }} />
        )}
        {shotPhase === 'capturing' ? 'Measuring…' : '◉ Take shot'}
      </button>

      {lastShotResult && (
        <button
          onClick={() => setShowReport(true)}
          title="Reopen last benchmark results"
          style={{
            minHeight: 48, minWidth: 48, borderRadius: 8,
            border: '1px solid rgba(167,139,250,0.3)',
            background: 'rgba(167,139,250,0.07)',
            color: '#a78bfa',
            fontFamily: 'system-ui, sans-serif', fontSize: 14, fontWeight: 500,
            cursor: 'pointer', flexShrink: 0,
          }}
        >
          Last benchmark
        </button>
      )}

      {/* Recording controls + help */}
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
        <button
          onClick={() => setShowHelp(true)}
          title="How to use this tool"
          style={{
            minHeight: 48, width: 48, borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(255,255,255,0.04)',
            color: '#6b7280',
            fontFamily: 'system-ui, sans-serif', fontSize: 18, fontWeight: 600,
            cursor: 'pointer', flexShrink: 0,
          }}
        >
          ?
        </button>
      </div>

      <style>{`
        @keyframes hmi-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>

      {showReport && lastShotResult && createPortal(
        <ShotReport result={lastShotResult} onClose={() => setShowReport(false)} />,
        document.body,
      )}
      {showHelp && createPortal(
        <HelpModal onClose={() => setShowHelp(false)} />,
        document.body,
      )}
    </div>
  );
}
