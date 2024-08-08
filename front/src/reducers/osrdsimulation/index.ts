import { produce } from 'immer';
import type { AnyAction } from 'redux';

import { type OsrdSimulationState } from 'reducers/osrdsimulation/types';

import {
  UPDATE_IS_PLAYING,
  UPDATE_IS_UPDATING,
  UPDATE_SELECTED_TRAIN_ID,
  UPDATE_TRAIN_ID_USED_FOR_PROJECTION,
} from './actions';

// Reducer
export const initialState: OsrdSimulationState = {
  chart: undefined,
  isPlaying: false,
  isUpdating: false,
  allowancesSettings: undefined,
  selectedTrainId: undefined,
  simulation: {
    past: [],
    present: { trains: [] },
    future: [],
  },
  trainIdUsedForProjection: undefined,
};

// eslint-disable-next-line default-param-last
export default function reducer(inputState: OsrdSimulationState | undefined, action: AnyAction) {
  const state = inputState || initialState;
  return produce(state, (draft) => {
    switch (action.type) {
      case UPDATE_IS_PLAYING:
        draft.isPlaying = action.isPlaying;
        break;
      case UPDATE_IS_UPDATING:
        draft.isUpdating = action.isUpdating;
        break;
      case UPDATE_SELECTED_TRAIN_ID:
        draft.selectedTrainId = action.selectedTrainId;
        break;
      case UPDATE_TRAIN_ID_USED_FOR_PROJECTION:
        draft.trainIdUsedForProjection = action.trainIdUsedForProjection;
        break;
      default:
        break;
    }
  });
}
