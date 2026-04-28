import { useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { reportSceneTiming, removeSceneTiming } from '../stores/renderTimingStore';

interface Props {
  sceneId: string;
}

export function SceneTimer({ sceneId }: Props) {
  useFrame((_, delta) => {
    // delta = seconds since last frame for this specific canvas
    reportSceneTiming(sceneId, delta * 1000);
  });

  useEffect(() => {
    return () => removeSceneTiming(sceneId);
  }, [sceneId]);

  return null;
}
