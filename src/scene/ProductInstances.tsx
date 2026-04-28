import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useSceneStore } from '../stores/sceneStore';

interface ProductData {
  x: number;
  z: number;
  rotY: number;
  phase: number;
  freq: number;
}

const dummy = new THREE.Object3D();

export function ProductInstances() {
  const productCount = useSceneStore((s) => s.productCount);
  const robotRunning = useSceneStore((s) => s.robotRunning);
  const ref = useRef<THREE.InstancedMesh>(null!);

  const products = useMemo<ProductData[]>(
    () =>
      Array.from({ length: productCount }, () => ({
        x: (Math.random() - 0.5) * 11,
        z: (Math.random() - 0.5) * 1.6,
        rotY: Math.random() * Math.PI * 2,
        phase: Math.random() * Math.PI * 2,
        freq: 0.4 + Math.random() * 0.8,
      })),
    [productCount],
  );

  useEffect(() => {
    if (!ref.current) return;
    products.forEach((p, i) => {
      dummy.position.set(p.x, 0.15, p.z);
      dummy.rotation.set(0, p.rotY, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      ref.current.setMatrixAt(i, dummy.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  }, [products]);

  useFrame(({ clock }) => {
    if (!ref.current || !robotRunning) return;
    const t = clock.getElapsedTime();
    products.forEach((p, i) => {
      dummy.position.set(
        p.x,
        0.15 + Math.sin(t * p.freq + p.phase) * 0.025,
        p.z,
      );
      dummy.rotation.set(0, p.rotY + t * 0.15, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      ref.current.setMatrixAt(i, dummy.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh key={productCount} ref={ref} args={[undefined, undefined, productCount]} castShadow receiveShadow>
      <boxGeometry args={[0.28, 0.28, 0.28]} />
      <meshStandardMaterial color="#4f46e5" metalness={0.3} roughness={0.55} />
    </instancedMesh>
  );
}
