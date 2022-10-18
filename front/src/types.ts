import { Action } from 'redux';
import { JSONSchema7 } from 'json-schema';
import { Position, Feature, GeoJsonProperties, Geometry, Point } from 'geojson';
import { Operation } from 'fast-json-patch';
import { ThunkAction as ReduxThunkAction } from 'redux-thunk';
// Next line because:
// https://github.com/reduxjs/redux-thunk/issues/333#issuecomment-1107532912
import type {} from 'redux-thunk/extend-redux';

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
export interface TrackSectionEntity extends EditorEntity {
  objType: 'TrackSection';
  geometry: {
    type: 'LineString';
    coordinates: [number, number][];
  };
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
export interface BufferStopEntity
  extends EditorEntity<Point | NullGeometry, { track?: string; position?: number }> {
  objType: 'BufferStop';
}
export interface DetectorEntity
  extends EditorEntity<Point | NullGeometry, { track?: string; position?: number }> {
  objType: 'Detector';
}

export const ENDPOINTS = ['BEGIN', 'END'] as const;
export const ENDPOINTS_SET = new Set(ENDPOINTS);
export const DEFAULT_ENDPOINT = ENDPOINTS[0];
export type EndPoint = typeof ENDPOINTS[number];
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
  extends EditorEntity<Point, { switch_type: string; ports: Record<string, TrackEndpoint> }> {
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
