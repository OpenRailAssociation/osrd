import { Position } from 'geojson';

import { CommonToolState } from '../types';
import { SpeedSectionEntity, TrackSectionEntity } from '../../../../types';

export type TrackState =
  | { type: 'loading' }
  | { type: 'error' }
  | { type: 'success'; track: TrackSectionEntity };

export type SpeedSectionEditionState = CommonToolState & {
  initialEntity: SpeedSectionEntity;
  entity: SpeedSectionEntity;

  trackSectionsCache: Record<string, TrackState>;

  hoveredPoint: null | {
    track: TrackSectionEntity;
    extremity: 'BEGIN' | 'END';
    position: Position;
  };
  interactionState:
    | { type: 'idle' }
    | { type: 'movePoint'; rangeIndex: number; extremity: 'BEGIN' | 'END' }
    | { type: 'addTrackSection' };
};
