import { AnyAction } from 'redux';
import produce from 'immer';
import { noop } from 'lodash';

import createTrain from 'applications/operationalStudies/components/SimulationResults/SpaceTimeChart/createTrain';
import {
  LIST_VALUES_NAME_SPACE_TIME,
  SIGNAL_BASE_DEFAULT,
  KEY_VALUES_FOR_CONSOLIDATED_SIMULATION,
} from 'applications/operationalStudies/components/SimulationResults/simulationResultsConsts';
import {
  interpolateOnTime,
  offsetAllTrainsDepartureAndArrivalTimes,
} from 'applications/operationalStudies/components/SimulationResults/ChartHelpers/ChartHelpers';
import undoableSimulation, { REDO_SIMULATION, UNDO_SIMULATION } from './simulation';

import { OsrdSimulationState, SimulationTrain } from './types';

import {
  UPDATE_CHART,
  UPDATE_CHARTXGEV,
  UPDATE_CONTEXTMENU,
  UPDATE_IS_PLAYING,
  UPDATE_IS_UPDATING,
  UPDATE_ALLOWANCES_SETTINGS,
  UPDATE_MUST_REDRAW,
  UPDATE_POSITION_VALUES,
  UPDATE_SELECTED_PROJECTION,
  UPDATE_SELECTED_TRAIN,
  UPDATE_SIMULATION,
  UPDATE_SPEEDSPACE_SETTINGS,
  UPDATE_SIGNAL_BASE,
  UPDATE_TIME_POSITION,
  UPDATE_DEPARTURE_ARRIVAL_TIMES,
  UPDATE_CONSOLIDATED_SIMULATION,
  UPDATE_TIME_POSITION_VALUES,
} from './actions';

// Reducer
export const initialState: OsrdSimulationState = {
  chart: undefined,
  chartXGEV: undefined,
  contextMenu: undefined,
  isPlaying: false,
  isUpdating: false,
  allowancesSettings: undefined,
  mustRedraw: true,
  positionValues: {
    headPosition: {
      time: 0,
      position: 0,
      speed: 0,
    },
    tailPosition: {
      time: 0,
      position: 0,
      speed: 0,
    },
    speed: {
      speed: 0,
      time: 0,
    },
  },
  selectedProjection: undefined,
  selectedTrain: 0,
  speedSpaceSettings: {
    altitude: false,
    curves: false,
    maxSpeed: true,
    slopes: false,
    electricalProfiles: false,
  },
  signalBase: SIGNAL_BASE_DEFAULT,
  timePosition: undefined,
  consolidatedSimulation: [],
  departureArrivalTimes: [],
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
  let currentTrainSimulation;
  return produce(state, (draft) => {
    if (!state.simulation) draft.simulation = undoableSimulation(state.simulation, action);
    switch (action.type) {
      case UPDATE_CHART:
        draft.chart = action.chart;
        break;
      case UPDATE_CHARTXGEV:
        draft.chartXGEV = action.chartXGEV;
        break;
      case UPDATE_CONTEXTMENU:
        draft.contextMenu = action.contextMenu;
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
      case UPDATE_POSITION_VALUES:
        draft.positionValues = action.positionValues;
        break;
      case UPDATE_SELECTED_PROJECTION:
        draft.selectedProjection = action.selectedProjection;
        break;
      case UPDATE_SELECTED_TRAIN:
        draft.selectedTrain = action.selectedTrain;
        currentTrainSimulation = state.consolidatedSimulation.find(
          (consolidatedSimulation: SimulationTrain) =>
            consolidatedSimulation.trainNumber === draft.selectedTrain
        );
        draft.positionValues = interpolateOnTime(
          currentTrainSimulation,
          ['time'],
          LIST_VALUES_NAME_SPACE_TIME,
          state.timePosition
        );
        break;
      case UPDATE_DEPARTURE_ARRIVAL_TIMES:
        draft.departureArrivalTimes = action.departureArrivalTimes;
        break;
      case UPDATE_SIMULATION:
      case UNDO_SIMULATION:
      case REDO_SIMULATION:
        // get only the present, thanks
        draft.simulation = undoableSimulation(state.simulation, action);
        draft.departureArrivalTimes = offsetAllTrainsDepartureAndArrivalTimes(
          draft.simulation.present.trains,
          0
        );

        draft.consolidatedSimulation = createTrain(
          noop,
          KEY_VALUES_FOR_CONSOLIDATED_SIMULATION,
          draft.simulation.present.trains,
          noop
        );
        draft.displaySimulation =
          draft.simulation.present?.trains.length > 0 &&
          draft.simulation.present.trains[state.selectedTrain] !== undefined;

        break;
      case UPDATE_SPEEDSPACE_SETTINGS:
        draft.speedSpaceSettings = action.speedSpaceSettings;
        break;
      case UPDATE_SIGNAL_BASE:
        draft.signalBase = action.signalBase;
        break;
      case UPDATE_TIME_POSITION:
        draft.timePosition = action.timePosition;
        break;
      case UPDATE_CONSOLIDATED_SIMULATION:
        draft.consolidatedSimulation = action.consolidatedSimulation;
        break;
      case UPDATE_TIME_POSITION_VALUES: {
        draft.timePosition = action.timePosition;
        // position value will be computed depending on current data simulation
        currentTrainSimulation = state.consolidatedSimulation.find(
          (consolidatedSimulation: SimulationTrain) =>
            consolidatedSimulation.trainNumber === state.selectedTrain
        );
        draft.positionValues = interpolateOnTime(
          currentTrainSimulation,
          ['time'],
          LIST_VALUES_NAME_SPACE_TIME,
          action.timePosition
        );
        break;
      }
      default:
        break;
    }
  });
}
