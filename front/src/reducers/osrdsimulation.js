import { LIST_VALUES_NAME_SPACE_TIME } from '../applications/osrd/components/Simulation/consts';
import {
interpolateOnTime,
} from '../applications/osrd/components/Helpers/ChartHelpers';
/* eslint-disable default-case */
import produce from 'immer';

import { combineReducers } from 'redux-immer';

import simulation from './osrdsimulation/simulation';
import positionValues from './osrdsimulation/positionValues';
import speedSpaceSettings from './osrdsimulation/positionValues';

// Re-exports
export { updatePositionValues } from './osrdsimulation/positionValues';
export { updateSpeedSpaceSettings } from './osrdsimulation/speedSpaceSettings';
export { updateSimulation } from './osrdsimulation/simulation';

// Action Types

export const UPDATE_CHART = 'osrdsimu/UPDATE_CHART';
export const UPDATE_CHARTXGEV = 'osrdsimu/UPDATE_CHARTXGEV';
export const UPDATE_CONTEXTMENU = 'osrdsimu/UPDATE_CONTEXTMENU';
export const UPDATE_HOVER_POSITION = 'osrdsimu/UPDATE_HOVER_POSITION';

export const UPDATE_IS_PLAYING = 'osrdsimu/UPDATE_IS_PLAYING';
export const UPDATE_ALLOWANCES_SETTINGS = 'osrdsimu/UPDATE_ALLOWANCES_SETTINGS';
export const UPDATE_MUST_REDRAW = 'osrdsimu/UPDATE_MUST_REDRAW';

export const UPDATE_SELECTED_PROJECTION = 'osrdsimu/UPDATE_SELECTED_PROJECTION';
export const UPDATE_SELECTED_TRAIN = 'osrdsimu/UPDATE_SELECTED_TRAIN';

export const UPDATE_SPEEDSPACE_SETTINGS = 'osrdsimu/UPDATE_SPEEDSPACE_SETTINGS';
export const UPDATE_STICKYBAR = 'osrdsimu/UPDATE_STICKYBAR';
export const UPDATE_TIME_POSITION = 'osrdsimu/UPDATE_TIME_POSITION';
export const UPDATE_TIME_POSITION_VALUES = 'osrdsimu/UPDATE_TIME_POSITION_VALUES';
export const UPDATE_CONSOLIDATED_SIMULATION = 'osrdsimu/UPDATE_CONSOLIDATED_SIMULATION';


// Reducer
export const initialState = {
  isPlaying: false,
  allowancesSettings: undefined,
  mustRedraw: true,
  selectedProjection: undefined,
  selectedTrain: 0,
  stickyBar: true,
  timePosition: null,
  timePosition: undefined,
  consolidatedSimulation: null,
};

function createReducerWithInitialState(state = null, action) {
  if (action.payload !== undefined) return action.payload;
  return state;
}

// create another file
function timePosition(state = initialState.timePosition, action) {
  switch (action.type) {
    case UPDATE_TIME_POSITION_VALUES:
      return action.timePosition;
    case UPDATE_TIME_POSITION:
      return action.payload;
    default:
      return state;
  }
}

function createFilteredReducer(reducerFunction, reducerPredicate, initialStateIn) {
  return (state, action) => {
    const isInitializationCall = state === undefined;
    if (isInitializationCall) action = { type: '', payload: initialStateIn }; // AWFUL !!!

    const shouldRunWrappedReducer = reducerPredicate(action) || isInitializationCall;

    return shouldRunWrappedReducer
      ? reducerFunction(isInitializationCall ? initialStateIn : state, action)
      : state;
  };
}

/*
export function commonReducer(state = initialState, action) {
  return produce(state, (draft) => {
    switch (action.type) {
      case UPDATE_IS_PLAYING:
        draft.isPlaying = action.isPlaying;
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
      case UPDATE_SELECTED_TRAIN:
        draft.selectedTrain = action.selectedTrain;
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
        const currentTimePosition = state.timePosition
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

        // ADAPT Simulation
        //console.log(currentTimePosition)
        //console.log(action.timePosition)

        //draft.positionValues = action.positionValues ? action.positionValues : positionsValues;
        break;
      }
    }
  });
}
*/

export default combineReducers(produce, {
  chart: createFilteredReducer(
    createReducerWithInitialState,
    (action) => action.type.endsWith('_CHART'),
    null
  ),
  chartXGEV: createFilteredReducer(
    createReducerWithInitialState,
    (action) => action.type.endsWith('_CHARTXGEV'),
    null
  ),
  contextMenu: createFilteredReducer(
    createReducerWithInitialState,
    (action) => action.type.endsWith('_CONTEXTMENU'),
    null
  ),
  hoverPosition: createFilteredReducer(
    createReducerWithInitialState,
    (action) => action.type.endsWith('_HOVER_POSITION'),
    null
  ),
  isPlaying: createFilteredReducer(
    createReducerWithInitialState,
    (action) => action.type.endsWith('_IS_PLAYING'),
    false
  ),
  allowancesSettings: createFilteredReducer(
    createReducerWithInitialState,
    (action) => action.type.endsWith('_ALLOWANCES_SETTINGS'),
    null
  ),
  mustRedraw: createFilteredReducer(
    createReducerWithInitialState,
    (action) => action.type.endsWith('_MUST_REDRAW'),
    true
  ),
  selectedProjection: createFilteredReducer(
    createReducerWithInitialState,
    (action) => action.type.endsWith('_SELECTED_PROJECTION'),
    null
  ),
  selectedTrain: createFilteredReducer(
    createReducerWithInitialState,
    (action) => action.type.endsWith('_SELECTED_TRAIN'),
    0
  ),
  stickyBar: createFilteredReducer(
    createReducerWithInitialState,
    (action) => action.type.endsWith('_STICKYBAR'),
    true
  ),
  timePosition: createFilteredReducer(
    timePosition,
    (action) =>
      action.type.endsWith('_TIME_POSITION') || action.type.endsWith('_TIME_POSITION_VALUES'), // improve predicate
    null
  ),
  speedSpaceSettings,
  simulation,
  positionValues,
});

// Functions
export function updateChart(chart) {
  return (dispatch) => {
    dispatch({
      type: UPDATE_CHART,
      payload: chart,
    });
  };
}
export function updateChartXGEV(chartXGEV) {
  return (dispatch) => {
    dispatch({
      type: UPDATE_CHARTXGEV,
      payload: chartXGEV,
    });
  };
}
export function updateHoverPosition(hoverPosition) {
  return (dispatch) => {
    dispatch({
      type: UPDATE_HOVER_POSITION,
      payload: hoverPosition,
    });
  };
}
export function updateContextMenu(contextMenu) {
  return (dispatch) => {
    dispatch({
      type: UPDATE_CONTEXTMENU,
      payload: contextMenu,
    });
  };
}
export function updateIsPlaying(isPlaying) {
  return (dispatch) => {
    dispatch({
      type: UPDATE_IS_PLAYING,
      payload: isPlaying,
    });
  };
}
export function updateAllowancesSettings(allowancesSettings) {
  return (dispatch) => {
    dispatch({
      type: UPDATE_ALLOWANCES_SETTINGS,
      payload: allowancesSettings,
    });
  };
}
export function updateMustRedraw(mustRedraw) {
  return (dispatch) => {
    dispatch({
      type: UPDATE_MUST_REDRAW,
      payload: mustRedraw,
    });
  };
}

export function updateSelectedProjection(selectedProjection) {
  return (dispatch) => {
    dispatch({
      type: UPDATE_SELECTED_PROJECTION,
      payload: selectedProjection,
    });
  };
}
export function updateSelectedTrain(selectedTrain) {
  return (dispatch) => {
    dispatch({
      type: UPDATE_SELECTED_TRAIN,
      payload: selectedTrain,
    });
  };
}

export function updateStickyBar(stickyBar) {
  return (dispatch) => {
    dispatch({
      type: UPDATE_STICKYBAR,
      payload: stickyBar,
    });
  };
}
export function updateTimePosition(timePosition) {
  return (dispatch) => {
    dispatch({
      type: UPDATE_TIME_POSITION,
      payload: timePosition,
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
