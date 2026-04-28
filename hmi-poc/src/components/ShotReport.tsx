import { useState, useEffect, useRef } from 'react';
import type { ShotResult } from '../hooks/useShotBenchmark';

interface Props {
  result: ShotResult;
  onClose: () => void;
}

function fmt1(n: number) { return n.toFixed(1); }
function fmt0(n: number) { return Math.round(n).toString(); }
function fmtMs(n: number) { return n < 1000 ? `${Math.round(n)} ms` : `${(n / 1000).toFixed(2)} s`; }
function fmtSign(n: number) { return (n >= 0 ? '+' : '') + fmt1(n); }

function band(fps: number) {
  return fps >= 50 ? '#4ade80' : fps >= 30 ? '#fbbf24' : '#f87171';
}

function downloadJson(result: ShotResult) {
  const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `hmi_shot_${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadCsv(result: ShotResult) {
  const ts = Date.now();
  const summaryRows = [
    ['capturedAt', result.capturedAt],
    ['stackCount', result.stackCount],
    ['palletLayers', result.palletLayers],
    ['boxesPerStack', result.boxesPerStack],
    ['totalBoxes', result.totalBoxes],
    ['totalMountMs', result.totalMountMs],
    ['baselineFps', result.baselineFps],
    ['avgFpsDuring', result.avgFpsDuring],
    ['finalFps', result.finalFps],
    ['baselineHeapMb', result.baselineHeapMb],
    ['finalHeapMb', result.finalHeapMb],
    ['heapDeltaMb', result.heapDeltaMb],
  ];

  const stackRows = [
    ['sceneId', 'mountMs', 'peakFrameMs'],
    ...result.stackMounts.map(m => [m.sceneId, m.mountMs, m.peakFrameMs]),
  ];

  const csv =
    'Summary\n' +
    summaryRows.map(r => r.join(',')).join('\n') +
    '\n\nPer-stack\n' +
    stackRows.map(r => r.join(',')).join('\n');

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `hmi_shot_${ts}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const ROW: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
  padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.05)',
};
const LABEL: React.CSSProperties = { color: '#9ca3af', fontSize: 13 };
const VAL: React.CSSProperties = { color: '#e5e7eb', fontSize: 14, fontWeight: 600, fontVariantNumeric: 'tabular-nums' };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ color: '#6b7280', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );
}

function Row({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div style={ROW}>
      <span style={LABEL}>{label}</span>
      <span style={{ ...VAL, color: valueColor ?? '#e5e7eb' }}>{value}</span>
    </div>
  );
}

export function ShotReport({ result, onClose }: Props) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const dragStart = useRef({ mx: 0, my: 0, ox: 0, oy: 0 });

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      setOffset({
        x: dragStart.current.ox + e.clientX - dragStart.current.mx,
        y: dragStart.current.oy + e.clientY - dragStart.current.my,
      });
    };
    const onUp = () => { dragging.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  const onHeaderMouseDown = (e: React.MouseEvent) => {
    dragging.current = true;
    dragStart.current = { mx: e.clientX, my: e.clientY, ox: offset.x, oy: offset.y };
    e.preventDefault();
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: 24,
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#0f0f1e',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 12,
          width: 540,
          maxWidth: '90vw',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'system-ui, sans-serif',
          boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
          transform: `translate(${offset.x}px, ${offset.y}px)`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Draggable header */}
        <div
          onMouseDown={onHeaderMouseDown}
          style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
            padding: '20px 24px 16px',
            borderBottom: '1px solid rgba(255,255,255,0.07)',
            cursor: 'grab',
            flexShrink: 0,
            userSelect: 'none',
          }}
        >
          <div>
            <div style={{ color: '#e5e7eb', fontSize: 17, fontWeight: 700 }}>Benchmark Report</div>
            <div style={{ color: '#6b7280', fontSize: 12, marginTop: 3 }}>{result.capturedAt}</div>
          </div>
          <button
            onClick={onClose}
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 6, color: '#9ca3af', fontSize: 18, lineHeight: 1,
              width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
          >×</button>
        </div>

        {/* Scrollable content */}
        <div style={{ overflowY: 'auto', padding: '20px 24px', flex: 1, minHeight: 0 }}>
          {/* Scene summary */}
          <Section title="Scene">
            <Row label="Stacks rendered" value={String(result.stackCount)} />
            <Row label="Layers per stack" value={String(result.palletLayers)} />
            <Row label="Boxes per stack" value={String(result.boxesPerStack)} />
            <Row label="Total boxes" value={String(result.totalBoxes)} />
          </Section>

          {/* Mount timing */}
          <Section title="Mount timing">
            <Row label="Total (first → last stable)" value={fmtMs(result.totalMountMs)} />
            <div style={{ marginTop: 10 }}>
              <div style={{ color: '#9ca3af', fontSize: 12, marginBottom: 6 }}>Per-stack (sorted by mount order)</div>
              <div style={{
                background: 'rgba(255,255,255,0.03)', borderRadius: 6, overflow: 'hidden',
                border: '1px solid rgba(255,255,255,0.07)',
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', padding: '6px 12px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                  <span style={{ color: '#6b7280', fontSize: 11, fontWeight: 600 }}>Stack</span>
                  <span style={{ color: '#6b7280', fontSize: 11, fontWeight: 600, textAlign: 'center' }}>Mount time</span>
                  <span style={{ color: '#6b7280', fontSize: 11, fontWeight: 600, textAlign: 'right' }}>Peak frame</span>
                </div>
                {result.stackMounts.map((m, i) => (
                  <div
                    key={m.sceneId}
                    style={{
                      display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
                      padding: '5px 12px',
                      borderBottom: i < result.stackMounts.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                    }}
                  >
                    <span style={{ color: '#9ca3af', fontSize: 13 }}>#{m.sceneId}</span>
                    <span style={{ color: '#e5e7eb', fontSize: 13, fontWeight: 600, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{fmtMs(m.mountMs)}</span>
                    <span style={{
                      fontSize: 13, fontWeight: 600, textAlign: 'right', fontVariantNumeric: 'tabular-nums',
                      color: m.peakFrameMs <= 20 ? '#4ade80' : m.peakFrameMs <= 33 ? '#fbbf24' : '#f87171',
                    }}>{fmt1(m.peakFrameMs)} ms</span>
                  </div>
                ))}
              </div>
            </div>
          </Section>

          {/* FPS */}
          <Section title="FPS">
            <Row label="Before unmount (baseline)" value={`${fmt1(result.baselineFps)} fps`} valueColor={band(result.baselineFps)} />
            <Row label="Avg while mounting" value={`${fmt1(result.avgFpsDuring)} fps`} valueColor={band(result.avgFpsDuring)} />
            <Row label="After all mounted" value={`${fmt1(result.finalFps)} fps`} valueColor={band(result.finalFps)} />
          </Section>

          {/* Memory */}
          <Section title="JS Heap">
            <Row label="Before" value={`${fmt1(result.baselineHeapMb)} MB`} />
            <Row label="After" value={`${fmt1(result.finalHeapMb)} MB`} />
            <Row
              label="Delta"
              value={`${fmtSign(result.heapDeltaMb)} MB`}
              valueColor={result.heapDeltaMb > 50 ? '#f87171' : result.heapDeltaMb > 20 ? '#fbbf24' : '#4ade80'}
            />
            {result.baselineHeapMb === 0 && (
              <div style={{ color: '#6b7280', fontSize: 11, marginTop: 4 }}>performance.memory not available (non-Chromium browser)</div>
            )}
          </Section>
        </div>

        {/* Fixed footer actions */}
        <div style={{
          display: 'flex', gap: 10,
          padding: '16px 24px',
          borderTop: '1px solid rgba(255,255,255,0.07)',
          flexShrink: 0,
        }}>
          <button
            onClick={() => downloadJson(result)}
            style={{
              flex: 1, minHeight: 40, borderRadius: 7,
              border: '1px solid rgba(255,255,255,0.15)',
              background: 'rgba(255,255,255,0.06)',
              color: '#e5e7eb', fontSize: 13, fontWeight: 500, cursor: 'pointer',
            }}
          >
            ↓ JSON
          </button>
          <button
            onClick={() => downloadCsv(result)}
            style={{
              flex: 1, minHeight: 40, borderRadius: 7,
              border: '1px solid rgba(255,255,255,0.15)',
              background: 'rgba(255,255,255,0.06)',
              color: '#e5e7eb', fontSize: 13, fontWeight: 500, cursor: 'pointer',
            }}
          >
            ↓ CSV
          </button>
          <button
            onClick={onClose}
            style={{
              flex: 1, minHeight: 40, borderRadius: 7,
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'transparent',
              color: '#6b7280', fontSize: 13, cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
