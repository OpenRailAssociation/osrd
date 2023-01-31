/* eslint-disable import/prefer-default-export */
import { RootState } from 'reducers';

/**
 *
 * @type State – one of the main reducers state (UserState, MapState, OsrdConfState, …)
 * @param rootSelector
 * @param key
 * @returns
 */
export const makeSubSelector =
  <ReducerState, Key extends keyof ReducerState>(
    rootSelector: (state: RootState) => ReducerState,
    key: Key
  ) =>
  (state: RootState) =>
    rootSelector(state)[key] as ReducerState[Key];
