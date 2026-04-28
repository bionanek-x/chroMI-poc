import { Environment } from '@react-three/drei';

interface Props {
  shadowMapSize: number;
}

export function SceneLighting({ shadowMapSize }: Props) {
  return (
    <>
      <Environment preset="warehouse" />
      <ambientLight intensity={0.3} />
      {shadowMapSize > 0 ? (
        <directionalLight
          castShadow
          position={[10, 20, 10]}
          intensity={1.5}
          shadow-mapSize={[shadowMapSize, shadowMapSize]}
          shadow-camera-near={0.1}
          shadow-camera-far={60}
          shadow-camera-left={-10}
          shadow-camera-right={10}
          shadow-camera-top={8}
          shadow-camera-bottom={-8}
        />
      ) : (
        <directionalLight position={[10, 20, 10]} intensity={1.5} />
      )}
    </>
  );
}
