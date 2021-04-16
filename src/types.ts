import { ThunkAction as ReduxThunkAction } from 'redux-thunk';
import { Action } from 'redux';
import { GeoJSON, Position } from 'geojson';

//
//  Redux types
export type ThunkAction<T extends Action> = ReduxThunkAction<void, any, unknown, T>;

//
//  Geospatial types
//
export type Point = Position;
export type Bbox = [Point, Point];
export type Path = Array<Point>;

// Notification type
export interface Notification {
  title?: string;
  text: string;
  date?: Date;
  type?: 'success' | 'error' | 'warning' | 'info';
}

//
// Chartis update
//
export interface ChartisActionInsert {
  type: 'insert';
  layer: string;
  geometry: GeoJSON;
}
export interface ChartisActionUpdate {
  type: 'update';
  layer: string;
  id: number;
  geometry: GeoJSON;
}
export interface ChartisActionDelete {
  type: 'delete';
  layer: string;
  id: number;
}

export type ChartisAction = ChartisActionInsert | ChartisActionUpdate | ChartisActionDelete;
