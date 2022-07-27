import { Feature, Point } from 'geojson';

import { CommonToolState } from '../types';
import { TrackSectionEntity } from '../../../../types';

export type TrackEditionState = CommonToolState & {
  track: TrackSectionEntity;

  editionState:
    | { type: 'addPoint' }
    | { type: 'movePoint'; draggedPointIndex?: number; hoveredPointIndex?: number }
    | { type: 'deletePoint'; hoveredPointIndex?: number };

  // Anchoring state:
  anchorLinePoints: boolean;
  addNewPointsAtStart: boolean;
  nearestPoint: Feature<Point> | null;
};
