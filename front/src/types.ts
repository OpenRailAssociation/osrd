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
  component_id?: undefined | number;
  entity_id?: undefined | number;
}
export interface EditorOperationCreateEntity extends BaseEditorOperation {
  operation: 'create_entity';
  entity_type: string;
  components: Array<{ component_type: string; component: unknown }>;
}
export interface EditorOperationUpdateComponent extends BaseEditorOperation {
  operation: 'update_component';
  component_id: number;
  component_type: string;
  update: { [key: string]: unknown };
}
export interface EditorOperationDeleteEntity extends BaseEditorOperation {
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
export type EditorComponentsDefinition = { [key: string]: JSONSchema7 };
export type EditorEntitiesDefinition = { [key: string]: Array<keyof EditorComponentsDefinition> };

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
  owner: string;
  created: Date;
  modified: Date;
}

export interface ApiSchemaResponseEntity {
  entity_name: string;
  components: Array<string>;
}
export interface ApiSchemaResponseComponent {
  component_name: string;
  fields: Array<{ name: string; type: string }>;
}
export interface ApiSchemaResponse {
  entities: Array<ApiSchemaResponseEntity>;
  components: Array<ApiSchemaResponseComponent>;
}
