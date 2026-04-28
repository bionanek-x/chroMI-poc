import { useEffect, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Perf } from 'r3f-perf';
import { Leva, useControls } from 'leva';
import { useSceneStore } from '../stores/sceneStore';
import { SceneLighting } from './SceneLighting';
import { Conveyor } from './Conveyor';
import { ProductInstances } from './ProductInstances';
import { RobotArm } from './RobotArm';
import { PackingBox } from './PackingBox';
import { PostFX } from './PostFX';
import { TelemetrySampler } from './TelemetrySampler';
import { HUD } from '../components/HUD';
import { KeyboardOverlay } from '../components/KeyboardOverlay';

const isDebug = new URLSearchParams(window.location.search).get('debug') === '1';
const isPerfOverlay = new URLSearchParams(window.location.search).get('perf') === '1';

function FpsTracker() {
  const frames = useRef(0);
  const lastTime = useRef(performance.now());
  const setFps = useSceneStore((s) => s.setFps);

  useFrame(() => {
    frames.current++;
    const now = performance.now();
    if (now - lastTime.current >= 200) {
      setFps(frames.current / ((now - lastTime.current) / 1000));
      frames.current = 0;
      lastTime.current = now;
    }
  });
  return null;
}

function DebugControls() {
  const setParam = useSceneStore((s) => s.setParam);
  useControls('Scene', {
    productCount: {
      value: 30, min: 1, max: 500, step: 1,
      onChange: (v: number) => setParam('productCount', v),
    },
    shadowMapSize: {
      value: 1024,
      options: { None: 0, '512': 512, '1024': 1024, '2048': 2048 },
      onChange: (v: number) => setParam('shadowMapSize', v as 0 | 512 | 1024 | 2048),
    },
    pixelRatio: {
      value: 1.0, min: 0.5, max: 2.0, step: 0.25,
      onChange: (v: number) => setParam('pixelRatio', v),
    },
    postFX: {
      value: 'none',
      options: ['none', 'bloom'],
      onChange: (v: string) => setParam('postFX', v as 'none' | 'bloom' | 'bloom+ssao'),
    },
    materialQuality: {
      value: 'standard',
      options: ['basic', 'standard', 'physical'],
      onChange: (v: string) => setParam('materialQuality', v as 'basic' | 'standard' | 'physical'),
    },
    conveyorSpeed: {
      value: 1.0, min: 0, max: 3, step: 0.1,
      onChange: (v: number) => setParam('conveyorSpeed', v),
    },
  });
  return null;
}

function SceneFloor() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.1, 0]} receiveShadow>
      <planeGeometry args={[40, 30]} />
      <meshStandardMaterial color="#111827" roughness={0.9} metalness={0.1} />
    </mesh>
  );
}

export function PackagingScene() {
  const shadowMapSize = useSceneStore((s) => s.shadowMapSize);
  const pixelRatio = useSceneStore((s) => s.pixelRatio);
  const postFX = useSceneStore((s) => s.postFX);
  const frameloop = useSceneStore((s) => s.frameloop);

  // Long-task observer for dev diagnostics
  useEffect(() => {
    if (!('PerformanceObserver' in window)) return;
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.duration > 50) {
          console.warn('[LongTask]', entry.duration.toFixed(1), 'ms', entry);
        }
      }
    });
    try { observer.observe({ entryTypes: ['longtask'] }); } catch { /* not all browsers */ }
    return () => observer.disconnect();
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Leva hidden={!isDebug} />

      <Canvas
        key={frameloop}
        shadows={shadowMapSize > 0}
        dpr={pixelRatio}
        frameloop={frameloop}
        camera={{ position: [0, 6, 14], fov: 50, near: 0.1, far: 200 }}
        style={{ background: '#0a0a0f' }}
      >
        {isPerfOverlay && <Perf position="top-right" deepAnalyze matrixUpdate showGraph />}
        <TelemetrySampler />
        <FpsTracker />
        {isDebug && <DebugControls />}

        <SceneFloor />
        <SceneLighting shadowMapSize={shadowMapSize} />
        <Conveyor />
        <ProductInstances />
        <RobotArm />
        <PackingBox />
        <PostFX mode={postFX} />

        <OrbitControls
          makeDefault
          minDistance={4}
          maxDistance={30}
          maxPolarAngle={Math.PI / 2.2}
          enableDamping
          dampingFactor={0.08}
        />
      </Canvas>

      <HUD />
      <KeyboardOverlay />
    </div>
  );
}
