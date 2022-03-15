import { LIST_VALUES_NAME_SPACE_TIME } from '../applications/osrd/components/Simulation/consts';
//import { combineReducers } from 'redux-immer';
import {
  interpolateOnTime,
} from '../applications/osrd/components/Helpers/ChartHelpers';
import positionValues from './osrdsimulation/positionValues';
import produce from 'immer';
/* eslint-disable default-case */
import simulation from './osrdsimulation/simulation';
import speedSpaceSettings from './osrdsimulation/speedSpaceSettings';

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
export const UPDATE_POSITION_VALUES = 'osrdsimu/UPDATE_POSITION_VALUES';
export const UPDATE_SELECTED_PROJECTION = 'osrdsimu/UPDATE_SELECTED_PROJECTION';
export const UPDATE_SELECTED_TRAIN = 'osrdsimu/UPDATE_SELECTED_TRAIN';

export const UPDATE_SPEEDSPACE_SETTINGS = 'osrdsimu/UPDATE_SPEEDSPACE_SETTINGS';
export const UPDATE_STICKYBAR = 'osrdsimu/UPDATE_STICKYBAR';
export const UPDATE_TIME_POSITION = 'osrdsimu/UPDATE_TIME_POSITION';
export const UPDATE_TIME_POSITION_VALUES = 'osrdsimu/UPDATE_TIME_POSITION_VALUES';
export const UPDATE_CONSOLIDATED_SIMULATION = 'osrdsimu/UPDATE_CONSOLIDATED_SIMULATION';


// Reducer
export const initialState = {
  chart: null,
  chartXGEV: null,
  contextMenu: null,
  hoverPosition: null,
  isPlaying: false,
  allowancesSettings: null,
  mustRedraw: true,
  selectedProjection: null,
  selectedTrain: 0,
  stickyBar: true,
  timePosition: null,
  consolidatedSimulation: [],
};

/*
export default function reducer(state = initialState, action) {
  return produce(state, (draft) => {
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
        break;
      case UPDATE_SIMULATION:
        draft.simulation = action.simulation;
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

function createReducerWithInitialState(state = initialState, action) {
  console.log("ENTER createReducerWithInitialState", action);
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

function genericReducerImmer(state, action, initialState, predicate) {
  return produce(state, (draft) => {
    draft = action.payload
  })
}

function genericReducer(state, action, initialState, predicate) {
  if(action.type.endsWith(predicate)) return action.payload;
  return initialState
}
  /*
  return produce(state, (draft) => {
    draft = action.payload
  })
  */
 /*
 if(action.type.endsWith(predicate)) return action.payload

}
*/

export default function reducer(state = initialState, action) {
  return {
    selectedTrain: genericReducer(state.selectedTrain, action, 0, '_SELECTED_TRAIN'),
    selectedProjection: genericReducer(state.selectedProjection, action, initialState.selectedProjection, '_SELECTED_PROJECTION'),
    chart: genericReducer(state.chart, action, initialState.chart, '_CHART'),
    chartXGEV: genericReducer(state.chartXGEV, action, initialState.chartXGEV, '_CHARTXGEV'),
    contextMenu: genericReducer(state.contextMenu, action, initialState.contextMenu, '_CONTEXTMENU'),
    hoverPosition: genericReducer(state.hoverPosition, action, initialState.hoverPosition, '_HOVER_POSITION'),
    allowancesSettings: genericReducer(state.allowancesSettings, action, initialState.allowancesSettings, '_ALLOWANCES_SETTINGS'),
    isPlaying: genericReducer(state.isPlaying, action, initialState.isPlaying, '_IS_PLAYING'),
    mustRedraw: genericReducer(state.mustRedraw, action, initialState.mustRedraw, '_MUST_REDRAW'),
    stickyBar: genericReducer(state.stickyBar, action, initialState.stickyBar, '_STICKYBAR'),
    consolidatedSimulation: genericReducer(state.consolidatedSimulation, action, initialState.consolidatedSimulation, '_CONSOLIDATED_SIMULATION'),
    timePosition: timePosition(state.timePosition, action),
    /*,
    chartXGEV: createFilteredReducer(
      createReducerWithInitialState,
      (action) => action.type.endsWith('_CHARTXGEV'),
      null
    ),
    contextMenu: produce(createFilteredReducer(
      createReducerWithInitialState,
      (action) => action.type.endsWith('_CONTEXTMENU'),
      null
    )),
    hoverPosition: produce(createFilteredReducer(
      createReducerWithInitialState,
      (action) => action.type.endsWith('_HOVER_POSITION'),
      null
    )),
    isPlaying: produce(createFilteredReducer(
      createReducerWithInitialState,
      (action) => action.type.endsWith('_IS_PLAYING'),
      false
    )),
    allowancesSettings: produce(createFilteredReducer(
      createReducerWithInitialState,
      (action) => action.type.endsWith('_ALLOWANCES_SETTINGS'),
      null
    )),
    mustRedraw: produce(createFilteredReducer(
      createReducerWithInitialState,
      (action) => action.type.endsWith('_MUST_REDRAW'),
      true
    )),
    selectedProjection: produce(createFilteredReducer(
      createReducerWithInitialState,
      (action) => action.type.endsWith('_SELECTED_PROJECTION'),
      null
    )),
    selectedTrain: produce(createFilteredReducer(
      createReducerWithInitialState,
      (action) => action.type.endsWith('_SELECTED_TRAIN'),
      0
    )),
    stickyBar: produce(createFilteredReducer(
      createReducerWithInitialState,
      (action) => action.type.endsWith('_STICKYBAR'),
      true
    )),
    timePosition: produce(createFilteredReducer(
      timePosition,
      (action) =>
        action.type.endsWith('_TIME_POSITION') || action.type.endsWith('_TIME_POSITION_VALUES'), // improve predicate
      null
    )),
    */
    speedSpaceSettings: speedSpaceSettings(state.speedSpaceSettings, action, state),
    simulation: simulation(state.simulation, action),
    positionValues: positionValues(state.positionValues, action)
  }};
/*
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
*/
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
export function updateContextMenu(contextMenu) {
  return (dispatch) => {
    dispatch({
      type: UPDATE_CONTEXTMENU,
      payload: contextMenu,
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
/*
export function updatePositionValues(positionValues) {
  return (dispatch) => {
    dispatch({
      type: UPDATE_POSITION_VALUES,
      positionValues,
    });
  };
}
*/
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
