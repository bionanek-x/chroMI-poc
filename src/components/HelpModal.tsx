import { useState, useEffect, useRef } from 'react';

interface Props {
  onClose: () => void;
}

const OVERLAY: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 9999,
  background: 'rgba(0,0,0,0.6)',
  display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
  paddingTop: 24,
  backdropFilter: 'blur(4px)',
};

const PANEL: React.CSSProperties = {
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
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{
        color: '#6b7280', fontSize: 11, fontWeight: 700,
        letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10,
      }}>{title}</div>
      {children}
    </div>
  );
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 8, alignItems: 'baseline' }}>
      <span style={{
        color: '#e5e7eb', fontSize: 13, fontWeight: 600,
        whiteSpace: 'nowrap', minWidth: 130, flexShrink: 0,
      }}>{label}</span>
      <span style={{ color: '#9ca3af', fontSize: 13, lineHeight: 1.55 }}>{children}</span>
    </div>
  );
}

function Band({ label, color, children }: { label: string; color: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', marginBottom: 5 }}>
      <span style={{
        fontSize: 11, fontWeight: 700, color, background: `${color}18`,
        border: `1px solid ${color}44`, borderRadius: 4, padding: '1px 7px',
        letterSpacing: '0.05em', flexShrink: 0,
      }}>{label}</span>
      <span style={{ color: '#9ca3af', fontSize: 13 }}>{children}</span>
    </div>
  );
}

export function HelpModal({ onClose }: Props) {
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
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  const onHeaderMouseDown = (e: React.MouseEvent) => {
    dragging.current = true;
    dragStart.current = { mx: e.clientX, my: e.clientY, ox: offset.x, oy: offset.y };
    e.preventDefault();
  };

  return (
    <div style={OVERLAY} onClick={onClose}>
      <div
        style={{ ...PANEL, transform: `translate(${offset.x}px, ${offset.y}px)` }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Draggable header */}
        <div
          onMouseDown={onHeaderMouseDown}
          style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '20px 24px 16px',
            borderBottom: '1px solid rgba(255,255,255,0.07)',
            cursor: 'grab', flexShrink: 0, userSelect: 'none',
          }}
        >
          <div>
            <div style={{ color: '#e5e7eb', fontSize: 17, fontWeight: 700 }}>How to use this tool</div>
            <div style={{ color: '#6b7280', fontSize: 12, marginTop: 3 }}>
              Benchmarking Three.js / WebGL in Chromium kiosk mode
            </div>
          </div>
          <button
            onClick={onClose}
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 6, color: '#9ca3af', fontSize: 18, lineHeight: 1,
              width: 32, height: 32, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}
          >×</button>
        </div>

        {/* Scrollable body */}
        <div style={{ overflowY: 'auto', padding: '20px 24px', flex: 1, minHeight: 0 }}>

          <Section title="Goal">
            <p style={{ color: '#9ca3af', fontSize: 13, lineHeight: 1.65, margin: 0 }}>
              This tool renders one or more independent WebGL canvases — each showing a 3D pallet
              stack — and measures how well Chromium handles the load. The goal is to determine
              whether a full HMI built as a React/Three.js webapp is viable on the target kiosk
              hardware.
            </p>
          </Section>

          <Section title="Controls">
            <Item label="Layers + Render">
              Set the number of box layers per pallet and press <strong style={{ color: '#63cab7' }}>Render!</strong> to
              rebuild geometry. More layers = more geometry per canvas.
            </Item>
            <Item label="+ Add stack">
              Add another independent WebGL canvas. Each canvas has its own render loop and
              competes for the same GPU. This simulates multiple HMI panels.
            </Item>
            <Item label="↺ Remount all">
              Destroy and re-mount all canvases from scratch. Use this to reset state before a
              clean measurement.
            </Item>
            <Item label="◉ Take shot">
              The primary benchmark. Remounts all stacks and measures: time from remount until
              each canvas reaches steady state, FPS before / during / after load, and JS heap
              delta. Results appear in a report you can download as JSON or CSV.
            </Item>
            <Item label="● Rec / ■ Stop">
              Continuous telemetry at ~1 sample/sec. Records FPS (min across all canvases),
              worst-case frame time, GPU memory, and JS heap over time. Download as CSV for
              offline analysis.
            </Item>
          </Section>

          <Section title="What to read on screen">
            <Item label="FPS (bottom-left)">
              Real browser frame rate measured via <code style={{ color: '#a78bfa', fontSize: 12 }}>requestAnimationFrame</code>.
              This is what the user actually sees.
            </Item>
            <Item label="time badge per canvas">
              Total wall-clock time from the canvas's first frame until it completes 60 frames
              (≈ steady state). Covers shader compilation, geometry upload, and initial draw cost.
              Green ≤ 1.5 s, yellow ≤ 3 s, red &gt; 3 s.
            </Item>
          </Section>

          <Section title="Suggested test workflow">
            <div style={{ color: '#9ca3af', fontSize: 13, lineHeight: 1.75 }}>
              <div style={{ display: 'flex', gap: 10, marginBottom: 6 }}>
                <span style={{ color: '#4b5563', fontVariantNumeric: 'tabular-nums', minWidth: 20 }}>1.</span>
                <span>Set layers and add stacks to the target load. Wait a few seconds for the scene to settle.</span>
              </div>
              <div style={{ display: 'flex', gap: 10, marginBottom: 6 }}>
                <span style={{ color: '#4b5563', minWidth: 20 }}>2.</span>
                <span>Press <strong style={{ color: '#a78bfa' }}>◉ Take shot</strong>. Read the report: mount time shows cold-start cost, FPS drop shows transient load, heap delta shows memory growth per cycle.</span>
              </div>
              <div style={{ display: 'flex', gap: 10, marginBottom: 6 }}>
                <span style={{ color: '#4b5563', minWidth: 20 }}>3.</span>
                <span>Press <strong style={{ color: '#a3e635' }}>● Rec</strong>, let it record for 30–60 seconds under representative load, then stop and <strong style={{ color: '#e5e7eb' }}>↓ CSV</strong>.</span>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <span style={{ color: '#4b5563', minWidth: 20 }}>4.</span>
                <span>Repeat across hardware configurations and compare the CSVs. Key question: does steady-state FPS stay GOOD, and does the heap delta stay flat over multiple shot cycles?</span>
              </div>
            </div>
          </Section>

          <Section title="Performance bands">
            <div style={{ marginBottom: 14 }}>
              <div style={{ color: '#6b7280', fontSize: 12, marginBottom: 7 }}>FPS</div>
              <Band label="GOOD" color="#4ade80">≥ 50 fps — smooth, suitable for HMI</Band>
              <Band label="WARN" color="#fbbf24">≥ 30 fps — usable but marginal</Band>
              <Band label="CRIT" color="#f87171">&lt; 30 fps — too slow for interactive HMI</Band>
            </div>
            <div>
              <div style={{ color: '#6b7280', fontSize: 12, marginBottom: 7 }}>Mount duration (per-canvas badge)</div>
              <Band label="GOOD" color="#4ade80">≤ 1.5 s — fast cold start</Band>
              <Band label="WARN" color="#fbbf24">≤ 3 s — acceptable</Band>
              <Band label="CRIT" color="#f87171">&gt; 3 s — too slow for HMI startup</Band>
            </div>
          </Section>

        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 24px',
          borderTop: '1px solid rgba(255,255,255,0.07)',
          flexShrink: 0,
        }}>
          <button
            onClick={onClose}
            style={{
              width: '100%', minHeight: 40, borderRadius: 7,
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.04)',
              color: '#9ca3af', fontSize: 13, cursor: 'pointer',
            }}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
