import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useSceneStore } from '../stores/sceneStore';
import { createBeltTexture } from '../utils/textures';

export function Conveyor() {
  const texture = useMemo(() => createBeltTexture(), []);
  const conveyorSpeed = useSceneStore((s) => s.conveyorSpeed);
  const robotRunning = useSceneStore((s) => s.robotRunning);

  useFrame((_, delta) => {
    if (!robotRunning) return;
    texture.offset.y -= conveyorSpeed * delta * 0.5;
  });

  return (
    <group>
      {/* Belt surface */}
      <mesh position={[0, -0.1, 0]} receiveShadow>
        <boxGeometry args={[14, 0.2, 2.2]} />
        <meshStandardMaterial map={texture} roughness={0.9} metalness={0.05} />
      </mesh>

      {/* Side rails */}
      <mesh position={[0, 0.05, 1.2]}>
        <boxGeometry args={[14, 0.3, 0.08]} />
        <meshStandardMaterial color="#374151" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.05, -1.2]}>
        <boxGeometry args={[14, 0.3, 0.08]} />
        <meshStandardMaterial color="#374151" metalness={0.7} roughness={0.3} />
      </mesh>

      {/* Support legs */}
      {[-5, 0, 5].map((x) => (
        <group key={x} position={[x, -0.6, 0]}>
          <mesh position={[0, 0, 1.0]}>
            <boxGeometry args={[0.1, 1.0, 0.1]} />
            <meshStandardMaterial color="#1f2937" metalness={0.8} roughness={0.2} />
          </mesh>
          <mesh position={[0, 0, -1.0]}>
            <boxGeometry args={[0.1, 1.0, 0.1]} />
            <meshStandardMaterial color="#1f2937" metalness={0.8} roughness={0.2} />
          </mesh>
          <mesh position={[0, -0.45, 0]}>
            <boxGeometry args={[0.1, 0.1, 2.2]} />
            <meshStandardMaterial color="#1f2937" metalness={0.8} roughness={0.2} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
