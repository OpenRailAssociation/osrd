import { produce } from 'immer';
import type { AnyAction } from 'redux';

import { SIGNAL_BASE_DEFAULT } from 'modules/simulationResult/consts';
import { SPEED_SPACE_SETTINGS_KEYS, type OsrdSimulationState } from 'reducers/osrdsimulation/types';

// TODO: Dependency cycle will be removed during the refactoring of store
// eslint-disable-next-line import/no-cycle
import {
  UPDATE_CHART,
  UPDATE_IS_PLAYING,
  UPDATE_IS_UPDATING,
  UPDATE_ALLOWANCES_SETTINGS,
  UPDATE_MUST_REDRAW,
  UPDATE_SELECTED_PROJECTION,
  UPDATE_SELECTED_TRAIN_ID,
  UPDATE_SIMULATION,
  UPDATE_SPEEDSPACE_SETTINGS,
  UPDATE_SIGNAL_BASE,
  UPDATE_CONSOLIDATED_SIMULATION,
  REDO_SIMULATION,
  UNDO_SIMULATION,
  UPDATE_TRAIN_ID_USED_FOR_PROJECTION,
} from './actions';
import undoableSimulation from './simulation';

// Reducer
export const initialState: OsrdSimulationState = {
  chart: undefined,
  isPlaying: false,
  isUpdating: false,
  allowancesSettings: undefined,
  mustRedraw: true,
  selectedProjection: undefined,
  selectedTrainId: undefined,
  speedSpaceSettings: {
    [SPEED_SPACE_SETTINGS_KEYS.ALTITUDE]: false,
    [SPEED_SPACE_SETTINGS_KEYS.CURVES]: false,
    [SPEED_SPACE_SETTINGS_KEYS.MAX_SPEED]: false,
    [SPEED_SPACE_SETTINGS_KEYS.SLOPES]: false,
    [SPEED_SPACE_SETTINGS_KEYS.ELECTRICAL_PROFILES]: false,
    [SPEED_SPACE_SETTINGS_KEYS.POWER_RESTRICTION]: false,
  },
  signalBase: SIGNAL_BASE_DEFAULT,
  consolidatedSimulation: [],
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
    if (!state.simulation) draft.simulation = undoableSimulation(state.simulation, action);
    switch (action.type) {
      case UPDATE_CHART:
        draft.chart = action.chart;
        break;
      case UPDATE_IS_PLAYING:
        draft.isPlaying = action.isPlaying;
        break;
      case UPDATE_IS_UPDATING:
        draft.isUpdating = action.isUpdating;
        break;
      case UPDATE_ALLOWANCES_SETTINGS:
        draft.allowancesSettings = action.allowancesSettings;
        break;
      case UPDATE_MUST_REDRAW:
        draft.mustRedraw = action.mustRedraw;
        break;
      case UPDATE_SELECTED_PROJECTION:
        draft.selectedProjection = action.selectedProjection;
        break;
      case UPDATE_SELECTED_TRAIN_ID:
        draft.selectedTrainId = action.selectedTrainId;
        break;
      case UPDATE_SIMULATION:
      case UNDO_SIMULATION:
      case REDO_SIMULATION:
        // get only the present, thanks
        draft.simulation = undoableSimulation(state.simulation, action);

        break;
      case UPDATE_SPEEDSPACE_SETTINGS:
        draft.speedSpaceSettings = action.speedSpaceSettings;
        break;
      case UPDATE_SIGNAL_BASE:
        draft.signalBase = action.signalBase;
        break;
      case UPDATE_CONSOLIDATED_SIMULATION:
        draft.consolidatedSimulation = action.consolidatedSimulation;
        break;
      case UPDATE_TRAIN_ID_USED_FOR_PROJECTION:
        draft.trainIdUsedForProjection = action.trainIdUsedForProjection;
        break;
      default:
        break;
    }
  });
}
