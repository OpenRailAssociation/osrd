import type { MultiLineString } from '@turf/helpers';
import type { Feature, LineString, Point, Position } from 'geojson';

import type { TrackRange, TrackSectionEntity } from 'applications/editor/tools/trackEdition/types';
import type { CommonToolState } from 'applications/editor/tools/types';
import type { EditorEntity } from 'applications/editor/typesEditorEntity';

import type { APPLICABLE_DIRECTIONS } from './consts';
import type { EditorRange } from './tool-factory';
import type { OptionsStateType } from '../routeEdition/types';

export type ApplicableDirection = (typeof APPLICABLE_DIRECTIONS)[number];
export type PSLSign = {
  position: number;
  side: 'LEFT' | 'RIGHT' | 'CENTER';
  direction: 'START_TO_STOP' | 'STOP_TO_START';
  track: string;
  type: string;
  value: string;
  kp: string;
};

export type PSLExtension = {
  announcement: PSLSign[];
  z: PSLSign;
  r: PSLSign[];
};

export type ApplicableTrackRange = {
  applicable_directions: ApplicableDirection;
  begin: number;
  end: number;
  track: string;
};

export type RouteElements = {
  [key: string]: {
    trackRanges: ApplicableTrackRange[];
    track_nodes: string[];
  };
};

export type RouteExtra = {
  [key: string]: ApplicableTrackRange;
};

export type SpeedSectionEntity = EditorEntity<
  MultiLineString,
  {
    speed_limit?: number;
    speed_limit_by_tag?: Record<string, number | undefined>;
    track_ranges?: ApplicableTrackRange[];
    extensions?: {
      psl_sncf: null | PSLExtension;
    };
    on_routes?: string[];
  }
> & {
  objType: 'SpeedSection';
};

export type ElectrificationEntity = EditorEntity<
  MultiLineString,
  {
    id: string;
    track_ranges?: ApplicableTrackRange[];
    voltage?: string;
  }
> & {
  objType: 'Electrification';
};

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

// PSL types

export type SpeedSectionPslEntity = EditorEntity<
  MultiLineString,
  Omit<SpeedSectionEntity['properties'], 'extensions'> & { extensions: { psl_sncf: PSLExtension } }
> & {
  objType: 'SpeedSection';
};

export enum PSL_SIGN_TYPES {
  Z = 'z',
  R = 'r',
  ANNOUNCEMENT = 'announcement',
}
export type PSL_SIGN_TYPE = PSL_SIGN_TYPES.Z | PSL_SIGN_TYPES.R | PSL_SIGN_TYPES.ANNOUNCEMENT;

export type PslSignInformation =
  | { signType: PSL_SIGN_TYPES.ANNOUNCEMENT | PSL_SIGN_TYPES.R; signIndex: number }
  | { signType: PSL_SIGN_TYPES.Z };

export type HoveredItem =
  | null
  | HoveredExtremityState
  | HoveredRangeState
  | HoveredSignState
  | (NonNullable<CommonToolState['hovered']> & { itemType?: undefined });

export type InteractionState =
  | { type: 'idle' }
  | { type: 'moveRangeExtremity'; rangeIndex: number; extremity: 'BEGIN' | 'END' }
  | ({ type: 'moveSign' } & PslSignInformation)
  | { type: 'selectTrackNode' };

export type RangeEditionState<E extends EditorRange> = CommonToolState & {
  error?: string;
  initialEntity: E;
  entity: E;
  hoveredItem: HoveredItem;
  interactionState: InteractionState;
  trackSectionsCache: Record<string, TrackState>;
  selectedTrackNodes: TrackNodeSelection;
  optionsState?: OptionsStateType;
  highlightedRoutes: string[];
  routeElements: RouteElements;
  routeExtra?: RouteExtra;
};

export type TrackNodePosition = {
  [key: string]: string | null;
};

export type AvailableTrackNodePositions = {
  [key: string]: string[];
};

export type TrackNodeSelection = {
  [key: string]: {
    position: string | null;
    type: string;
  };
};
