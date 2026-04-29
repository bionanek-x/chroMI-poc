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
  totalMountMs: number; // time from shot start to last stack stable
  settleMs: number;     // delay waited after last stack mounted before sampling finalFps
  stackMounts: StackMountRecord[];
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

  // Wait for the renderer to reach steady-state before sampling finalFps.
  setTimeout(() => {
    const finalFps = getAggregatedFps() ?? 0;
    const finalHeapMb = jsHeapMb();
    onComplete?.({
      ...partial,
      finalFps,
      finalHeapMb,
      heapDeltaMb: finalHeapMb - baselineHeapMb,
    });
  }, SETTLE_MS);
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
