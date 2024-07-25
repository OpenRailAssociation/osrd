import type { Feature, LineString, Point } from 'geojson';

import type {
  BufferStopEntity,
  DetectorEntity,
} from 'applications/editor/tools/pointEdition/types';
import type { EndPoint } from 'applications/editor/tools/trackNodeEdition/types';
import type { CommonToolState } from 'applications/editor/tools/types';
import type { EditorEntity } from 'applications/editor/typesEditorEntity';
import type { Direction, DirectionalTrackRange } from 'common/api/osrdEditoastApi';
import type { NullGeometry } from 'types';

//
// Waypoint
//
export type WayPoint = {
  type: 'BufferStop' | 'Detector';
  id: string;
};
export type WayPointEntity = BufferStopEntity<Point> | DetectorEntity<Point>;
export type RouteEntity = EditorEntity<
  NullGeometry,
  {
    entry_point: WayPoint;
    entry_point_direction: Direction;
    exit_point: WayPoint;
    track_nodes_directions: Record<string, string>;
    release_detectors: string[];
  }
> & {
  objType: 'Route';
};

export type RouteCandidate = {
  track_ranges: Required<DirectionalTrackRange>[];
  detectors: string[];
  track_nodes_directions: Record<string, string>;
};

export enum EndPointKeys {
  BEGIN = 'entry_point',
  END = 'exit_point',
}

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

export type RouteEditionState = CommonToolState & {
  // Common entity state for tools
  initialEntity?: RouteEntity;
  entity: RouteEntity;
  // To know if the entity is complete or not.
  // At init route is 'empty', and there is now way from its data to know if it is complete or not.
  isComplete: boolean;
  // Used to store info about begin & end point of the route.
  // (In the entity we only have a reference to it, ie. just the type+id)
  // This value is set in the component WayPoint
  extremitiesEntity: Partial<Record<EndPoint, DetectorEntity | BufferStopEntity>>;
  // Extremity state for the selector component
  extremityState:
    | { type: 'idle' }
    | {
        type: 'selection';
        extremity: EndPoint;
        onSelect: (track: WayPointEntity) => void;
        hoveredPoint: WayPointEntity | null;
      };
  // List of compatible routes
  optionsState: OptionsStateType;
};
