import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useSceneStore } from '../stores/sceneStore';
import { reportSceneTiming, reportStableSceneTiming, removeSceneTiming } from '../stores/renderTimingStore';
import { notifyStackMounted } from '../hooks/useShotBenchmark';

// Frames sampled per measurement window. 60 frames ≈ 1 s at 60 fps — long enough
// for shader compilation and GPU buffer uploads to settle into steady state.
const MEASURE_FRAMES = 60;
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
  const fpsBuffer = useRef<number[]>([]);

  // Re-trigger measurement whenever layers change
  useEffect(() => {
    if (prevLayers.current !== null && prevLayers.current !== palletLayers) {
      measureCountdown.current = MEASURE_FRAMES;
      peakMs.current = 0;
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

    // Accumulate peak during measurement window
    if (measureCountdown.current > 0) {
      peakMs.current = Math.max(peakMs.current, ms);
      measureCountdown.current--;
      if (measureCountdown.current === 0) {
        reportStableSceneTiming(sceneId, peakMs.current);
        notifyStackMounted(sceneId, peakMs.current);
      }
    }
  });

  useEffect(() => {
    return () => removeSceneTiming(sceneId);
  }, [sceneId]);

  return null;
}
