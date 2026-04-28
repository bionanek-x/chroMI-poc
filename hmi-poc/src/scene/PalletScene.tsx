import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { DEMO_LAYOUT } from './pallet/demoLayout';
import { PalletMesh } from './pallet/PalletMesh';
import { BoxMesh } from './pallet/BoxMesh';
import { SlipsheetMesh } from './pallet/SlipsheetMesh';
import { HUD } from '../components/HUD';
import { KeyboardOverlay } from '../components/KeyboardOverlay';

const FOV = 35;

function PalletSceneContent() {
  const controlsRef = useRef<any>(null);
  const initialized = useRef(false);

  const { boxes, slipsheets, palletLength, palletWidth, slipsheetThickness } = DEMO_LAYOUT;

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
    const distance = radius / Math.sin(((FOV / 2) * Math.PI) / 180);
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

export function PalletScene() {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Canvas
        camera={{ fov: FOV, near: 1, far: 50000 }}
        style={{ background: '#1a1a2e' }}
      >
        <PalletSceneContent />
      </Canvas>
      <HUD />
      <KeyboardOverlay />
    </div>
  );
}
