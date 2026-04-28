import { useRef, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { generateLayout } from './pallet/demoLayout';
import { PalletMesh } from './pallet/PalletMesh';
import { BoxMesh } from './pallet/BoxMesh';
import { SlipsheetMesh } from './pallet/SlipsheetMesh';
import { useSceneStore } from '../stores/sceneStore';
import { TelemetrySampler } from './TelemetrySampler';
import { SceneTimer } from './SceneTimer';

const FOV = 35;

function PalletSceneContent() {
  const controlsRef = useRef<any>(null);
  const initialized = useRef(false);
  const palletLayers = useSceneStore((s) => s.palletLayers);
  const stackCount = useSceneStore((s) => s.stacks.length);

  const layout = useMemo(() => generateLayout(palletLayers), [palletLayers]);
  const { boxes, slipsheets, palletLength, palletWidth, slipsheetThickness } = layout;

  useEffect(() => {
    initialized.current = false;
  }, [palletLayers, stackCount]);

  const center = useMemo<[number, number, number]>(() => {
    const maxY = boxes.reduce((m, b) => Math.max(m, b.centerY + b.sizeY / 2), 0);
    return [palletLength / 2, maxY / 2, palletWidth / 2];
  }, [boxes, palletLength, palletWidth]);

  useFrame(({ camera }) => {
    if (initialized.current) return;
    initialized.current = true;

    const [cx, cy, cz] = center;
    const maxY = boxes.reduce((m, b) => Math.max(m, b.centerY + b.sizeY / 2), 0);
    const radius = Math.sqrt(
      (palletLength / 2) ** 2 + (maxY / 2) ** 2 + (palletWidth / 2) ** 2,
    );
    const vHalfFov = (FOV / 2) * (Math.PI / 180);
    const hHalfFov = Math.atan(Math.tan(vHalfFov) * (camera as THREE.PerspectiveCamera).aspect);
    const distance = radius / Math.sin(Math.min(vHalfFov, hHalfFov));
    const az = Math.PI / 4;
    const el = (36 * Math.PI) / 180;

    camera.position.set(
      cx + distance * Math.sin(az) * Math.cos(el),
      cy + distance * Math.sin(el),
      cz + distance * Math.cos(az) * Math.cos(el),
    );

    if (controlsRef.current) {
      controlsRef.current.target.set(cx, cy, cz);
      controlsRef.current.update();
    }
  });

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[2000, 3000, 1000]} intensity={0.8} />
      <directionalLight position={[-1000, 2000, -1500]} intensity={0.3} />

      <PalletMesh length={palletLength} width={palletWidth} />
      {slipsheets.map((s, i) => (
        <SlipsheetMesh
          key={i}
          slipsheet={s}
          length={palletLength}
          width={palletWidth}
          thickness={slipsheetThickness}
        />
      ))}
      {boxes.map((box) => (
        <BoxMesh key={box.id} box={box} />
      ))}

      <OrbitControls
        ref={controlsRef}
        target={center}
        enableZoom={false}
        enablePan={false}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 2.2}
      />
    </>
  );
}

interface PalletSceneProps {
  sceneId: string;
}

export function PalletScene({ sceneId }: PalletSceneProps) {
  return (
    <Canvas
      camera={{ fov: FOV, near: 1, far: 50000 }}
      style={{ background: '#1a1a2e', width: '100%', height: '100%', display: 'block' }}
    >
      <PalletSceneContent />
      <SceneTimer sceneId={sceneId} />
      <TelemetrySampler />
    </Canvas>
  );
}
