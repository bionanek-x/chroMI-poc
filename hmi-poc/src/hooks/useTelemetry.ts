import { getPerf } from 'r3f-perf';
import { useSceneStore } from '../stores/sceneStore';

// ── Thresholds ────────────────────────────────────────────────────────────────
const THRESHOLDS = {
  fps:       { good: 50,   warn: 30  }, // GOOD ≥ 50, WARN ≥ 30, CRIT < 30
  renderMs:  { good: 20,   warn: 33  }, // GOOD ≤ 20 ms, WARN ≤ 33 ms, CRIT > 33 ms
} as const;

function fpsBand(fps: number)      { return fps >= THRESHOLDS.fps.good ? 'GOOD' : fps >= THRESHOLDS.fps.warn ? 'WARN' : 'CRIT'; }
function renderBand(ms: number)    { return ms <= THRESHOLDS.renderMs.good ? 'GOOD' : ms <= THRESHOLDS.renderMs.warn ? 'WARN' : 'CRIT'; }

// performance.memory is Chrome-only but valid for kiosk targets
function jsHeapMb(): number {
  const mem = (performance as { memory?: { usedJSHeapSize: number } }).memory;
  return mem ? mem.usedJSHeapSize / 1_048_576 : 0;
}

// ── Recording state ───────────────────────────────────────────────────────────
const RING_SIZE = 3600;
const buffer: string[] = [];
let recording = false;
let recordingStartMs = 0;
let recordingStartLabel = '';

export function startRecording() {
  buffer.length = 0;
  recordingStartMs = Date.now();
  recordingStartLabel = new Date(recordingStartMs).toISOString();
  recording = true;
}

export function stopRecording() {
  recording = false;
}

export function isRecording() {
  return recording;
}

// ── Sampling ──────────────────────────────────────────────────────────────────
// Guard against duplicate rows when multiple PalletScene instances each host a
// TelemetrySampler — only one write per 800 ms window is accepted.
let lastSampleMs = 0;

export function sampleTelemetry() {
  if (!recording) return;
  const now = Date.now();
  if (now - lastSampleMs < 800) return;
  lastSampleMs = now;

  const state = getPerf();
  const log = state?.log;
  if (!log) return;

  const fps = log.fps ?? 0;
  const renderMs = log.duration ?? 0;
  const elapsed = ((Date.now() - recordingStartMs) / 1000).toFixed(1);
  const scene = useSceneStore.getState();

  const row = [
    Date.now(),
    elapsed,
    fps.toFixed(1),
    fpsBand(fps),
    renderMs.toFixed(2),
    renderBand(renderMs),
    (log.gpu ?? 0).toFixed(2),
    jsHeapMb().toFixed(1),
    scene.stacks.length,
    scene.palletLayers,
    scene.postFX,
    scene.shadowMapSize,
    scene.pixelRatio.toFixed(1),
  ].join(',');

  buffer.push(row);
  if (buffer.length > RING_SIZE) buffer.shift();

  try {
    localStorage.setItem('hmi_telemetry', buffer.join('\n'));
  } catch {
    // localStorage quota — non-fatal
  }
  window.postMessage({ type: 'hmi_telemetry_sample', row }, '*');
}

// ── Export ────────────────────────────────────────────────────────────────────
export function exportTelemetryCsv(): string {
  const meta = [
    `# Recording started: ${recordingStartLabel}`,
    `# Thresholds: fps GOOD>=${THRESHOLDS.fps.good} WARN>=${THRESHOLDS.fps.warn} CRIT<${THRESHOLDS.fps.warn}`,
    `# Thresholds: render_ms GOOD<=${THRESHOLDS.renderMs.good} WARN<=${THRESHOLDS.renderMs.warn} CRIT>${THRESHOLDS.renderMs.warn}`,
    `# Note: cpu_usage% not available via browser API — use render_ms as proxy`,
    `# Note: gpu_usage% not available via browser API — gpu_mem_mb is GPU memory, not utilisation`,
    `#`,
    `# Columns:`,
    `#   timestamp   — Unix epoch ms when the sample was captured`,
    `#   elapsed_s   — Seconds elapsed since recording started`,
    `#   fps         — Frames per second reported by r3f-perf`,
    `#   fps_band    — Quality band for fps: GOOD(>=${THRESHOLDS.fps.good}) / WARN(>=${THRESHOLDS.fps.warn}) / CRIT(<${THRESHOLDS.fps.warn})`,
    `#   render_ms   — Three.js scene render call duration in ms (r3f-perf log.duration)`,
    `#   render_band — Quality band for render_ms: GOOD(<=${THRESHOLDS.renderMs.good}ms) / WARN(<=${THRESHOLDS.renderMs.warn}ms) / CRIT(>${THRESHOLDS.renderMs.warn}ms)`,
    `#   gpu_mem_mb  — GPU memory usage in MB from r3f-perf (not GPU utilisation %)`,
    `#   js_heap_mb  — JS heap used in MB via performance.memory (Chrome/kiosk only; 0 elsewhere)`,
    `#   stacks      — Number of pallet stacks currently rendered`,
    `#   layers      — Number of pallet layers per stack`,
    `#   postFX      — Post-processing effects enabled (true/false)`,
    `#   shadowMap   — Shadow map resolution in px (e.g. 1024, 2048)`,
    `#   pixelRatio  — Renderer device pixel ratio`,
  ].join('\n');

  const header = 'timestamp,elapsed_s,fps,fps_band,render_ms,render_band,gpu_mem_mb,js_heap_mb,stacks,layers,postFX,shadowMap,pixelRatio';

  return meta + '\n' + header + '\n' + buffer.join('\n');
}

export function getTelemetryRowCount(): number {
  return buffer.length;
}
