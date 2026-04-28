export interface PositionedBox {
  id: string;
  centerX: number;
  centerY: number;
  centerZ: number;
  sizeX: number;
  sizeY: number;
  sizeZ: number;
}

export interface SlipsheetPosition {
  y: number;
}

export interface StackedPalletLayout {
  boxes: PositionedBox[];
  slipsheets: SlipsheetPosition[];
  palletLength: number;
  palletWidth: number;
  slipsheetThickness: number;
}
