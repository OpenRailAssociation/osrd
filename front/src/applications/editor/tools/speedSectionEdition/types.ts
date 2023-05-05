import { Feature, LineString, Point, Position } from 'geojson';

import { CommonToolState } from '../types';
import {
  SpeedSectionEntity,
  SpeedSectionLpvEntity,
  TrackRange,
  TrackSectionEntity,
} from '../../../../types';

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
export type LpvPanelFeature = Feature<
  Point,
  {
    angle_sch: number;
    angle_geo: number;
    position: number;
    side: 'LEFT' | 'RIGHT';
    track: string;
    type: string;
    value: string | null;
    speedSectionItemType: 'LPVPanel';
    speedSectionPanelIndex: number;
    speedSectionPanelType: LPV_PANEL_TYPE;
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

const TYPE_Z = 'z';
const TYPE_R = 'r';
const TYPE_ANNOUNCEMENT = 'annoucement';
export enum LPV_PANEL_TYPES {
  Z = TYPE_Z,
  R = TYPE_R,
  ANNOUNCEMENT = TYPE_ANNOUNCEMENT,
}
export type LPV_PANEL_TYPE = typeof TYPE_Z | typeof TYPE_R | typeof TYPE_ANNOUNCEMENT;

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
        | { panelType: LPV_PANEL_TYPES.ANNOUNCEMENT | LPV_PANEL_TYPES.R; panelIndex: number }
        | { panelType: LPV_PANEL_TYPES.Z }
      ));
};

export type SpeedSectionLpvEditionState = Omit<SpeedSectionEditionState, 'entity'> & {
  entity: SpeedSectionLpvEntity;
};
