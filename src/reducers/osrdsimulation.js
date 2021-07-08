/* eslint-disable default-case */
import produce from 'immer';

// Action Types
export const UPDATE_CHART = 'osrdsimu/UPDATE_CHART';
export const UPDATE_SIMULATION = 'osrdsimu/UPDATE_SIMULATION';
export const UPDATE_HOVER_POSITION = 'osrdsimu/UPDATE_HOVER_POSITION';
export const UPDATE_TIME_POSITION = 'osrdsimu/UPDATE_TIME_POSITION';
export const TOGGLE_WORKINGSTATUS = 'osrdsimu/TOGGLE_WORKINGSTATUS';

// Reducer
export const initialState = {
  chart: undefined,
  hoverPosition: undefined,
  isWorking: false,
  simulationRaw: undefined,
  timePosition: undefined,
};

export default function reducer(state = initialState, action) {
  return produce(state, (draft) => {
    switch (action.type) {
      case UPDATE_CHART:
        draft.chart = action.chart;
        break;
      case UPDATE_HOVER_POSITION:
        draft.hoverPosition = action.hoverPosition;
        break;
      case UPDATE_SIMULATION:
        draft.simulationRaw = action.simulationRaw;
        break;
      case UPDATE_TIME_POSITION:
        draft.timePosition = action.timePosition;
        break;
      case TOGGLE_WORKINGSTATUS:
        draft.isWorking = action.isWorking;
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
export function updateHoverPosition(hoverPosition) {
  return (dispatch) => {
    dispatch({
      type: UPDATE_HOVER_POSITION,
      hoverPosition,
    });
  };
}
export function updateSimulation(simulationRaw) {
  return (dispatch) => {
    dispatch({
      type: UPDATE_SIMULATION,
      simulationRaw,
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
export function toggleWorkingStatus(bool) {
  return (dispatch) => {
    dispatch({
      type: TOGGLE_WORKINGSTATUS,
      isWorking: bool,
    });
  };
}
