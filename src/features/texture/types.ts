export type Params = {
  density: number;
  baseSize: number;
  spacing: number;
  edgeMargin: number;
  sizeRandomness: number;
  baseAngle: number;
  rotationRandomness: number;
  rotationFullRandom: boolean;
  seed: number;
};

export type PlacedItem = {
  id: string;
  elementId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
};
