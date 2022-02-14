import { Action } from 'redux';
import { JSONSchema7 } from 'json-schema';
import { Position } from 'geojson';
import { ThunkAction as ReduxThunkAction } from 'redux-thunk';

export type EditorModelsDefinition = any

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
type uuid = string;
type flags = string; // Should match /[01]{7}/

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
// Editor actions
//
export interface EditorOperationCreateEntity {
  operation: 'create_entity';
  entity_type: string;
  components: Array<{ component_type: string; component: unknown }>;
}
export interface EditorOperationUpdateComponent {
  operation: 'update_component';
  component_id: number;
  component_type: string;
  update: { [key: string]: unknown };
}
export interface EditorOperationDeleteEntity {
  operation: 'delete_entity';
  entity_id: number;
}

export type EditorOperation =
  | EditorOperationCreateEntity
  | EditorOperationUpdateComponent
  | EditorOperationDeleteEntity;

//
// Editor data model
//
export type EditorComponentsDefintion = { [key: string]: JSONSchema7 };
export type EditorEntitiesDefinition = { [key: string]: Array<keyof EditorComponentsDefintion> };

//
//  Misc
//
export type Theme = {
  [key: string]: { [key: string]: string };
};
