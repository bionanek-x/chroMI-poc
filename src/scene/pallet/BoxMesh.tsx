import { Edges } from '@react-three/drei';
import { BOX_FILL, BOX_EDGE } from './palletColors';
import type { PositionedBox } from './palletTypes';

export function BoxMesh({ box }: { box: PositionedBox }) {
  return (
    <mesh position={[box.centerX, box.centerY, box.centerZ]}>
      <boxGeometry args={[box.sizeX, box.sizeY, box.sizeZ]} />
      <meshStandardMaterial color={BOX_FILL} />
      <Edges color={BOX_EDGE} />
    </mesh>
  );
}
