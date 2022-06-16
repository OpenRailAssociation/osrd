import { Feature, Point } from 'geojson';

import { CommonToolState } from '../types';
import { TrackSectionEntity } from '../../../../types';

export type TrackEditionState = CommonToolState & {
  track: TrackSectionEntity;

  editionState:
    | {
        type: 'addPoint';
        addAtStart: boolean;
      }
    | { type: 'movePoint' }
    | { type: 'deletePoint' };

  // Anchoring state:
  anchorLinePoints: boolean;
  nearestPoint: Feature<Point> | null;
};
