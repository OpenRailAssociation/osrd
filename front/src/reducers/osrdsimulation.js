/* eslint-disable default-case */
import produce from 'immer';

// Action Types
export const UPDATE_CHART = 'osrdsimu/UPDATE_CHART';
export const UPDATE_CHARTXGEV = 'osrdsimu/UPDATE_CHARTXGEV';
export const UPDATE_CONTEXTMENU = 'osrdsimu/UPDATE_CONTEXTMENU';
export const UPDATE_HOVER_POSITION = 'osrdsimu/UPDATE_HOVER_POSITION';
export const UPDATE_IS_PLAYING = 'osrdsimu/UPDATE_IS_PLAYING';
export const UPDATE_MARGINS_SETTINGS = 'osrdsimu/UPDATE_MARGINS_SETTINGS';
export const UPDATE_MUST_REDRAW = 'osrdsimu/UPDATE_MUST_REDRAW';
export const UPDATE_POSITION_VALUES = 'osrdsimu/UPDATE_POSITION_VALUES';
export const UPDATE_SELECTED_PROJECTION = 'osrdsimu/UPDATE_SELECTED_PROJECTION';
export const UPDATE_SELECTED_TRAIN = 'osrdsimu/UPDATE_SELECTED_TRAIN';
export const UPDATE_SIMULATION = 'osrdsimu/UPDATE_SIMULATION';
export const UPDATE_SPEEDSPACE_SETTINGS = 'osrdsimu/UPDATE_SPEEDSPACE_SETTINGS';
export const UPDATE_STICKYBAR = 'osrdsimu/UPDATE_STICKYBAR';
export const UPDATE_TIME_POSITION = 'osrdsimu/UPDATE_TIME_POSITION';

// Reducer
export const initialState = {
  chart: undefined,
  chartXGEV: undefined,
  contextMenu: undefined,
  hoverPosition: undefined,
  isPlaying: false,
  marginsSettings: undefined,
  mustRedraw: true,
  positionValues: {
    headPosition: 0,
    tailPosition: 0,
    routeEndOccupancy: 0,
    routeBeginOccupancy: 0,
  },
  selectedProjection: undefined,
  selectedTrain: 0,
  simulation: {
    trains: [],
  },
  speedSpaceSettings: undefined,
  stickyBar: true,
  timePosition: undefined,
};

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
      case UPDATE_MARGINS_SETTINGS:
        draft.marginsSettings = action.marginsSettings;
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
export function updateMarginsSettings(marginsSettings) {
  return (dispatch) => {
    dispatch({
      type: UPDATE_MARGINS_SETTINGS,
      marginsSettings,
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
