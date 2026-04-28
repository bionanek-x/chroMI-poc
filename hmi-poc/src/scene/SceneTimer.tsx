import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useSceneStore } from '../stores/sceneStore';
import { reportSceneTiming, reportStableSceneTiming, removeSceneTiming } from '../stores/renderTimingStore';
import { notifyStackMounted } from '../hooks/useShotBenchmark';

// How many frames to sample when measuring after a scene change.
// We take the peak because the first couple of frames after a geometry
// rebuild are the most expensive ones.
const MEASURE_FRAMES = 5;

interface Props {
  sceneId: string;
}

export function SceneTimer({ sceneId }: Props) {
  const palletLayers = useSceneStore((s) => s.palletLayers);
  const prevLayers = useRef<number | null>(null);
  const measureCountdown = useRef(MEASURE_FRAMES); // start measuring immediately on mount
  const peakMs = useRef(0);

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

    // Always report live frame time for CSV sampling
    reportSceneTiming(sceneId, ms);

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
