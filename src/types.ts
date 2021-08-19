import { ThunkAction as ReduxThunkAction } from 'redux-thunk';
import { Action } from 'redux';
import { Position } from 'geojson';
import { JSONSchema7 } from 'json-schema';
import { omit } from 'lodash';
import config from './config/config';

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
  update: { [key: string]: unknonw };
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
export type EditorEntitiesDefinition = { [key: string]: Array<keyof EditorComponentDefintion> };

export interface ComponentData {
  component_id?: number;
  component_type: string;
}

export class Entity {
  entity_id: number = -1;
  entity_type: string;
  components: Array<ComponentData> = [];

  constructor(arg: string | any) {
    if (typeof arg === 'string') {
      this.entity_type = arg;
      this.components.push({ ...config.editor.component_identifier, component_type: 'identifier' });
    } else {
      this.entity_id = arg.entity_id || -1;
      this.entity_type = arg.entity_type;
      const componentsData = arg.components
        ? arg.components
        : omit(arg, ['entity_id', 'entity_type']);
      this.components = Object.keys(componentsData).map((type: string) => {
        return { ...componentsData[type], component_type: type };
      });
    }
  }

  toObject() {
    const result = {
      entity_id: this.entity_id,
      entity_type: this.entity_type,
    };
    this.components.forEach((component: ComponentData) => {
      result[component.component_type] = omit(component, ['component_type']);
    });
    return result;
  }

  toOperations(): Array<EditorOperation> {
    if (this.entity_id < 0) {
      return {
        operation: 'create_entity',
        entity_type: this.entity_type,
        components: this.components
          .filter(
            (component) =>
              Object.keys(omit(component, ['component_type', 'component_id'])).length > 0,
          )
          .map((component) => {
            return {
              component_type: component.component_type,
              component: omit(component, ['component_type', 'component_id']),
            };
          }),
      };
    } else {
      //TODO: do the update of all components
    }
  }
}

//
//  Misc
//
export type Theme = {
  [key: string]: { [key: string]: string };
};
