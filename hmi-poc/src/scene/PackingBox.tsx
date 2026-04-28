import { useMemo } from 'react';
import { createCardboardTexture } from '../utils/textures';

const W = 1.4;
const H = 0.9;
const D = 1.1;
const T = 0.05;

export function PackingBox() {
  const tex = useMemo(() => createCardboardTexture(), []);

  const mat = <meshStandardMaterial map={tex} roughness={0.85} metalness={0.0} />;

  return (
    <group position={[5.5, 0, 0]}>
      {/* Bottom */}
      <mesh position={[0, T / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[W, T, D]} />
        {mat}
      </mesh>

      {/* Front wall (−Z) */}
      <mesh position={[0, H / 2, -D / 2 + T / 2]} castShadow>
        <boxGeometry args={[W, H, T]} />
        {mat}
      </mesh>

      {/* Back wall (+Z) */}
      <mesh position={[0, H / 2, D / 2 - T / 2]} castShadow>
        <boxGeometry args={[W, H, T]} />
        {mat}
      </mesh>

      {/* Left wall (−X) */}
      <mesh position={[-W / 2 + T / 2, H / 2, 0]} castShadow>
        <boxGeometry args={[T, H, D]} />
        {mat}
      </mesh>

      {/* Right wall (+X) */}
      <mesh position={[W / 2 - T / 2, H / 2, 0]} castShadow>
        <boxGeometry args={[T, H, D]} />
        {mat}
      </mesh>
    </group>
  );
}
