import { Action } from 'redux';
import { ThunkAction as ReduxThunkAction } from 'redux-thunk';
// Next line because: https://github.com/reduxjs/redux-thunk/issues/333#issuecomment-1107532912
import type {} from 'redux-thunk/extend-redux';

export * from './mapbox-gl';
export * from './railjson';
export * from './geospatial';
export * from './editor';

//
//  Redux types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ThunkAction<T extends Action, R = void> = ReduxThunkAction<R, any, unknown, T>;

// Notification type
export interface Notification {
  title?: string;
  text: string;
  date?: Date;
  type?: 'success' | 'error' | 'warning' | 'info';
}

//
//  Misc
export type Theme = {
  [key: string]: { [key: string]: string };
};

export declare type PartialButFor<T, K extends keyof T> = Pick<T, K> & Partial<Omit<T, K>>;
