import { useState, useEffect, useRef } from 'react';
import type { AggregateStat, MultiShotResult, ShotResult } from '../hooks/useShotBenchmark';

interface Props {
  result: MultiShotResult;
  onClose: () => void;
}

function fmt1(n: number) { return n.toFixed(1); }
function fmt2(n: number) { return n.toFixed(2); }
function fmtMs(n: number) { return n < 1000 ? `${Math.round(n)} ms` : `${(n / 1000).toFixed(2)} s`; }
function fmtSign(n: number) { return (n >= 0 ? '+' : '') + fmt1(n); }

function fpsBand(fps: number) {
  return fps >= 50 ? '#4ade80' : fps >= 30 ? '#fbbf24' : '#f87171';
}

function frameBand(ms: number) {
  return ms <= 20 ? '#4ade80' : ms <= 33 ? '#fbbf24' : '#f87171';
}

function meanStddev(s: AggregateStat, fmt: (n: number) => string, suffix: string) {
  return `${fmt(s.mean)}${suffix} ± ${fmt(s.stddev)}`;
}

function downloadJson(result: MultiShotResult) {
  const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `hmi_shot_${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadCsv(result: MultiShotResult) {
  const ts = Date.now();
  const a = result.aggregates;
  const summaryRows: (string | number)[][] = [
    ['capturedAt', result.capturedAt],
    ['runCount', result.runCount],
    ['stackCount', result.stackCount],
    ['palletLayers', result.palletLayers],
    ['boxesPerStack', result.boxesPerStack],
    ['totalBoxes', result.totalBoxes],
    [],
    ['metric', 'mean', 'stddev', 'min', 'max'],
    ['baselineFps', a.baselineFps.mean, a.baselineFps.stddev, a.baselineFps.min, a.baselineFps.max],
    ['avgFpsDuring', a.avgFpsDuring.mean, a.avgFpsDuring.stddev, a.avgFpsDuring.min, a.avgFpsDuring.max],
    ['finalFps', a.finalFps.mean, a.finalFps.stddev, a.finalFps.min, a.finalFps.max],
    ['totalMountMs', a.totalMountMs.mean, a.totalMountMs.stddev, a.totalMountMs.min, a.totalMountMs.max],
    ['finalP50Ms', a.finalP50Ms.mean, a.finalP50Ms.stddev, a.finalP50Ms.min, a.finalP50Ms.max],
    ['finalP95Ms', a.finalP95Ms.mean, a.finalP95Ms.stddev, a.finalP95Ms.min, a.finalP95Ms.max],
    ['finalP99Ms', a.finalP99Ms.mean, a.finalP99Ms.stddev, a.finalP99Ms.min, a.finalP99Ms.max],
    ['finalMaxMs', a.finalMaxMs.mean, a.finalMaxMs.stddev, a.finalMaxMs.min, a.finalMaxMs.max],
    ['heapDeltaMb', a.heapDeltaMb.mean, a.heapDeltaMb.stddev, a.heapDeltaMb.min, a.heapDeltaMb.max],
  ];

  const runHeader = ['run', 'totalMountMs', 'baselineFps', 'avgFpsDuring', 'finalFps', 'finalP50Ms', 'finalP95Ms', 'finalP99Ms', 'finalMaxMs', 'heapDeltaMb'];
  const runRows: (string | number)[][] = [
    runHeader,
    ...result.runs.map((r, i) => [
      i + 1, r.totalMountMs, r.baselineFps, r.avgFpsDuring, r.finalFps,
      r.finalP50Ms, r.finalP95Ms, r.finalP99Ms, r.finalMaxMs, r.heapDeltaMb,
    ]),
  ];

  const csv =
    'Aggregates\n' +
    summaryRows.map((r) => r.join(',')).join('\n') +
    '\n\nPer-run\n' +
    runRows.map((r) => r.join(',')).join('\n');

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a2 = document.createElement('a');
  a2.href = url;
  a2.download = `hmi_shot_${ts}.csv`;
  a2.click();
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

function PerRunTable({ runs }: { runs: ShotResult[] }) {
  const HEADER: React.CSSProperties = { color: '#6b7280', fontSize: 11, fontWeight: 600 };
  const CELL: React.CSSProperties = { color: '#e5e7eb', fontSize: 12, fontWeight: 500, fontVariantNumeric: 'tabular-nums' };
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)', borderRadius: 6, overflow: 'hidden',
      border: '1px solid rgba(255,255,255,0.07)',
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 1fr 1fr 1fr', padding: '6px 12px', borderBottom: '1px solid rgba(255,255,255,0.07)', gap: 8 }}>
        <span style={HEADER}>#</span>
        <span style={{ ...HEADER, textAlign: 'right' }}>Mount</span>
        <span style={{ ...HEADER, textAlign: 'right' }}>Final FPS</span>
        <span style={{ ...HEADER, textAlign: 'right' }}>p95</span>
        <span style={{ ...HEADER, textAlign: 'right' }}>Max</span>
      </div>
      {runs.map((r, i) => (
        <div
          key={i}
          style={{
            display: 'grid', gridTemplateColumns: '40px 1fr 1fr 1fr 1fr',
            padding: '5px 12px', gap: 8,
            borderBottom: i < runs.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
          }}
        >
          <span style={{ ...CELL, color: '#9ca3af' }}>{i + 1}</span>
          <span style={{ ...CELL, textAlign: 'right' }}>{fmtMs(r.totalMountMs)}</span>
          <span style={{ ...CELL, textAlign: 'right', color: fpsBand(r.finalFps), fontWeight: 600 }}>{fmt1(r.finalFps)}</span>
          <span style={{ ...CELL, textAlign: 'right', color: frameBand(r.finalP95Ms) }}>{fmt1(r.finalP95Ms)} ms</span>
          <span style={{ ...CELL, textAlign: 'right', color: frameBand(r.finalMaxMs) }}>{fmt1(r.finalMaxMs)} ms</span>
        </div>
      ))}
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

  const a = result.aggregates;
  const lastRun = result.runs[result.runs.length - 1];

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
          width: 580,
          maxWidth: '92vw',
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
            <div style={{ color: '#e5e7eb', fontSize: 17, fontWeight: 700 }}>
              Benchmark Report — {result.runCount} runs
            </div>
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
          <Section title="Scene">
            <Row label="Stacks rendered" value={String(result.stackCount)} />
            <Row label="Layers per stack" value={String(result.palletLayers)} />
            <Row label="Boxes per stack" value={String(result.boxesPerStack)} />
            <Row label="Total boxes" value={String(result.totalBoxes)} />
          </Section>

          <Section title="Mount timing (mean ± stddev)">
            <Row label="Total (first → last stable)" value={meanStddev(a.totalMountMs, fmtMs, '')} />
          </Section>

          <Section title="FPS (mean ± stddev)">
            <Row
              label="Before unmount (baseline)"
              value={meanStddev(a.baselineFps, fmt1, ' fps')}
              valueColor={fpsBand(a.baselineFps.mean)}
            />
            <Row
              label="Avg while mounting"
              value={meanStddev(a.avgFpsDuring, fmt1, ' fps')}
              valueColor={fpsBand(a.avgFpsDuring.mean)}
            />
            <Row
              label="After all mounted (settled)"
              value={meanStddev(a.finalFps, fmt1, ' fps')}
              valueColor={fpsBand(a.finalFps.mean)}
            />
          </Section>

          <Section title="Frame time during settle (lower = smoother)">
            <Row label="p50 (median)" value={meanStddev(a.finalP50Ms, fmt1, ' ms')} valueColor={frameBand(a.finalP50Ms.mean)} />
            <Row label="p95" value={meanStddev(a.finalP95Ms, fmt1, ' ms')} valueColor={frameBand(a.finalP95Ms.mean)} />
            <Row label="p99" value={meanStddev(a.finalP99Ms, fmt1, ' ms')} valueColor={frameBand(a.finalP99Ms.mean)} />
            <Row label="Max" value={meanStddev(a.finalMaxMs, fmt1, ' ms')} valueColor={frameBand(a.finalMaxMs.mean)} />
            <div style={{ color: '#6b7280', fontSize: 11, marginTop: 6 }}>
              Sampled via rAF during the {(lastRun.settleMs / 1000).toFixed(0)} s settle window after each run finished mounting.
              Last run: {lastRun.finalSampleCount} frames.
            </div>
          </Section>

          <Section title="Per-run breakdown">
            <PerRunTable runs={result.runs} />
          </Section>

          <Section title="JS Heap (mean ± stddev)">
            <Row label="Δ per cycle" value={`${fmtSign(a.heapDeltaMb.mean)} ± ${fmt2(a.heapDeltaMb.stddev)} MB`}
              valueColor={a.heapDeltaMb.mean > 50 ? '#f87171' : a.heapDeltaMb.mean > 20 ? '#fbbf24' : '#4ade80'}
            />
            <Row label="Last run (after)" value={`${fmt1(lastRun.finalHeapMb)} MB`} />
            {lastRun.baselineHeapMb === 0 && (
              <div style={{ color: '#6b7280', fontSize: 11, marginTop: 4 }}>performance.memory not available (non-Chromium browser)</div>
            )}
          </Section>

          <Section title="Last run — per-stack mounts">
            <div style={{
              background: 'rgba(255,255,255,0.03)', borderRadius: 6, overflow: 'hidden',
              border: '1px solid rgba(255,255,255,0.07)',
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', padding: '6px 12px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                <span style={{ color: '#6b7280', fontSize: 11, fontWeight: 600 }}>Stack</span>
                <span style={{ color: '#6b7280', fontSize: 11, fontWeight: 600, textAlign: 'center' }}>Mount time</span>
                <span style={{ color: '#6b7280', fontSize: 11, fontWeight: 600, textAlign: 'right' }}>Peak frame</span>
              </div>
              {lastRun.stackMounts.map((m, i) => (
                <div
                  key={m.sceneId}
                  style={{
                    display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
                    padding: '5px 12px',
                    borderBottom: i < lastRun.stackMounts.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                  }}
                >
                  <span style={{ color: '#9ca3af', fontSize: 13 }}>#{m.sceneId}</span>
                  <span style={{ color: '#e5e7eb', fontSize: 13, fontWeight: 600, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{fmtMs(m.mountMs)}</span>
                  <span style={{
                    fontSize: 13, fontWeight: 600, textAlign: 'right', fontVariantNumeric: 'tabular-nums',
                    color: frameBand(m.peakFrameMs),
                  }}>{fmt1(m.peakFrameMs)} ms</span>
                </div>
              ))}
            </div>
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
