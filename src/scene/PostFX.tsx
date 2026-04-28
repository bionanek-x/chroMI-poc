import { EffectComposer, Bloom, SMAA } from '@react-three/postprocessing';
import type { PostFXMode } from '../stores/sceneStore';

interface Props {
  mode: PostFXMode;
}

export function PostFX({ mode }: Props) {
  if (mode === 'none') return null;
  return (
    <EffectComposer>
      <Bloom luminanceThreshold={0.8} intensity={0.4} />
      <SMAA />
    </EffectComposer>
  );
}
