import { Feature, Point } from 'geojson';

import { CommonToolState } from '../types';

export type LineCreationState = CommonToolState & {
  linePoints: [number, number][];
  anchorLinePoints: boolean;
  nearestPoint: Feature<Point> | null;
};
