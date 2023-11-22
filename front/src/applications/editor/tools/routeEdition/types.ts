import { Feature, LineString, Position } from 'geojson';

import { Direction, EndPoint, RouteEntity, WayPoint, WayPointEntity } from 'types';
import { DirectionalTrackRange } from 'common/api/osrdEditoastApi';
import { CommonToolState } from 'applications/editor/tools/commonToolState';

export interface RouteCandidate {
  track_ranges: Required<DirectionalTrackRange>[];
  detectors: string[];
  switches_directions: Record<string, string>;
}

export interface RouteState {
  entryPoint: (WayPoint & { position: Position }) | null;
  entryPointDirection: Direction;
  exitPoint: (WayPoint & { position: Position }) | null;
}

export enum EndPointKeys {
  BEGIN = 'entryPoint',
  END = 'exitPoint',
}

export type EditRouteMetadataState = CommonToolState & {
  type: 'editRouteMetadata';
  initialRouteEntity: RouteEntity;
  routeEntity: RouteEntity;
};

export type OptionsStateType =
  | { type: 'idle'; options?: undefined }
  | { type: 'loading'; options?: undefined }
  | {
      type: 'options';
      focusedOptionIndex?: number | undefined;
      options: {
        data: RouteCandidate;
        color: string;
        feature: Feature<LineString, { index: number; color: string }>;
      }[];
    };

export type EditRoutePathState = CommonToolState & {
  type: 'editRoutePath';
  initialRouteEntity?: RouteEntity;
  routeState: RouteState;
  optionsState: OptionsStateType;
  extremityEditionState:
    | { type: 'idle' }
    | {
        type: 'selection';
        extremity: EndPoint;
        onSelect: (track: WayPointEntity) => void;
        hoveredPoint: WayPointEntity | null;
      };
};

export type RouteEditionState = EditRouteMetadataState | EditRoutePathState;
