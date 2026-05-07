import { useSceneStore } from '../stores/sceneStore';
import { generateLayout } from '../scene/pallet/demoLayout';
import { getAggregatedFps } from '../stores/renderTimingStore';

function jsHeapMb(): number {
  const mem = (performance as { memory?: { usedJSHeapSize: number } }).memory;
  return mem ? mem.usedJSHeapSize / 1_048_576 : 0;
}

export interface StackMountRecord {
  sceneId: string;
  mountMs: number;     // ms from shot start until this stack's SceneTimer first stabilised
  peakFrameMs: number; // peak frame time during the first MEASURE_FRAMES window
}

export interface ShotResult {
  capturedAt: string;
  stackCount: number;
  palletLayers: number;
  boxesPerStack: number;
  totalBoxes: number;
  baselineFps: number;
  baselineHeapMb: number;
  avgFpsDuring: number;
  finalFps: number;
  finalHeapMb: number;
  heapDeltaMb: number;
  totalMountMs: number;       // time from shot start to last stack stable
  settleMs: number;           // delay waited after last stack mounted before sampling finalFps
  // Steady-state frame-time distribution sampled via rAF during the settle window.
  // Captures user-perceived smoothness: low p95/max means consistent frames; a high
  // max with a low p95 means rare hiccups.
  finalP50Ms: number;
  finalP95Ms: number;
  finalP99Ms: number;
  finalMaxMs: number;
  finalSampleCount: number;
  stackMounts: StackMountRecord[];
}

export interface AggregateStat {
  mean: number;
  stddev: number;
  min: number;
  max: number;
}

export interface MultiShotResult {
  capturedAt: string;
  runCount: number;
  stackCount: number;
  palletLayers: number;
  boxesPerStack: number;
  totalBoxes: number;
  runs: ShotResult[];
  aggregates: {
    baselineFps: AggregateStat;
    avgFpsDuring: AggregateStat;
    finalFps: AggregateStat;
    totalMountMs: AggregateStat;
    finalP50Ms: AggregateStat;
    finalP95Ms: AggregateStat;
    finalP99Ms: AggregateStat;
    finalMaxMs: AggregateStat;
    heapDeltaMb: AggregateStat;
  };
}

// How long to wait after the last stack mounts before sampling finalFps.
// Gives the renderer time to reach steady-state rather than capturing a
// still-climbing value right at the end of a heavy paint burst.
const SETTLE_MS = 2000;

// ── Module-level capture state ────────────────────────────────────────────────
let phase: 'idle' | 'capturing' = 'idle';
let shotStartMs = 0;
let expectedCount = 0;
const mountRecords = new Map<string, { mountMs: number; peakFrameMs: number }>();
const fpsSamples: number[] = [];
let fpsIntervalId: ReturnType<typeof setInterval> | null = null;
let baselineFps = 0;
let baselineHeapMb = 0;
let onComplete: ((r: ShotResult) => void) | null = null;

export function isShotCapturing() {
  return phase === 'capturing';
}

// Called by SceneTimer when a stack's measurement window first completes.
// Safe to call unconditionally — only acts when a shot is in progress.
export function notifyStackMounted(sceneId: string, peakFrameMs: number) {
  if (phase !== 'capturing') return;
  if (mountRecords.has(sceneId)) return;

  mountRecords.set(sceneId, { mountMs: Date.now() - shotStartMs, peakFrameMs });

  if (mountRecords.size >= expectedCount) _finalize();
}

function percentile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * q));
  return sorted[idx];
}

function _finalize() {
  phase = 'idle';
  if (fpsIntervalId !== null) {
    clearInterval(fpsIntervalId);
    fpsIntervalId = null;
  }

  // Snapshot everything that's known now (at last-stack-mounted time).
  const totalMountMs = Date.now() - shotStartMs;
  const avgFpsDuring =
    fpsSamples.length > 0
      ? fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length
      : 0;

  const scene = useSceneStore.getState();
  const layout = generateLayout(scene.palletLayers);
  const boxesPerStack = layout.boxes.length;

  const stackMounts: StackMountRecord[] = Array.from(mountRecords.entries())
    .map(([sceneId, r]) => ({ sceneId, ...r }))
    .sort((a, b) => a.mountMs - b.mountMs);

  const partial = {
    capturedAt: new Date().toISOString(),
    stackCount: scene.stacks.length,
    palletLayers: scene.palletLayers,
    boxesPerStack,
    totalBoxes: boxesPerStack * scene.stacks.length,
    baselineFps,
    baselineHeapMb,
    avgFpsDuring,
    totalMountMs,
    settleMs: SETTLE_MS,
    stackMounts,
  };

  // Sample inter-frame times during the settle window via rAF. The first frame
  // is dropped (its delta reflects scheduling latency, not steady-state render).
  const frameSamples: number[] = [];
  const settleStart = performance.now();
  let lastT = 0;
  let firstFrame = true;

  const tick = (now: number) => {
    if (firstFrame) {
      lastT = now;
      firstFrame = false;
    } else {
      frameSamples.push(now - lastT);
      lastT = now;
    }
    if (now - settleStart < SETTLE_MS) {
      requestAnimationFrame(tick);
    } else {
      const sorted = [...frameSamples].sort((a, b) => a - b);
      const finalFps = getAggregatedFps() ?? 0;
      const finalHeapMb = jsHeapMb();
      onComplete?.({
        ...partial,
        finalFps,
        finalHeapMb,
        heapDeltaMb: finalHeapMb - baselineHeapMb,
        finalP50Ms: percentile(sorted, 0.50),
        finalP95Ms: percentile(sorted, 0.95),
        finalP99Ms: percentile(sorted, 0.99),
        finalMaxMs: sorted[sorted.length - 1] ?? 0,
        finalSampleCount: frameSamples.length,
      });
    }
  };
  requestAnimationFrame(tick);
}

export function startShot(stackIds: string[], callback: (r: ShotResult) => void) {
  baselineFps = getAggregatedFps() ?? 0;
  baselineHeapMb = jsHeapMb();

  shotStartMs = Date.now();
  expectedCount = stackIds.length;
  mountRecords.clear();
  fpsSamples.length = 0;
  onComplete = callback;
  phase = 'capturing';

  // If there are no stacks, finalize immediately
  if (expectedCount === 0) {
    _finalize();
    return;
  }

  fpsIntervalId = setInterval(() => {
    if (phase !== 'capturing') return;
    const fps = getAggregatedFps();
    if (fps !== null) fpsSamples.push(fps);
  }, 100);
}

function stat(values: number[]): AggregateStat {
  if (values.length === 0) return { mean: 0, stddev: 0, min: 0, max: 0 };
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  return {
    mean,
    stddev: Math.sqrt(variance),
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

export function aggregateRuns(runs: ShotResult[]): MultiShotResult {
  const first = runs[0];
  return {
    capturedAt: new Date().toISOString(),
    runCount: runs.length,
    stackCount: first.stackCount,
    palletLayers: first.palletLayers,
    boxesPerStack: first.boxesPerStack,
    totalBoxes: first.totalBoxes,
    runs,
    aggregates: {
      baselineFps: stat(runs.map((r) => r.baselineFps)),
      avgFpsDuring: stat(runs.map((r) => r.avgFpsDuring)),
      finalFps: stat(runs.map((r) => r.finalFps)),
      totalMountMs: stat(runs.map((r) => r.totalMountMs)),
      finalP50Ms: stat(runs.map((r) => r.finalP50Ms)),
      finalP95Ms: stat(runs.map((r) => r.finalP95Ms)),
      finalP99Ms: stat(runs.map((r) => r.finalP99Ms)),
      finalMaxMs: stat(runs.map((r) => r.finalMaxMs)),
      heapDeltaMb: stat(runs.map((r) => r.heapDeltaMb)),
    },
  };
}
