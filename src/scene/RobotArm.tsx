import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useSceneStore } from '../stores/sceneStore';

const METAL_DARK: React.ComponentProps<'meshStandardMaterial'> = { color: '#374151', metalness: 0.8, roughness: 0.2 };
const METAL_MID: React.ComponentProps<'meshStandardMaterial'> = { color: '#6b7280', metalness: 0.7, roughness: 0.3 };
const METAL_LIGHT: React.ComponentProps<'meshStandardMaterial'> = { color: '#9ca3af', metalness: 0.8, roughness: 0.15 };
const ACCENT: React.ComponentProps<'meshStandardMaterial'> = { color: '#f59e0b', metalness: 0.6, roughness: 0.4 };

export function RobotArm() {
  const robotRunning = useSceneStore((s) => s.robotRunning);

  const elapsed = useRef(0);
  const baseRef = useRef<THREE.Group>(null!);
  const shoulderRef = useRef<THREE.Group>(null!);
  const elbowRef = useRef<THREE.Group>(null!);
  const wristRef = useRef<THREE.Group>(null!);
  const wristTwistRef = useRef<THREE.Group>(null!);
  const gripperRef = useRef<THREE.Group>(null!);

  useFrame((_, delta) => {
    if (!robotRunning) return;
    elapsed.current += delta;
    const t = elapsed.current;

    baseRef.current.rotation.y = Math.sin(t * 0.5) * 0.7;
    shoulderRef.current.rotation.z = Math.sin(t * 0.4 + 0.5) * 0.35 - 0.2;
    elbowRef.current.rotation.z = Math.sin(t * 0.6 + 1.2) * 0.45 + 0.4;
    wristRef.current.rotation.z = Math.sin(t * 0.8 + 0.3) * 0.4;
    wristTwistRef.current.rotation.x = Math.sin(t * 1.3) * 0.5;
    gripperRef.current.rotation.y = Math.abs(Math.sin(t * 1.5)) * 0.25;
  });

  return (
    <group position={[-3.5, 0, 0]}>
      {/* Base plate */}
      <mesh position={[0, 0.05, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.5, 0.55, 0.1, 20]} />
        <meshStandardMaterial {...METAL_DARK} />
      </mesh>

      {/* Turret */}
      <mesh position={[0, 0.2, 0]} castShadow>
        <cylinderGeometry args={[0.3, 0.4, 0.2, 16]} />
        <meshStandardMaterial {...METAL_DARK} />
      </mesh>

      {/* Accent ring */}
      <mesh position={[0, 0.31, 0]}>
        <torusGeometry args={[0.32, 0.02, 8, 24]} />
        <meshStandardMaterial {...ACCENT} />
      </mesh>

      {/* Base Y-rotation group */}
      <group ref={baseRef} position={[0, 0.3, 0]}>
        {/* Base column */}
        <mesh position={[0, 0.2, 0]} castShadow>
          <cylinderGeometry args={[0.14, 0.16, 0.4, 12]} />
          <meshStandardMaterial {...METAL_MID} />
        </mesh>

        {/* Shoulder Z-rotation group */}
        <group position={[0, 0.4, 0]} ref={shoulderRef}>
          {/* Shoulder joint */}
          <mesh castShadow>
            <sphereGeometry args={[0.14, 10, 10]} />
            <meshStandardMaterial {...METAL_LIGHT} />
          </mesh>

          {/* Upper arm */}
          <mesh position={[0, 0.65, 0]} castShadow>
            <boxGeometry args={[0.11, 1.3, 0.11]} />
            <meshStandardMaterial {...METAL_MID} />
          </mesh>

          {/* Elbow Z-rotation group */}
          <group position={[0, 1.3, 0]} ref={elbowRef}>
            {/* Elbow joint */}
            <mesh castShadow>
              <sphereGeometry args={[0.1, 10, 10]} />
              <meshStandardMaterial {...METAL_LIGHT} />
            </mesh>

            {/* Forearm */}
            <mesh position={[0, 0.45, 0]} castShadow>
              <boxGeometry args={[0.09, 0.9, 0.09]} />
              <meshStandardMaterial {...METAL_MID} />
            </mesh>

            {/* Wrist Z-rotation group */}
            <group position={[0, 0.9, 0]} ref={wristRef}>
              {/* Wrist joint */}
              <mesh castShadow>
                <sphereGeometry args={[0.08, 8, 8]} />
                <meshStandardMaterial {...METAL_LIGHT} />
              </mesh>

              {/* Wrist X-twist group */}
              <group ref={wristTwistRef}>
                {/* Wrist segment */}
                <mesh position={[0, 0.2, 0]} castShadow>
                  <cylinderGeometry args={[0.055, 0.07, 0.4, 10]} />
                  <meshStandardMaterial {...METAL_MID} />
                </mesh>

                {/* Gripper Y-rotation group */}
                <group position={[0, 0.4, 0]} ref={gripperRef}>
                  {/* Gripper palm */}
                  <mesh castShadow>
                    <boxGeometry args={[0.24, 0.06, 0.1]} />
                    <meshStandardMaterial {...METAL_DARK} />
                  </mesh>
                  {/* Left finger */}
                  <mesh position={[-0.1, 0.12, 0]} castShadow>
                    <boxGeometry args={[0.05, 0.18, 0.06]} />
                    <meshStandardMaterial color="#d1d5db" metalness={0.7} roughness={0.25} />
                  </mesh>
                  {/* Right finger */}
                  <mesh position={[0.1, 0.12, 0]} castShadow>
                    <boxGeometry args={[0.05, 0.18, 0.06]} />
                    <meshStandardMaterial color="#d1d5db" metalness={0.7} roughness={0.25} />
                  </mesh>
                </group>
              </group>
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}
