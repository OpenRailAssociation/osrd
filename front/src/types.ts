import { Action } from 'redux';
import { JSONSchema7 } from 'json-schema';
import { Position, Feature, GeoJsonProperties, Geometry, Point } from 'geojson';
import { Operation } from 'fast-json-patch';
import { ThunkAction as ReduxThunkAction } from 'redux-thunk';
// Next line because:
// https://github.com/reduxjs/redux-thunk/issues/333#issuecomment-1107532912
import type {} from 'redux-thunk/extend-redux';

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

//
//  Metadata types
//

export interface Item {
  id: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  properties: Record<string, any>;
}

export type PositionnedItem = Item & {
  lng: number;
  lat: number;
};

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
export type EditorEntity<G extends Geometry | null = Geometry, P = GeoJsonProperties> = Feature<
  G,
  P
> & { objType: string };
export interface TrackSectionEntity extends EditorEntity {
  objType: 'TrackSection';
  geometry: {
    type: 'LineString';
    coordinates: [number, number][];
  };
}
export interface SignalEntity
  extends EditorEntity<
    Point,
    {
      track?: { id: string; type: string };
      position?: number;
      angle_geo?: number;
      installation_type?: string;
    }
  > {
  objType: 'Signal';
}
export interface BufferStopEntity
  extends EditorEntity<Point, { track?: { id: string; type: string }; position?: number }> {
  objType: 'BufferStop';
}
export interface DetectorEntity
  extends EditorEntity<Point, { track?: { id: string; type: string }; position?: number }> {
  objType: 'Detector';
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
  railjson: GeoJsonProperties & { id?: EntityId; sch: Geometry; geo: Geometry };
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
