interface SceneTiming {
  frameTimeMs: number;   // live inter-frame time, updated every frame — used for CSV
  fps: number;           // rolling average FPS — used for CSV and shot benchmark
  stableMs: number;      // peak frame time after last scene change — used for display
  updatedAt: number;
}

const timings = new Map<string, SceneTiming>();

export function reportSceneTiming(sceneId: string, frameTimeMs: number, fps: number) {
  const existing = timings.get(sceneId);
  timings.set(sceneId, {
    frameTimeMs,
    fps,
    stableMs: existing?.stableMs ?? 0,
    updatedAt: Date.now(),
  });
}

export function reportStableSceneTiming(sceneId: string, stableMs: number) {
  const existing = timings.get(sceneId);
  timings.set(sceneId, {
    frameTimeMs: existing?.frameTimeMs ?? stableMs,
    fps: existing?.fps ?? 0,
    stableMs,
    updatedAt: Date.now(),
  });
}

// Returns only timings updated within the last 2 s (handles removed scenes)
export function getActiveSceneTimings(): Map<string, number> {
  const now = Date.now();
  const result = new Map<string, number>();
  timings.forEach((t, id) => {
    if (now - t.updatedAt < 2000) result.set(id, t.frameTimeMs);
  });
  return result;
}

export function getStableSceneTimings(): Map<string, number> {
  const now = Date.now();
  const result = new Map<string, number>();
  timings.forEach((t, id) => {
    if (now - t.updatedAt < 2000) result.set(id, t.stableMs);
  });
  return result;
}

// Min FPS across all active canvases — worst-case reading when multiple canvases
// compete for the same GPU. Returns null if no canvas has reported within 2 s.
export function getAggregatedFps(): number | null {
  const now = Date.now();
  const values: number[] = [];
  timings.forEach((t) => {
    if (now - t.updatedAt < 2000) values.push(t.fps);
  });
  return values.length > 0 ? Math.min(...values) : null;
}

// Max inter-frame time across all active canvases — most expensive canvas wins.
export function getWorstCaseFrameTime(): number {
  const now = Date.now();
  let worst = 0;
  timings.forEach((t) => {
    if (now - t.updatedAt < 2000) worst = Math.max(worst, t.frameTimeMs);
  });
  return worst;
}

export function removeSceneTiming(sceneId: string) {
  timings.delete(sceneId);
}
