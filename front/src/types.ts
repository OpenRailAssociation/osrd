import { Action } from 'redux';
import { JSONSchema7 } from 'json-schema';
import { Position, Feature } from 'geojson';
import { ThunkAction as ReduxThunkAction } from 'redux-thunk';

export type EditorModelsDefinition = any;

//
//  Redux types
//
export type ThunkAction<T extends Action> = ReduxThunkAction<void, any, unknown, T>;

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

//
//  Metadata types
//

export interface Item {
  id: string;
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
export type EditorSchema = Array<{ layer: string; objType: string; schema: JSONSchema7 }>;
export type EditorEntity = Feature & { objType: string };
export interface TrackSectionEntity extends EditorEntity {
  objType: 'TrackSection';
  geometry: {
    type: 'LineString';
    coordinates: [number, number][];
  };
}

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
