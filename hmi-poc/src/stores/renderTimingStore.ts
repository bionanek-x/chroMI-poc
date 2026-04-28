interface SceneTiming {
  frameTimeMs: number;   // live, updated every frame — used for CSV
  stableMs: number;      // peak measured after last scene change — used for display
  updatedAt: number;
}

const timings = new Map<string, SceneTiming>();

export function reportSceneTiming(sceneId: string, frameTimeMs: number) {
  const existing = timings.get(sceneId);
  timings.set(sceneId, {
    frameTimeMs,
    stableMs: existing?.stableMs ?? 0,
    updatedAt: Date.now(),
  });
}

export function reportStableSceneTiming(sceneId: string, stableMs: number) {
  const existing = timings.get(sceneId);
  timings.set(sceneId, {
    frameTimeMs: existing?.frameTimeMs ?? stableMs,
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

export function removeSceneTiming(sceneId: string) {
  timings.delete(sceneId);
}
