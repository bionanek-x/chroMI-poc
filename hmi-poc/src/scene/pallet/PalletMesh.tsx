import { useMemo } from 'react';
import { Edges } from '@react-three/drei';
import {
  DECK_THICKNESS,
  STRINGER_HEIGHT,
  SLAT_COUNT,
  STRINGER_COUNT,
  PALLET_STRUCTURE_HEIGHT,
} from './palletGeometry';
import { SLAT_COLOR, STRINGER_COLOR, PALLET_EDGE } from './palletColors';

interface Piece {
  pos: [number, number, number];
  size: [number, number, number];
  color: string;
}

interface PalletMeshProps {
  length: number;
  width: number;
}

export function PalletMesh({ length, width }: PalletMeshProps) {
  const pieces = useMemo<Piece[]>(() => {
    // Top deck slats: run in Z (width) direction, distributed across X (length)
    const slatSizeX = (length / SLAT_COUNT) * 0.75;
    const topSlats: Piece[] = Array.from({ length: SLAT_COUNT }, (_, i) => ({
      pos: [(i + 0.5) * length / SLAT_COUNT, PALLET_STRUCTURE_HEIGHT - DECK_THICKNESS / 2, width / 2],
      size: [slatSizeX, DECK_THICKNESS, width],
      color: SLAT_COLOR,
    }));

    // Stringers: run in X (length) direction, at STRINGER_COUNT Z positions
    const stringerSizeZ = width / (STRINGER_COUNT * 3);
    const stringerStep = (width - stringerSizeZ) / (STRINGER_COUNT - 1);
    const stringers: Piece[] = Array.from({ length: STRINGER_COUNT }, (_, i) => ({
      pos: [length / 2, DECK_THICKNESS + STRINGER_HEIGHT / 2, stringerSizeZ / 2 + i * stringerStep],
      size: [length, STRINGER_HEIGHT, stringerSizeZ],
      color: STRINGER_COLOR,
    }));

    // Bottom deck boards: run in Z direction, at 3 X positions
    const bottomSizeX = slatSizeX;
    const bottomPositions = [length * 0.1, length * 0.5, length * 0.9];
    const bottomBoards: Piece[] = bottomPositions.map((x) => ({
      pos: [x, DECK_THICKNESS / 2, width / 2],
      size: [bottomSizeX, DECK_THICKNESS, width],
      color: SLAT_COLOR,
    }));

    return [...topSlats, ...stringers, ...bottomBoards];
  }, [length, width]);

  return (
    <>
      {pieces.map((p, i) => (
        <mesh key={i} position={p.pos}>
          <boxGeometry args={p.size} />
          <meshStandardMaterial color={p.color} />
          <Edges color={PALLET_EDGE} />
        </mesh>
      ))}
    </>
  );
}
