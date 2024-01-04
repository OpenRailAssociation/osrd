import produce from 'immer';
import { noop } from 'lodash';
import { AnyAction } from 'redux';

import { SimulationReport } from 'common/api/osrdEditoastApi';
import { SIGNAL_BASE_DEFAULT, CHART_AXES } from 'modules/simulationResult/consts';
import createTrain from 'modules/simulationResult/components/SpaceTimeChart/createTrain';
import {
  SPEED_SPACE_SETTINGS_KEYS,
  OsrdSimulationState,
  Train,
} from 'reducers/osrdsimulation/types';
// TODO: Dependency cycle will be removed during the refactoring of store
// eslint-disable-next-line import/no-cycle
import undoableSimulation from './simulation';

import {
  UPDATE_CHART,
  UPDATE_CHARTXGEV,
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
} from './actions';

// Reducer
export const initialState: OsrdSimulationState = {
  chart: undefined,
  chartXGEV: undefined,
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
  displaySimulation: false,
  simulation: {
    past: [],
    present: { trains: [] },
    future: [],
  },
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
      case UPDATE_CHARTXGEV:
        draft.chartXGEV = action.chartXGEV;
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
        draft.consolidatedSimulation = createTrain(
          noop,
          CHART_AXES.SPACE_TIME,
          draft.simulation.present.trains as Train[], // TODO: remove Train interface
          noop
        );
        draft.displaySimulation =
          draft.simulation.present?.trains.length > 0 &&
          // TODO: delete this cast when we have chosen the appropriate type for the simulation
          (draft.simulation.present.trains as SimulationReport[]).find(
            (train) => train.id === state.selectedTrainId
          ) !== undefined;

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
      default:
        break;
    }
  });
}
