interface SceneTiming {
  frameTimeMs: number;
  updatedAt: number;
}

const timings = new Map<string, SceneTiming>();

export function reportSceneTiming(sceneId: string, frameTimeMs: number) {
  timings.set(sceneId, { frameTimeMs, updatedAt: Date.now() });
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

export function removeSceneTiming(sceneId: string) {
  timings.delete(sceneId);
}
