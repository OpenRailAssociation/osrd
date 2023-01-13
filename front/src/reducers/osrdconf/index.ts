import produce from 'immer';
import { AnyAction, Dispatch } from 'redux';

import {
  DEFAULT_MODE,
  DEFAULT_STDCM_MODE,
  OsrdConfState,
  PointOnMap,
} from 'applications/operationalStudies/consts';
import { formatIsoDate } from 'utils/date';
import { sec2time, time2sec } from 'utils/timeManipulation';

import { getSwitchTypes } from 'applications/editor/data/api';
/* eslint-disable default-case */

// Action Types
export const UPDATE_MODE = 'osrdconf/UPDATE_MODE';
export const UPDATE_STDCM_MODE = 'osrdconf/UPDATE_STDCM_MODE';
export const UPDATE_NAME = 'osrdconf/UPDATE_NAME';
export const UPDATE_LABELS = 'osrdconf/UPDATE_LABELS';
export const UPDATE_INFRA_ID = 'osrdconf/UPDATE_INFRA_ID';
export const UPDATE_SWITCH_TYPES = 'osrdconf/UPDATE_SWITCH_TYPES';
export const UPDATE_PATHFINDING_ID = 'osrdconf/UPDATE_PATHFINDING_ID';
export const UPDATE_TIMETABLE_ID = 'osrdconf/UPDATE_TIMETABLE_ID';
export const UPDATE_ROLLINGSTOCK_ID = 'osrdconf/UPDATE_ROLLINGSTOCK_ID';
export const UPDATE_ROLLINGSTOCK_COMFORT = 'osrdconf/UPDATE_ROLLINGSTOCK_COMFORT';
export const UPDATE_SPEED_LIMIT_BY_TAG = 'osrdconf/UPDATE_SPEED_LIMIT_BY_TAG';
export const UPDATE_ORIGIN = 'osrdconf/UPDATE_ORIGIN';
export const UPDATE_ORIGIN_SPEED = 'osrdconf/UPDATE_ORIGIN_SPEED';
export const UPDATE_ORIGIN_TIME = 'osrdconf/UPDATE_ORIGIN_TIME';
export const UPDATE_ORIGIN_DATE = 'osrdconf/UPDATE_ORIGIN_DATE';
export const UPDATE_ORIGIN_UPPER_BOUND_DATE = 'osrdconf/UPDATE_ORIGIN_UPPER_BOUND_DATE';
export const UPDATE_ORIGIN_UPPER_BOUND_TIME = 'osrdconf/UPDATE_ORIGIN_UPPER_BOUND_TIME';
export const TOGGLE_ORIGIN_LINKED_BOUNDS = 'osrdconf/TOGGLE_ORIGIN_LINKED_BOUNDS';
export const REPLACE_VIAS = 'osrdconf/REPLACE_VIAS';
export const UPDATE_VIAS = 'osrdconf/UPDATE_VIAS';
export const UPDATE_VIA_STOPTIME = 'osrdconf/UPDATE_VIA_STOPTIME';
export const PERMUTE_VIAS = 'osrdconf/PERMUTE_VIAS';
export const UPDATE_SUGGERED_VIAS = 'osrdconf/UPDATE_SUGGERED_VIAS';
export const DELETE_VIAS = 'osrdconf/DELETE_VIAS';
export const DELETE_ITINERARY = 'osrdconfDELETE_ITINERARY';
export const UPDATE_DESTINATION = 'osrdconf/UPDATE_DESTINATION';
export const UPDATE_DESTINATION_TIME = 'osrdconf/UPDATE_UPDATE_DESTINATION_TIME';
export const UPDATE_DESTINATION_DATE = 'osrdconf/UPDATE_UPDATE_DESTINATION_DATE';
export const UPDATE_TRAINCOMPO = 'osrdconf/UPDATE_TRAINCOMPO';
export const UPDATE_ITINERARY = 'osrdconf/UPDATE_ITINERARY';
export const UPDATE_FEATURE_INFO_CLICK_OSRD = 'osrdconf/UPDATE_FEATURE_INFO_CLICK_OSRD';
export const UPDATE_GRID_MARGIN_BEFORE = 'osrdconf/UPDATE_GRID_MARGIN_BEFORE';
export const UPDATE_GRID_MARGIN_AFTER = 'osrdconf/UPDATE_GRID_MARGIN_AFTER';
export const UPDATE_STANDARD_STDCM_ALLOWANCE = 'osrdconf/UPDATE_STANDARD_STDCM_ALLOWANCE';

// Reducer
export const initialState: OsrdConfState = {
  name: '',
  mode: DEFAULT_MODE,
  stdcmMode: DEFAULT_STDCM_MODE,
  labels: [],
  infraID: undefined,
  switchTypes: undefined,
  pathfindingID: undefined,
  timetableID: undefined,
  rollingStockID: undefined,
  rollingStockComfort: 'STANDARD',
  speedLimitByTag: undefined,
  origin: undefined,
  originSpeed: 0,
  originDate: formatIsoDate(new Date()),
  originTime: undefined,
  originUpperBoundDate: formatIsoDate(new Date()),
  originUpperBoundTime: undefined,
  originLinkedBounds: true,
  destination: undefined,
  destinationDate: formatIsoDate(new Date()),
  destinationTime: undefined,
  vias: [],
  suggeredVias: [],
  trainCompo: undefined,
  geojson: [],
  featureInfoClick: { displayPopup: false },
  gridMarginBefore: 0,
  gridMarginAfter: 0,
  standardStdcmAllowance: undefined
};

const ORIGIN_TIME_BOUND_DEFAULT_DIFFERENCE = 7200;

export default function reducer(inputState: OsrdConfState | undefined, action: AnyAction) {
  const state = inputState || initialState;
  return produce(state, (draft) => {
    switch (action.type) {
      case UPDATE_MODE:
        draft.mode = action.mode;
        break;
      case UPDATE_STDCM_MODE:
        draft.stdcmMode = action.stdcmMode;
        break;
      case UPDATE_NAME:
        draft.name = action.name;
        break;
      case UPDATE_LABELS:
        draft.labels = action.labels;
        break;
      case UPDATE_INFRA_ID:
        draft.infraID = action.infraID;
        break;
      case UPDATE_SWITCH_TYPES:
        draft.switchTypes = action.switchTypes;
        break;
      case UPDATE_PATHFINDING_ID:
        draft.pathfindingID = action.pathfindingID;
        break;
      case UPDATE_TIMETABLE_ID:
        draft.timetableID = action.timetableID;
        break;
      case UPDATE_ROLLINGSTOCK_ID:
        draft.rollingStockID = action.rollingStockID;
        break;
      case UPDATE_ROLLINGSTOCK_COMFORT:
        draft.rollingStockComfort = action.rollingStockComfort;
        break;
      case UPDATE_SPEED_LIMIT_BY_TAG:
        draft.speedLimitByTag = action.speedLimitByTag;
        break;
      case UPDATE_ORIGIN:
        draft.origin = action.origin;
        break;
      case UPDATE_ORIGIN_SPEED:
        draft.originSpeed = action.originSpeed;
        break;
      case UPDATE_ORIGIN_TIME: {
        const newOriginTimeSeconds = time2sec(action.originTime);
        if (draft.originLinkedBounds) {
          const difference =
            draft.originTime && draft.originUpperBoundTime
              ? time2sec(draft.originUpperBoundTime) - time2sec(draft.originTime)
              : ORIGIN_TIME_BOUND_DEFAULT_DIFFERENCE;
          draft.originUpperBoundTime = sec2time(newOriginTimeSeconds + difference);
        }
        if (
          draft.originUpperBoundTime &&
          time2sec(action.originTime) > time2sec(draft.originUpperBoundTime)
        ) {
          draft.originTime = draft.originUpperBoundTime;
        } else {
          draft.originTime = action.originTime;
        }
        break;
      }
      case UPDATE_ORIGIN_UPPER_BOUND_TIME: {
        const newOriginUpperBoundTimeSeconds = time2sec(action.originUpperBoundTime);
        if (draft.originLinkedBounds) {
          const difference =
            draft.originTime && draft.originUpperBoundTime
              ? time2sec(draft.originUpperBoundTime) - time2sec(draft.originTime)
              : ORIGIN_TIME_BOUND_DEFAULT_DIFFERENCE;
          draft.originTime = sec2time(newOriginUpperBoundTimeSeconds - difference);
        }
        if (
          draft.originTime &&
          time2sec(action.originUpperBoundTime) < time2sec(draft.originTime)
        ) {
          draft.originUpperBoundTime = draft.originTime;
        } else {
          draft.originUpperBoundTime = action.originUpperBoundTime;
        }
        break;
      }
      case TOGGLE_ORIGIN_LINKED_BOUNDS:
        draft.originLinkedBounds = !draft.originLinkedBounds;
        break;
      case UPDATE_ORIGIN_DATE:
        draft.originDate = action.originDate;
        break;
      case UPDATE_ORIGIN_UPPER_BOUND_DATE:
        draft.originUpperBoundDate = action.originUpperBoundDate;
        break;
      case REPLACE_VIAS:
        draft.vias = action.vias;
        break;
      case UPDATE_VIAS:
        draft.vias.push(action.vias);
        break;
      case UPDATE_VIA_STOPTIME:
        draft.vias = action.vias;
        break;
      case PERMUTE_VIAS:
        draft.vias = action.vias;
        break;
      case UPDATE_SUGGERED_VIAS:
        draft.suggeredVias = action.suggeredVias;
        break;
      case DELETE_VIAS:
        draft.vias.splice(action.index, 1);
        break;
      case DELETE_ITINERARY:
        draft.origin = undefined;
        draft.vias = [];
        draft.destination = undefined;
        draft.geojson = [];
        draft.originTime = undefined;
        draft.pathfindingID = undefined;
        break;
      case UPDATE_DESTINATION:
        draft.destination = action.destination;
        break;
      case UPDATE_DESTINATION_DATE:
        draft.destinationDate = action.destinationDate;
        break;
      case UPDATE_DESTINATION_TIME:
        draft.destinationTime = action.destinationTime;
        break;
      case UPDATE_TRAINCOMPO:
        draft.trainCompo = action.trainCompo;
        break;
      case UPDATE_ITINERARY:
        draft.geojson = action.geojson;
        break;
      case UPDATE_FEATURE_INFO_CLICK_OSRD:
        draft.featureInfoClick = action.featureInfoClick;
        break;
      case UPDATE_GRID_MARGIN_BEFORE:
        draft.gridMarginBefore = action.gridMarginBefore;
        break;
      case UPDATE_GRID_MARGIN_AFTER:
        draft.gridMarginAfter = action.gridMarginAfter;
        break;
      case UPDATE_STANDARD_STDCM_ALLOWANCE:
        draft.standardStdcmAllowance = action.standardStdcmAllowance;
        break;
    }
  });
}

// Functions
export function updateName(name: any) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_NAME,
      name,
    });
  };
}
export function updateMode(mode: any) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_MODE,
      mode,
    });
  };
}
export function updateStdcmMode(stdcmMode: any) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_STDCM_MODE,
      stdcmMode,
    });
  };
}
export function updateLabels(labels: any) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_LABELS,
      labels,
    });
  };
}
export function updateSwitchTypes(switchTypes: any) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_SWITCH_TYPES,
      switchTypes,
    });
  };
}
export function updateInfraID(infraID: any) {
  return async (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_INFRA_ID,
      infraID,
    });
    dispatch(updateSwitchTypes({}));

    try {
      const newSwitchTypes = await getSwitchTypes(infraID);
      dispatch(updateSwitchTypes(newSwitchTypes));
    } catch (e) {
      console.log('error on switch type retrieval', e);
    }
  };
}
export function updatePathfindingID(pathfindingID: any) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_PATHFINDING_ID,
      pathfindingID,
    });
  };
}
export function updateTimetableID(timetableID: any) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_TIMETABLE_ID,
      timetableID,
    });
  };
}
export function updateRollingStockID(rollingStockID: number) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_ROLLINGSTOCK_ID,
      rollingStockID,
    });
  };
}
export function updateRollingStockComfort(rollingStockComfort: string) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_ROLLINGSTOCK_COMFORT,
      rollingStockComfort,
    });
  };
}
export function updateSpeedLimitByTag(speedLimitByTag: any) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_SPEED_LIMIT_BY_TAG,
      speedLimitByTag,
    });
  };
}
export function updateOrigin(origin: any) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_ORIGIN,
      origin,
    });
  };
}
export function updateOriginSpeed(originSpeed: any) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_ORIGIN_SPEED,
      originSpeed,
    });
  };
}
export function updateOriginTime(originTime: string) {
  return {
    type: UPDATE_ORIGIN_TIME,
    originTime,
  };
}
export function updateOriginDate(originDate: string) {
  return {
    type: UPDATE_ORIGIN_DATE,
    originDate,
  };
}

export function updateOriginUpperBoundTime(originUpperBoundTime: string) {
  return {
    type: UPDATE_ORIGIN_UPPER_BOUND_TIME,
    originUpperBoundTime,
  };
}

export function toggleOriginLinkedBounds() {
  return {
    type: TOGGLE_ORIGIN_LINKED_BOUNDS,
  };
}

export function updateOriginUpperBoundDate(originUpperBoundDate: string) {
  return {
    type: UPDATE_ORIGIN_UPPER_BOUND_DATE,
    originUpperBoundDate,
  };
}

export function replaceVias(vias: any) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: REPLACE_VIAS,
      vias,
    });
  };
}
export function updateVias(vias: any) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_VIAS,
      vias,
    });
  };
}
export function permuteVias(vias: any, from: any, to: any) {
  const newVias = Array.from(vias); // Copy of vias to permit modification
  const item = newVias.slice(from, from + 1); // Get item to permute
  newVias.splice(from, 1); // Remove it from array
  newVias.splice(to, 0, item[0]); // Replace to right position

  return (dispatch: Dispatch) => {
    dispatch({
      type: PERMUTE_VIAS,
      vias: newVias,
    });
  };
}
export function updateSuggeredVias(suggeredVias: any) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_SUGGERED_VIAS,
      suggeredVias,
    });
  };
}
export function updateViaStopTime(vias: PointOnMap[], index: number, value: number) {
  const newVias = Array.from(vias); // Copy of vias to permit modification
  newVias[index] = { ...newVias[index], duration: value };
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_VIA_STOPTIME,
      vias: newVias,
    });
  };
}
export function deleteVias(index: any) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: DELETE_VIAS,
      index,
    });
  };
}
export function updateDestination(destination: any) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_DESTINATION,
      destination,
    });
  };
}
export function updateDestinationTime(destinationTime: any) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_DESTINATION_TIME,
      destinationTime,
    });
  };
}
export function updateDestinationDate(destinationDate: any) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_DESTINATION_DATE,
      destinationDate,
    });
  };
}
export function updateTrainCompo(trainCompo: any) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_TRAINCOMPO,
      trainCompo,
    });
  };
}
export function updateItinerary(geojson: any) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_ITINERARY,
      geojson,
    });
  };
}
export function updateFeatureInfoClickOSRD(featureInfoClick: OsrdConfState['featureInfoClick']) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_FEATURE_INFO_CLICK_OSRD,
      featureInfoClick,
    });
  };
}
export function updateGridMarginBefore(gridMarginBefore: OsrdConfState['gridMarginBefore']) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_GRID_MARGIN_BEFORE,
      gridMarginBefore,
    });
  };
}
export function updateGridMarginAfter(gridMarginAfter: OsrdConfState['gridMarginAfter']) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_GRID_MARGIN_AFTER,
      gridMarginAfter,
    });
  };
}
export function updateStdcmStandardAllowance(
  standardStdcmAllowance: OsrdConfState['standardStdcmAllowance']
) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_STANDARD_STDCM_ALLOWANCE,
      standardStdcmAllowance,
    });
  };
}
export function deleteItinerary() {
  return (dispatch: Dispatch) => {
    dispatch({
      type: DELETE_ITINERARY,
    });
  };
}

// Give this function a whole OSRDConf state:
export function bootstrapOSRDConf(infraID: number) {
  return (dispatch: Dispatch) => {
    dispatch(updateInfraID(infraID));
  };
}
