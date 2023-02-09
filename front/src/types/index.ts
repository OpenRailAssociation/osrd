import { Action } from 'redux';
import { JSONSchema7 } from 'json-schema';
import { Position, Feature, GeoJsonProperties, Geometry, Point, LineString } from 'geojson';
import { Operation } from 'fast-json-patch';
import { ThunkAction as ReduxThunkAction } from 'redux-thunk';
// Next line because:
// https://github.com/reduxjs/redux-thunk/issues/333#issuecomment-1107532912
import type {} from 'redux-thunk/extend-redux';

export * from './mapbox-gl';

export const NULL_GEOMETRY = {
  type: 'GeometryCollection',
  geometries: [] as Geometry[],
} as const;
export type NullGeometry = typeof NULL_GEOMETRY;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type EditorModelsDefinition = any;

//
//  Redux types
//
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ThunkAction<T extends Action, R = void> = ReduxThunkAction<R, any, unknown, T>;

//
//  Geospatial types
//
export type Bbox = [Position, Position];
export type Path = Array<Position>;

export interface RectangleZone {
  type: 'rectangle';
  points: [Position, Position];
}
export interface PolygonZone {
  type: 'polygon';
  points: Position[];
}
export type Zone = RectangleZone | PolygonZone;
export type SourceLayer = 'sch' | 'geo';

// Notification type
export interface Notification {
  title?: string;
  text: string;
  date?: Date;
  type?: 'success' | 'error' | 'warning' | 'info';
}

//
// Editor data model
//
export type ObjectType = string;
export type EntityId = string | number | undefined;
export type EditorSchema = Array<{ layer: string; objType: ObjectType; schema: JSONSchema7 }>;
export type EditorEntity<G extends Geometry | null = Geometry, P = GeoJsonProperties> = Omit<
  Feature<G, P & { id: string }> & { objType: string },
  'id'
>;
export interface TrackSectionEntity
  extends EditorEntity<
    LineString,
    {
      length: number;
      extensions?: {
        sncf?: {
          line_code?: number;
          line_name?: string;
          track_name?: string;
          track_number?: number;
        };
      };
    }
  > {
  objType: 'TrackSection';
}
export interface SignalEntity
  extends EditorEntity<
    Point | NullGeometry,
    {
      track?: string;
      position?: number;
      extensions: {
        sncf: {
          is_in_service?: boolean;
          is_lightable?: boolean;
          is_operational?: boolean;
          installation_type?: string;
          angle_geo?: number;
        };
      };
    }
  > {
  objType: 'Signal';
}
export interface BufferStopEntity<T extends Point | NullGeometry = Point | NullGeometry>
  extends EditorEntity<T, { track?: string; position?: number }> {
  objType: 'BufferStop';
}
export interface DetectorEntity<T extends Point | NullGeometry = Point | NullGeometry>
  extends EditorEntity<T, { track?: string; position?: number }> {
  objType: 'Detector';
}

export const DIRECTIONS = ['START_TO_STOP', 'STOP_TO_START'] as const;
export const DIRECTIONS_SET = new Set(DIRECTIONS);
export const DEFAULT_DIRECTION = DIRECTIONS[0];
export type Direction = (typeof DIRECTIONS)[number];
export interface TrackRange {
  track: string;
  begin: number;
  end: number;
  direction: Direction;
}

export interface WayPoint {
  type: 'BufferStop' | 'Detector';
  id: string;
}
export type WayPointEntity = BufferStopEntity<Point> | DetectorEntity<Point>;
export interface RouteEntity
  extends EditorEntity<
    NullGeometry,
    {
      entry_point: WayPoint;
      entry_point_direction: Direction;
      exit_point: WayPoint;
      switches_directions: Record<string, string>;
      release_detectors: string[];
    }
  > {
  objType: 'Route';
}

export const ENDPOINTS = ['BEGIN', 'END'] as const;
export const ENDPOINTS_SET = new Set(ENDPOINTS);
export const DEFAULT_ENDPOINT = ENDPOINTS[0];
export type EndPoint = (typeof ENDPOINTS)[number];
export interface SwitchPortConnection {
  src: string;
  dst: string;
  bidirectionnal: boolean;
}
export interface TrackEndpoint {
  endpoint: EndPoint;
  track: string;
}
export interface SwitchType {
  id: string;
  ports: string[];
  groups: Record<string, SwitchPortConnection[]>;
}
export interface SwitchEntity
  extends EditorEntity<
    Point,
    {
      switch_type: string;
      ports: Record<string, TrackEndpoint>;
      extensions?: {
        sncf: {
          label?: string;
        };
      };
    }
  > {
  objType: 'Switch';
}

export interface DeleteEntityOperation {
  operation_type: 'DELETE';
  obj_id: EntityId;
  obj_type: ObjectType;
}
export interface UpdateEntityOperation {
  operation_type: 'UPDATE';
  obj_id: EntityId;
  obj_type: ObjectType;
  railjson_patch: Operation[];
}
export interface CreateEntityOperation {
  operation_type: 'CREATE';
  obj_type: ObjectType;
  railjson: GeoJsonProperties & { id?: EntityId };
}
export type EntityOperation = DeleteEntityOperation | UpdateEntityOperation | CreateEntityOperation;

//
//  Misc
//
export type Theme = {
  [key: string]: { [key: string]: string };
};

//
// API
//
export interface ApiInfrastructure {
  id: number;
  name: string;
  version: string;
}
