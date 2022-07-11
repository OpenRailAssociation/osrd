import { Action } from 'redux';
import { JSONSchema7 } from 'json-schema';
import { Position, Feature, GeoJsonProperties, Geometry } from 'geojson';
import { ThunkAction as ReduxThunkAction } from 'redux-thunk';
import { Operation } from 'fast-json-patch';

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
export type Point = Position;
export type Bbox = [Point, Point];
export type Path = Array<Point>;

export interface RectangleZone {
  type: 'rectangle';
  points: [Point, Point];
}
export interface PolygonZone {
  type: 'polygon';
  points: Point[];
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
export type EditorEntity = Feature & { objType: string };
export interface TrackSectionEntity extends EditorEntity {
  objType: 'TrackSection';
  geometry: {
    type: 'LineString';
    coordinates: [number, number][];
  };
}
export interface SignalEntity extends EditorEntity {
  objType: 'Signal';
  geometry: {
    type: 'Point';
    coordinates: Position;
  };
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
