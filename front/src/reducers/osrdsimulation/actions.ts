import { Dispatch } from 'redux';
import { SimulationSnapshot, OsrdSimulationState, Chart } from './types';

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
export const UPDATE_SIGNAL_BASE = 'osrdsimu/UPDATE_SIGNAL_BASE';
export const UPDATE_TIME_POSITION = 'osrdsimu/UPDATE_TIME_POSITION';
export const UPDATE_TIME_POSITION_VALUES = 'osrdsimu/UPDATE_TIME_POSITION_VALUES';
export const UPDATE_CONSOLIDATED_SIMULATION = 'osrdsimu/UPDATE_CONSOLIDATED_SIMULATION';
export const UPDATE_DEPARTURE_ARRIVAL_TIMES = 'osrdsimu/UPDATE_DEPARTURE_ARRIVAL_TIMES';

// Functions

export function updateChart(chart: Chart) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_CHART,
      chart,
    });
  };
}
export function updateChartXGEV(chartXGEV: OsrdSimulationState['chartXGEV']) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_CHARTXGEV,
      chartXGEV,
    });
  };
}
export function updateContextMenu(contextMenu: OsrdSimulationState['contextMenu']) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_CONTEXTMENU,
      contextMenu,
    });
  };
}
export function updateHoverPosition(hoverPosition: OsrdSimulationState['hoverPosition']) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_HOVER_POSITION,
      hoverPosition,
    });
  };
}
export function updateIsPlaying(isPlaying: OsrdSimulationState['isPlaying']) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_IS_PLAYING,
      isPlaying,
    });
  };
}
export function updateAllowancesSettings(
  allowancesSettings: OsrdSimulationState['allowancesSettings']
) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_ALLOWANCES_SETTINGS,
      allowancesSettings,
    });
  };
}
export function updateMustRedraw(mustRedraw: OsrdSimulationState['mustRedraw']) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_MUST_REDRAW,
      mustRedraw,
    });
  };
}
export function updatePositionValues(positionValues: OsrdSimulationState['positionValues']) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_POSITION_VALUES,
      positionValues,
    });
  };
}
export function updateSelectedProjection(
  selectedProjection: OsrdSimulationState['selectedProjection']
) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_SELECTED_PROJECTION,
      selectedProjection,
    });
  };
}
export function updateSelectedTrain(selectedTrain: OsrdSimulationState['selectedTrain']) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_SELECTED_TRAIN,
      selectedTrain,
    });
  };
}
export function updateSimulation(simulation: SimulationSnapshot) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_SIMULATION,
      simulation,
    });
  };
}
export function updateSpeedSpaceSettings(
  speedSpaceSettings: OsrdSimulationState['speedSpaceSettings']
) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_SPEEDSPACE_SETTINGS,
      speedSpaceSettings,
    });
  };
}
export function updateSignalBase(signalBase: OsrdSimulationState['signalBase']) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_SIGNAL_BASE,
      signalBase,
    });
  };
}
export function updateTimePosition(timePosition: OsrdSimulationState['timePosition']) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_TIME_POSITION,
      timePosition,
    });
  };
}
export function updateDepartureArrivalTimes(
  newDepartureArrivalTimes: OsrdSimulationState['departureArrivalTimes']
) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_DEPARTURE_ARRIVAL_TIMES,
      departureArrivalTimes: newDepartureArrivalTimes,
    });
  };
}
export function updateConsolidatedSimulation(
  consolidatedSimulation: OsrdSimulationState['consolidatedSimulation']
) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_CONSOLIDATED_SIMULATION,
      consolidatedSimulation,
    });
  };
}
export function updateTimePositionValues(timePosition: OsrdSimulationState['timePosition']) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_TIME_POSITION_VALUES,
      timePosition,
    });
  };
}
