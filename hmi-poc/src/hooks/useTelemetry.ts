import { getPerf } from 'r3f-perf';
import { useSceneStore } from '../stores/sceneStore';
import { getActiveSceneTimings } from '../stores/renderTimingStore';

const MAX_SCENES = 8; // maximum per-scene columns in the CSV

// ── Thresholds ────────────────────────────────────────────────────────────────
const THRESHOLDS = {
  fps:       { good: 50, warn: 30 },   // GOOD ≥ 50, WARN ≥ 30, CRIT < 30
  frameTime: { good: 20, warn: 33 },   // GOOD ≤ 20 ms, WARN ≤ 33 ms, CRIT > 33 ms
} as const;

function fpsBand(fps: number)       { return fps >= THRESHOLDS.fps.good ? 'GOOD' : fps >= THRESHOLDS.fps.warn ? 'WARN' : 'CRIT'; }
function frameTimeBand(ms: number)  { return ms <= THRESHOLDS.frameTime.good ? 'GOOD' : ms <= THRESHOLDS.frameTime.warn ? 'WARN' : 'CRIT'; }

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
  const gl = state?.accumulated?.gl;
  if (!log) return;

  const fps = log.fps ?? 0;
  const frameTime = log.duration ?? 0;
  const elapsed = ((Date.now() - recordingStartMs) / 1000).toFixed(1);

  const scene = useSceneStore.getState();

  // Per-scene render times, ordered by stack position
  const sceneTimings = getActiveSceneTimings();
  const orderedTimes = scene.stacks.map((s) => sceneTimings.get(s.id) ?? null);
  const totalRenderMs = orderedTimes.reduce<number>((sum, t) => sum + (t ?? 0), 0);
  const perSceneCols = Array.from({ length: MAX_SCENES }, (_, i) =>
    orderedTimes[i] != null ? (orderedTimes[i] as number).toFixed(2) : '',
  );

  const row = [
    Date.now(),
    elapsed,
    fps.toFixed(1),
    fpsBand(fps),
    frameTime.toFixed(2),
    frameTimeBand(frameTime),
    gl?.calls ?? 0,
    gl?.triangles ?? 0,
    (log.gpu ?? 0).toFixed(2),
    scene.stacks.length,
    scene.palletLayers,
    scene.postFX,
    scene.shadowMapSize,
    scene.pixelRatio.toFixed(1),
    totalRenderMs.toFixed(2),
    ...perSceneCols,
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
    `# Thresholds: frameTime(ms) GOOD<=${THRESHOLDS.frameTime.good} WARN<=${THRESHOLDS.frameTime.warn} CRIT>${THRESHOLDS.frameTime.warn}`,
  ].join('\n');

  const sceneHeaders = Array.from({ length: MAX_SCENES }, (_, i) => `s${i + 1}_ms`).join(',');
  const header = `timestamp,elapsed_s,fps,fps_band,frameTime_ms,frameTime_band,drawCalls,triangles,gpuMemMB,stacks,layers,postFX,shadowMap,pixelRatio,total_render_ms,${sceneHeaders}`;

  return meta + '\n' + header + '\n' + buffer.join('\n');
}

export function getTelemetryRowCount(): number {
  return buffer.length;
}
