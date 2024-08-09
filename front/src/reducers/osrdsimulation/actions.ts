import type { Dispatch } from 'redux';

import type { OsrdSimulationState } from './types';

// Action Types
export const UPDATE_IS_PLAYING = 'osrdsimu/UPDATE_IS_PLAYING';
export const UPDATE_IS_UPDATING = 'osrdsimu/UPDATE_IS_UPDATING';
export const UPDATE_SELECTED_TRAIN_ID = 'osrdsimu/UPDATE_SELECTED_TRAIN_ID';
export const UPDATE_TRAIN_ID_USED_FOR_PROJECTION = 'osrdsimu/UPDATE_TRAIN_ID_USED_FOR_PROJECTION';

// Functions

export function updateIsPlaying(isPlaying: OsrdSimulationState['isPlaying']) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_IS_PLAYING,
      isPlaying,
    });
  };
}
export function updateIsUpdating(isUpdating: OsrdSimulationState['isUpdating']) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_IS_UPDATING,
      isUpdating,
    });
  };
}

export function updateSelectedTrainId(selectedTrainId: OsrdSimulationState['selectedTrainId']) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_SELECTED_TRAIN_ID,
      selectedTrainId,
    });
  };
}

export function updateTrainIdUsedForProjection(
  trainIdUsedForProjection: OsrdSimulationState['trainIdUsedForProjection']
) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_TRAIN_ID_USED_FOR_PROJECTION,
      trainIdUsedForProjection,
    });
  };
}
