import { Feature, LineString, Point, Position } from 'geojson';

import { CommonToolState } from '../types';
import { LPVPanel, SpeedSectionEntity, TrackRange, TrackSectionEntity } from '../../../../types';

export type TrackRangeFeature = Feature<
  LineString,
  Pick<TrackRange, 'begin' | 'end' | 'track'> & {
    id: string;
    speedSectionItemType: 'TrackRange';
    speedSectionRangeIndex: number;
  }
>;
export type TrackRangeExtremityFeature = Feature<
  Point,
  {
    id: string;
    track: string;
    extremity: 'BEGIN' | 'END';
    speedSectionItemType: 'TrackRangeExtremity';
    speedSectionRangeIndex: number;
  }
>;
export type HoveredExtremityState = {
  speedSectionItemType: 'TrackRangeExtremity';
  track: TrackSectionEntity;
  extremity: 'BEGIN' | 'END';
  position: Position;
  // (trick to help dealing with heterogeneous types)
  type?: undefined;
  id?: undefined;
};
export type HoveredRangeState = {
  speedSectionItemType: 'TrackRange';
  track: TrackSectionEntity;
  position: Position;
  // (trick to help dealing with heterogeneous types)
  type?: undefined;
  id?: undefined;
};
export type HoveredPanelState = {
  speedSectionItemType: 'LPVPanel';
  track: TrackSectionEntity;
  position: Position;
  panelIndex: number;
  panelType: string;
  // (trick to help dealing with heterogeneous types)
  type?: undefined;
  id?: undefined;
};

export type TrackState =
  | { type: 'loading' }
  | { type: 'error' }
  | { type: 'success'; track: TrackSectionEntity };

export type SpeedSectionEditionState = CommonToolState & {
  initialEntity: SpeedSectionEntity;
  entity: SpeedSectionEntity;

  trackSectionsCache: Record<string, TrackState>;

  hoveredItem:
    | null
    | HoveredExtremityState
    | HoveredRangeState
    | HoveredPanelState
    | (NonNullable<CommonToolState['hovered']> & { speedSectionItemType?: undefined });
  interactionState:
    | { type: 'idle' }
    | { type: 'moveRangeExtremity'; rangeIndex: number; extremity: 'BEGIN' | 'END' }
    | ({ type: 'movePanel' } & (
        | { panelType: 'announcement' | 'r'; panelIndex: number }
        | { panelType: 'z' }
      ));
};
