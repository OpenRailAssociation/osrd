import { ThunkAction as ReduxThunkAction } from 'redux-thunk';
import { Action } from 'redux';

//
//  Redux types
export type ThunkAction<T extends Action> = ReduxThunkAction<void, any, unknown, T>;

//
//  Geospatial types
//
export type Point = [number, number];
export type Bbox = [Point, Point];
export type Path = Array<Point>;

export interface Notification {
  title?: string;
  text: string;
  date?: Date;
  type?: 'success' | 'error' | 'warning' | 'info';
}
