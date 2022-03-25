import { REDO_SIMULATION, UNDO_SIMULATION } from './osrdsimulation/simulation';

import { LIST_VALUES_NAME_SPACE_TIME } from '../applications/osrd/components/Simulation/consts';
import { MdFreeBreakfast } from 'react-icons/md';
import {
  interpolateOnTime,
} from '../applications/osrd/components/Helpers/ChartHelpers';
import { offsetSeconds } from '../applications/osrd/components/Helpers/ChartHelpers';
import produce from 'immer';
/* eslint-disable default-case */
import undoableSimulation from './osrdsimulation/simulation';

// Action Types
export const UPDATE_CHART = 'osrdsimu/UPDATE_CHART';
export const UPDATE_CHARTXGEV = 'osrdsimu/UPDATE_CHARTXGEV';
export const UPDATE_CONTEXTMENU = 'osrdsimu/UPDATE_CONTEXTMENU';
export const UPDATE_HOVER_POSITION = 'osrdsimu/UPDATE_HOVER_POSITION';
export const UPDATE_IS_PLAYING = 'osrdsimu/UPDATE_IS_PLAYING';
export const UPDATE_ALLOWANCES_SETTINGS = 'osrdsimu/UPDATE_ALLOWANCES_SETTINGS';
export const UPDATE_MUST_REDRAW = 'osrdsimu/UPDATE_MUST_REDRAW';
export const UPDATE_POSITION_VALUES = 'osrdsimu/UPDATE_POSITION_VALUES';
export const UPDATE_SELECTED_PROJECTION = 'osrdsimu/UPDATE_SELECTED_PROJECTION';
export const UPDATE_SELECTED_TRAIN = 'osrdsimu/UPDATE_SELECTED_TRAIN';
export const UPDATE_SIMULATION = 'osrdsimu/UPDATE_SIMULATION';
export const UPDATE_SPEEDSPACE_SETTINGS = 'osrdsimu/UPDATE_SPEEDSPACE_SETTINGS';
export const UPDATE_STICKYBAR = 'osrdsimu/UPDATE_STICKYBAR';
export const UPDATE_TIME_POSITION = 'osrdsimu/UPDATE_TIME_POSITION';
export const UPDATE_TIME_POSITION_VALUES = 'osrdsimu/UPDATE_TIME_POSITION_VALUES';
export const UPDATE_CONSOLIDATED_SIMULATION = 'osrdsimu/UPDATE_CONSOLIDATED_SIMULATION';
export const UPDATE_DEPARTURE_ARRIVAL_TIMES = 'osrdsimu/UPDATE_DEPARTURE_ARRIVAL_TIMES';

export const departureArrivalTimes = (simulation, dragOffset) => simulation.trains.map((train) => ({
    labels: train.labels,
    name: train.name,
    departure: offsetSeconds(train.base.stops[0].time + dragOffset),
    arrival: offsetSeconds(
      train.base.stops[train.base.stops.length - 1].time + dragOffset
    ),
  }))


// Reducer
export const initialState = {
  chart: undefined,
  chartXGEV: undefined,
  contextMenu: undefined,
  hoverPosition: undefined,
  isPlaying: false,
  allowancesSettings: undefined,
  mustRedraw: true,
  positionValues: {
    headPosition: 0,
    tailPosition: 0,
    routeEndOccupancy: 0,
    routeBeginOccupancy: 0,
  },
  selectedProjection: undefined,
  selectedTrain: 0,
  speedSpaceSettings: {
    altitude: false,
    curves: false,
    maxSpeed: true,
    slopes: false,
  },
  stickyBar: true,
  timePosition: undefined,
  consolidatedSimulation: null,
  departureArrivalTimes: []
};

export default function reducer(state = initialState, action) {
  return produce(state, (draft) => {
    if (!state.simulation) draft.simulation = undoableSimulation(state.simulation, action)
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
      case UPDATE_HOVER_POSITION:
        draft.hoverPosition = action.hoverPosition;
        break;
      case UPDATE_IS_PLAYING:
        draft.isPlaying = action.isPlaying;
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
        break
      case UPDATE_DEPARTURE_ARRIVAL_TIMES:
        draft.departureArrivalTimes = action.departureArrivalTimes;
        break;
      case UPDATE_SIMULATION:
        draft.simulation = undoableSimulation(state.simulation, action);
        draft.departureArrivalTimes = departureArrivalTimes(draft.simulation.present, 0);
        break;
      case UNDO_SIMULATION:
      case REDO_SIMULATION:
        draft.simulation = undoableSimulation(state.simulation, action);
        draft.departureArrivalTimes = departureArrivalTimes(draft.simulation.present, 0);
        //draft.mustRedraw = true;
        break;
      case UPDATE_SPEEDSPACE_SETTINGS:
        draft.speedSpaceSettings = action.speedSpaceSettings;
        break;
      case UPDATE_STICKYBAR:
        draft.stickyBar = action.stickyBar;
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
        // eslint-disable-next-line no-case-declarations
        const currentTrainSimulation = state.consolidatedSimulation.find(consolidatedSimulation => consolidatedSimulation.trainNumber === state.selectedTrain)
        const positionsValues = interpolateOnTime(
          currentTrainSimulation,
          ['time'],
          LIST_VALUES_NAME_SPACE_TIME,
          action.timePosition,
        );
        draft.positionValues = positionsValues
        break;
      }
    }
  });
}



// Functions
export function updateChart(chart) {
  return (dispatch) => {
    dispatch({
      type: UPDATE_CHART,
      chart,
    });
  };
}
export function updateChartXGEV(chartXGEV) {
  return (dispatch) => {
    dispatch({
      type: UPDATE_CHARTXGEV,
      chartXGEV,
    });
  };
}
export function updateContextMenu(contextMenu) {
  return (dispatch) => {
    dispatch({
      type: UPDATE_CONTEXTMENU,
      contextMenu,
    });
  };
}
export function updateHoverPosition(hoverPosition) {
  return (dispatch) => {
    dispatch({
      type: UPDATE_HOVER_POSITION,
      hoverPosition,
    });
  };
}
export function updateIsPlaying(isPlaying) {
  return (dispatch) => {
    dispatch({
      type: UPDATE_IS_PLAYING,
      isPlaying,
    });
  };
}
export function updateAllowancesSettings(allowancesSettings) {
  return (dispatch) => {
    dispatch({
      type: UPDATE_ALLOWANCES_SETTINGS,
      allowancesSettings,
    });
  };
}
export function updateMustRedraw(mustRedraw) {
  return (dispatch) => {
    dispatch({
      type: UPDATE_MUST_REDRAW,
      mustRedraw,
    });
  };
}
export function updatePositionValues(positionValues) {
  return (dispatch) => {
    dispatch({
      type: UPDATE_POSITION_VALUES,
      positionValues,
    });
  };
}
export function updateSelectedProjection(selectedProjection) {
  return (dispatch) => {
    dispatch({
      type: UPDATE_SELECTED_PROJECTION,
      selectedProjection,
    });
  };
}
export function updateSelectedTrain(selectedTrain) {
  return (dispatch) => {
    dispatch({
      type: UPDATE_SELECTED_TRAIN,
      selectedTrain,
    });
  };
}
export function updateSimulation(simulation) {
  return (dispatch) => {
    dispatch({
      type: UPDATE_SIMULATION,
      simulation,
    });
  };
}
export function updateSpeedSpaceSettings(speedSpaceSettings) {
  return (dispatch) => {
    dispatch({
      type: UPDATE_SPEEDSPACE_SETTINGS,
      speedSpaceSettings,
    });
  };
}
export function updateStickyBar(stickyBar) {
  return (dispatch) => {
    dispatch({
      type: UPDATE_STICKYBAR,
      stickyBar,
    });
  };
}
export function updateTimePosition(timePosition) {
  return (dispatch) => {
    dispatch({
      type: UPDATE_TIME_POSITION,
      timePosition,
    });
  };
}
export function updateDepartureArrivalTimes(departureArrivalTimes) {
  return (dispatch) => {
    dispatch({
      type: UPDATE_DEPARTURE_ARRIVAL_TIMES,
      departureArrivalTimes,
    });
  };
}
export function updateConsolidatedSimulation(consolidatedSimulation) {
  return (dispatch) => {
    dispatch({
      type: UPDATE_CONSOLIDATED_SIMULATION,
      consolidatedSimulation,
    });
  };
}
export function updateTimePositionValues(timePosition, positionValues) {
  return (dispatch) => {
    dispatch({
      type: UPDATE_TIME_POSITION_VALUES,
      timePosition,
      positionValues,
    });
  };
}
