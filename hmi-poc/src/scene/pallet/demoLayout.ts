import { PALLET_STRUCTURE_HEIGHT } from './palletGeometry';
import type { PositionedBox, StackedPalletLayout } from './palletTypes';

const BOX_HEIGHT = 150;

const layer0: PositionedBox[] = [];
for (let col = 0; col < 4; col++) {
  for (let row = 0; row < 5; row++) {
    layer0.push({
      id: `l0-c${col}-r${row}`,
      centerX: 150 + col * 300,
      centerY: PALLET_STRUCTURE_HEIGHT + BOX_HEIGHT / 2,
      centerZ: 100 + row * 200,
      sizeX: 300,
      sizeY: BOX_HEIGHT,
      sizeZ: 200,
    });
  }
}

const layer1: PositionedBox[] = [];
for (let col = 0; col < 6; col++) {
  for (let row = 0; row < 3; row++) {
    layer1.push({
      id: `l1-c${col}-r${row}`,
      centerX: 100 + col * 200,
      centerY: PALLET_STRUCTURE_HEIGHT + BOX_HEIGHT + BOX_HEIGHT / 2,
      centerZ: 150 + row * 300,
      sizeX: 200,
      sizeY: BOX_HEIGHT,
      sizeZ: 300,
    });
  }
}

const layer2: PositionedBox[] = [];
for (let col = 0; col < 4; col++) {
  for (let row = 0; row < 5; row++) {
    layer2.push({
      id: `l2-c${col}-r${row}`,
      centerX: 150 + col * 300,
      centerY: PALLET_STRUCTURE_HEIGHT + 2 * BOX_HEIGHT + BOX_HEIGHT / 2,
      centerZ: 100 + row * 200,
      sizeX: 300,
      sizeY: BOX_HEIGHT,
      sizeZ: 200,
    });
  }
}

export const DEMO_LAYOUT: StackedPalletLayout = {
  boxes: [...layer0, ...layer1, ...layer2],
  slipsheets: [],
  palletLength: 1200,
  palletWidth: 1000,
  slipsheetThickness: 5,
};
