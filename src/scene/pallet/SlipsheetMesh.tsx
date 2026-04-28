import { SLIPSHEET_COLOR } from './palletColors';
import type { SlipsheetPosition } from './palletTypes';

interface SlipsheetMeshProps {
  slipsheet: SlipsheetPosition;
  length: number;
  width: number;
  thickness: number;
}

export function SlipsheetMesh({ slipsheet, length, width, thickness }: SlipsheetMeshProps) {
  return (
    <mesh position={[length / 2, slipsheet.y, width / 2]}>
      <boxGeometry args={[length, thickness, width]} />
      <meshStandardMaterial
        color={SLIPSHEET_COLOR}
        polygonOffset
        polygonOffsetFactor={-1}
        polygonOffsetUnits={-1}
      />
    </mesh>
  );
}
