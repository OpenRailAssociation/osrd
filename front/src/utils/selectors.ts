/* eslint-disable import/prefer-default-export */
import type { RootState } from 'reducers';

export const makeSubSelector =
  <ReducerState>(rootSelector: (state: RootState) => ReducerState) =>
  <Key extends keyof ReducerState>(key: Key) =>
  (state: RootState) =>
    rootSelector(state)[key];
