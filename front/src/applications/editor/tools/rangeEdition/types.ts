import { Feature, LineString, Point, Position } from 'geojson';

import { EditorEntity, TrackRange, TrackSectionEntity } from 'types';
import { CommonToolState } from '../commonToolState';

export type TrackRangeFeature = Feature<
  LineString,
  Pick<TrackRange, 'begin' | 'end' | 'track'> & {
    id: string;
    itemType: 'TrackRange';
    rangeIndex: number;
  }
>;
export type TrackRangeExtremityFeature = Feature<
  Point,
  {
    id: string;
    track: string;
    extremity: 'BEGIN' | 'END';
    itemType: 'TrackRangeExtremity';
    rangeIndex: number;
  }
>;
export type PslSignFeature = Feature<
  Point,
  {
    angle: number;
    position: number;
    side: 'LEFT' | 'CENTER' | 'RIGHT';
    track: string;
    type: string;
    value: string | null;
    itemType: 'PSLSign';
    signIndex: number;
    signType: PSL_SIGN_TYPE;
  }
>;

export type HoveredExtremityState = {
  itemType: 'TrackRangeExtremity';
  track: TrackSectionEntity;
  extremity: 'BEGIN' | 'END';
  position: Position;
  // (trick to help dealing with heterogeneous types)
  type?: undefined;
  id?: undefined;
};
export type HoveredRangeState = {
  itemType: 'TrackRange';
  track: TrackSectionEntity;
  position: Position;
  // (trick to help dealing with heterogeneous types)
  type?: undefined;
  id?: undefined;
};
export type HoveredSignState = {
  itemType: 'PSLSign';
  track: TrackSectionEntity;
  position: Position;
  signIndex: number;
  signType: string;
  // (trick to help dealing with heterogeneous types)
  type?: undefined;
  id?: undefined;
};

export type TrackState =
  | { type: 'loading' }
  | { type: 'error' }
  | { type: 'success'; track: TrackSectionEntity };

export enum PSL_SIGN_TYPES {
  Z = 'z',
  R = 'r',
  ANNOUNCEMENT = 'announcement',
}
export type PSL_SIGN_TYPE = PSL_SIGN_TYPES.Z | PSL_SIGN_TYPES.R | PSL_SIGN_TYPES.ANNOUNCEMENT;

export type PslSignInformation =
  | { signType: PSL_SIGN_TYPES.ANNOUNCEMENT | PSL_SIGN_TYPES.R; signIndex: number }
  | { signType: PSL_SIGN_TYPES.Z };

export type RangeEditionState<E extends EditorEntity> = CommonToolState & {
  initialEntity: E;
  entity: E;
  hoveredItem:
    | null
    | HoveredExtremityState
    | HoveredRangeState
    | HoveredSignState
    | (NonNullable<CommonToolState['hovered']> & { itemType?: undefined });
  interactionState:
    | { type: 'idle' }
    | { type: 'moveRangeExtremity'; rangeIndex: number; extremity: 'BEGIN' | 'END' }
    | ({ type: 'moveSign' } & PslSignInformation);
  trackSectionsCache: Record<string, TrackState>;
};
