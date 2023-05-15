import { Feature, Point } from 'geojson';

import { TrackSectionEntity } from '../../../../types';
import { CommonToolState } from '../commonToolState';

export type TrackEditionState = CommonToolState & {
  track: TrackSectionEntity;
  initialTrack: TrackSectionEntity;

  editionState:
    | { type: 'addPoint' }
    | { type: 'movePoint'; draggedPointIndex?: number; hoveredPointIndex?: number }
    | { type: 'deletePoint'; hoveredPointIndex?: number };

  // Anchoring state:
  anchorLinePoints: boolean;
  addNewPointsAtStart: boolean;
  nearestPoint: Feature<Point> | null;
};
