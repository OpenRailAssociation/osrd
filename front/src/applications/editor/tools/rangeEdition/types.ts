import { Feature, LineString, Point, Position } from 'geojson';

import {
  EditorEntity,
  SpeedSectionEntity,
  SpeedSectionLpvEntity,
  TrackRange,
  TrackSectionEntity,
} from '../../../../types';
import { CommonToolState } from '../commonToolState';

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
    side: 'LEFT' | 'CENTER' | 'RIGHT';
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

export enum LPV_PANEL_TYPES {
  Z = 'z',
  R = 'r',
  ANNOUNCEMENT = 'announcement',
}
export type LPV_PANEL_TYPE = LPV_PANEL_TYPES.Z | LPV_PANEL_TYPES.R | LPV_PANEL_TYPES.ANNOUNCEMENT;

export type LpvPanelInformation =
  | { panelType: LPV_PANEL_TYPES.ANNOUNCEMENT | LPV_PANEL_TYPES.R; panelIndex: number }
  | { panelType: LPV_PANEL_TYPES.Z };

// export type SpeedSectionEditionState = CommonToolState & {
//   initialEntity: SpeedSectionEntity;
//   entity: SpeedSectionEntity;

//   trackSectionsCache: Record<string, TrackState>;

//   hoveredItem:
//     | null
//     | HoveredExtremityState
//     | HoveredRangeState
//     | HoveredPanelState
//     | (NonNullable<CommonToolState['hovered']> & { speedSectionItemType?: undefined });
//   interactionState:
//     | { type: 'idle' }
//     | { type: 'moveRangeExtremity'; rangeIndex: number; extremity: 'BEGIN' | 'END' }
//     | ({ type: 'movePanel' } & LpvPanelInformation);
// };

// export type SpeedSectionLpvEditionState = Omit<SpeedSectionEditionState, 'entity'> & {
//   entity: SpeedSectionLpvEntity;
// };

export type RangeEditionState<E extends EditorEntity> = CommonToolState & {
  initialEntity: E;
  entity: E;
  hoveredItem:
    | null
    | HoveredExtremityState
    | HoveredRangeState
    | HoveredPanelState
    | (NonNullable<CommonToolState['hovered']> & { speedSectionItemType?: undefined });
  interactionState:
    | { type: 'idle' }
    | { type: 'moveRangeExtremity'; rangeIndex: number; extremity: 'BEGIN' | 'END' }
    | ({ type: 'movePanel' } & LpvPanelInformation);
  trackSectionsCache: Record<string, TrackState>;
};
