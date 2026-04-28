import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useSceneStore } from '../stores/sceneStore';
import { reportSceneTiming, reportStableSceneTiming, removeSceneTiming } from '../stores/renderTimingStore';
import { notifyStackMounted } from '../hooks/useShotBenchmark';

// Frames to wait before considering the scene settled. 3 frames is enough to
// capture initial shader compilation and GPU buffer uploads without inflating
// the measurement by competing canvases reducing per-canvas frame rate.
const MEASURE_FRAMES = 3;
// Rolling window for per-canvas FPS smoothing (≈ 0.5 s at 60 fps).
const FPS_BUFFER_SIZE = 30;

interface Props {
  sceneId: string;
}

export function SceneTimer({ sceneId }: Props) {
  const palletLayers = useSceneStore((s) => s.palletLayers);
  const prevLayers = useRef<number | null>(null);
  const measureCountdown = useRef(MEASURE_FRAMES); // start measuring immediately on mount
  const peakMs = useRef(0);
  // Capture start time at mount/remount, not inside useFrame, so competing
  // canvases don't inflate the reading by delaying the first frame callback.
  const mountStartMs = useRef(performance.now());
  const fpsBuffer = useRef<number[]>([]);

  // Re-trigger measurement whenever layers change
  useEffect(() => {
    if (prevLayers.current !== null && prevLayers.current !== palletLayers) {
      measureCountdown.current = MEASURE_FRAMES;
      peakMs.current = 0;
      mountStartMs.current = performance.now();
    }
    prevLayers.current = palletLayers;
  }, [palletLayers]);

  useFrame((_, delta) => {
    const ms = delta * 1000;

    // Per-canvas rolling FPS — keeps each canvas's reading independent of the
    // r3f-perf global singleton, which only reflects the last canvas to update.
    if (delta > 0) fpsBuffer.current.push(1 / delta);
    if (fpsBuffer.current.length > FPS_BUFFER_SIZE) fpsBuffer.current.shift();
    const fps = fpsBuffer.current.length > 0
      ? fpsBuffer.current.reduce((a, b) => a + b, 0) / fpsBuffer.current.length
      : 0;

    reportSceneTiming(sceneId, ms, fps);

    // Accumulate peak during measurement window and record total wall-clock time
    // from mount/remount trigger to settled state.
    if (measureCountdown.current > 0) {
      peakMs.current = Math.max(peakMs.current, ms);
      measureCountdown.current--;
      if (measureCountdown.current === 0) {
        const totalMountMs = performance.now() - mountStartMs.current;
        reportStableSceneTiming(sceneId, totalMountMs);
        notifyStackMounted(sceneId, peakMs.current);
      }
    }
  });

  useEffect(() => {
    return () => removeSceneTiming(sceneId);
  }, [sceneId]);

  return null;
}
