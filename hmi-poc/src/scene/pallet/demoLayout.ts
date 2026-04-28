import { PALLET_STRUCTURE_HEIGHT } from './palletGeometry';
import type { PositionedBox, StackedPalletLayout } from './palletTypes';

const BOX_HEIGHT = 150;

function buildLayer(index: number): PositionedBox[] {
  const boxes: PositionedBox[] = [];
  const y = PALLET_STRUCTURE_HEIGHT + index * BOX_HEIGHT + BOX_HEIGHT / 2;
  if (index % 2 === 0) {
    for (let col = 0; col < 4; col++) {
      for (let row = 0; row < 5; row++) {
        boxes.push({
          id: `l${index}-c${col}-r${row}`,
          centerX: 150 + col * 300,
          centerY: y,
          centerZ: 100 + row * 200,
          sizeX: 300,
          sizeY: BOX_HEIGHT,
          sizeZ: 200,
        });
      }
    }
  } else {
    for (let col = 0; col < 6; col++) {
      for (let row = 0; row < 3; row++) {
        boxes.push({
          id: `l${index}-c${col}-r${row}`,
          centerX: 100 + col * 200,
          centerY: y,
          centerZ: 150 + row * 300,
          sizeX: 200,
          sizeY: BOX_HEIGHT,
          sizeZ: 300,
        });
      }
    }
  }
  return boxes;
}

export function generateLayout(layerCount: number): StackedPalletLayout {
  const boxes: PositionedBox[] = [];
  for (let i = 0; i < layerCount; i++) {
    boxes.push(...buildLayer(i));
  }
  return {
    boxes,
    slipsheets: [],
    palletLength: 1200,
    palletWidth: 1000,
    slipsheetThickness: 5,
  };
}

export const DEMO_LAYOUT: StackedPalletLayout = generateLayout(3);
