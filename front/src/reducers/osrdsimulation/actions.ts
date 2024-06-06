import type { Dispatch } from 'redux';

import type { ChartSynchronizer } from 'modules/simulationResult/components/ChartSynchronizer';
import type { GetState } from 'store';

import type { SimulationSnapshot, OsrdSimulationState } from './types';

// Action Types
export const UPDATE_CHART = 'osrdsimu/UPDATE_CHART';
export const UPDATE_HOVER_POSITION = 'osrdsimu/UPDATE_HOVER_POSITION';
export const UPDATE_IS_PLAYING = 'osrdsimu/UPDATE_IS_PLAYING';
export const UPDATE_IS_UPDATING = 'osrdsimu/UPDATE_IS_UPDATING';
export const UPDATE_RELOAD_TIMETABLE = 'osrdsimu/UPDATE_RELOAD_TIMETABLE';
export const UPDATE_ALLOWANCES_SETTINGS = 'osrdsimu/UPDATE_ALLOWANCES_SETTINGS';
export const UPDATE_MUST_REDRAW = 'osrdsimu/UPDATE_MUST_REDRAW';
export const UPDATE_POSITION_VALUES = 'osrdsimu/UPDATE_POSITION_VALUES';
export const UPDATE_SELECTED_PROJECTION = 'osrdsimu/UPDATE_SELECTED_PROJECTION';
export const UPDATE_SELECTED_TRAIN_ID = 'osrdsimu/UPDATE_SELECTED_TRAIN_ID';
export const UPDATE_SIMULATION = 'osrdsimu/UPDATE_SIMULATION';
export const UPDATE_SPEEDSPACE_SETTINGS = 'osrdsimu/UPDATE_SPEEDSPACE_SETTINGS';
export const UPDATE_SIGNAL_BASE = 'osrdsimu/UPDATE_SIGNAL_BASE';
export const UPDATE_TIME_POSITION = 'osrdsimu/UPDATE_TIME_POSITION';
export const UPDATE_TIME_POSITION_VALUES = 'osrdsimu/UPDATE_TIME_POSITION_VALUES';
export const UPDATE_CONSOLIDATED_SIMULATION = 'osrdsimu/UPDATE_CONSOLIDATED_SIMULATION';
export const UNDO_SIMULATION = 'osrdsimu/UNDO_SIMULATION';
export const REDO_SIMULATION = 'osrdsimu/REDO_SIMULATION';
export const UPDATE_TRAIN_ID_USED_FOR_PROJECTION = 'osrdsimu/UPDATE_TRAIN_ID_USED_FOR_PROJECTION';

// Functions

export function updateIsPlaying(isPlaying: OsrdSimulationState['isPlaying']) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_IS_PLAYING,
      isPlaying,
    });
  };
}
export function updateIsUpdating(isUpdating: OsrdSimulationState['isUpdating']) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_IS_UPDATING,
      isUpdating,
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

export function updateSelectedTrainId(selectedTrainId: OsrdSimulationState['selectedTrainId']) {
  return (dispatch: Dispatch, _: GetState, chartSynchronizer: ChartSynchronizer) => {
    chartSynchronizer.computePositionValues(selectedTrainId);
    dispatch({
      type: UPDATE_SELECTED_TRAIN_ID,
      selectedTrainId,
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

export function undoSimulation() {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UNDO_SIMULATION,
    });
  };
}

export function redoSimulation() {
  return (dispatch: Dispatch) => {
    dispatch({
      type: REDO_SIMULATION,
    });
  };
}

export function updateTrainIdUsedForProjection(
  trainIdUsedForProjection: OsrdSimulationState['trainIdUsedForProjection']
) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_TRAIN_ID_USED_FOR_PROJECTION,
      trainIdUsedForProjection,
    });
  };
}
