import { Feature, LineString, Position } from 'geojson';

import { CommonToolState } from '../types';
import { Direction, EndPoint, RouteEntity, WayPoint, WayPointEntity } from '../../../../types';
import { DirectionalTrackRange } from '../../../../common/api/osrdEditoastApi';

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

export type EditRouteState = CommonToolState & {
  type: 'editRoute';
  initialRouteEntity: RouteEntity;
  routeEntity: RouteEntity;
};
export type CreateRouteState = CommonToolState & {
  type: 'createRoute';
  routeState: RouteState;
  optionsState:
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
  extremityEditionState:
    | { type: 'idle' }
    | {
        type: 'selection';
        extremity: EndPoint;
        onSelect: (track: WayPointEntity) => void;
        hoveredPoint: WayPointEntity | null;
      };
};

export type RouteEditionState = EditRouteState | CreateRouteState;
