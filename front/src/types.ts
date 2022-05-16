import { Action } from 'redux';
import { JSONSchema7 } from 'json-schema';
import { Position } from 'geojson';
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

  // TODO:
  // Refine typings
  entity_id?: string;
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
// Editor actions
//
export interface BaseEditorOperation {
  obj_type?: string;
}
export interface EditorOperationCreate extends BaseEditorOperation {
  operation_type: 'CREATE';
  railjson: any;
}
export interface EditorOperationUpdate extends BaseEditorOperation {
  operation_type: 'UPDATE';
  obj_id: number;
  railjson_patch: any;
}
export interface EditorOperationDelete extends BaseEditorOperation {
  operation: 'DELETE';
  obj_id: number;
}

export type EditorOperation = EditorOperationCreate | EditorOperationUpdate | EditorOperationDelete;

//
// Editor data model
//
export type EditorSchema = { [key: string]: JSONSchema7 };

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
