import produce from 'immer';
import { AnyAction, Dispatch } from 'redux';
import { omit } from 'lodash';

import {
  MODES,
  DEFAULT_MODE,
  DEFAULT_STDCM_MODE,
  STDCM_MODES,
  OsrdConfState,
  OsrdMultiConfState,
  OsrdStdcmConfState,
  PointOnMap,
} from 'applications/operationalStudies/consts';
import { formatIsoDate } from 'utils/date';
import { ValueOf } from 'utils/types';
import { sec2time, time2sec } from 'utils/timeManipulation';
import { Path, PowerRestrictionRange } from 'common/api/osrdMiddlewareApi';
import { CatenaryRange, osrdEditoastApi } from '../../common/api/osrdEditoastApi';
import { SwitchType, ThunkAction } from '../../types';

/* eslint-disable default-case */

// Action Types
export const UPDATE_MODE = 'osrdconf/UPDATE_MODE';
export const UPDATE_STDCM_MODE = 'osrdconf/UPDATE_STDCM_MODE';
export const UPDATE_NAME = 'osrdconf/UPDATE_NAME';
export const UPDATE_TRAIN_COUNT = 'osrdconf/UPDATE_TRAIN_COUNT';
export const UPDATE_TRAIN_DELTA = 'osrdconf/UPDATE_TRAIN_DELTA';
export const UPDATE_TRAIN_STEP = 'osrdconf/UPDATE_TRAIN_STEP';
export const TOGGLE_USING_ELECTRICAL_PROFILES = 'osrdconf/TOGGLE_USING_ELECTRICAL_PROFILES';
export const UPDATE_LABELS = 'osrdconf/UPDATE_LABELS';
export const UPDATE_PROJECT_ID = 'osrdconf/UPDATE_PROJECT_ID';
export const UPDATE_STUDY_ID = 'osrdconf/UPDATE_STUDY_ID';
export const UPDATE_SCENARIO_ID = 'osrdconf/UPDATE_SCENARIO_ID';
export const UPDATE_INFRA_ID = 'osrdconf/UPDATE_INFRA_ID';
export const UPDATE_SWITCH_TYPES = 'osrdconf/UPDATE_SWITCH_TYPES';
export const UPDATE_PATHFINDING_ID = 'osrdconf/UPDATE_PATHFINDING_ID';
export const UPDATE_PATH_WITH_CATENARIES = 'osrdconf/UPDATE_PATH_WITH_CATENARIES';
export const UPDATE_SHOULD_RUN_PATHFINDING = 'osrdconf/UPDATE_SHOULD_RUN_PATHFINDING';
export const UPDATE_TIMETABLE_ID = 'osrdconf/UPDATE_TIMETABLE_ID';
export const UPDATE_ROLLINGSTOCK_ID = 'osrdconf/UPDATE_ROLLINGSTOCK_ID';
export const UPDATE_ROLLINGSTOCK_COMFORT = 'osrdconf/UPDATE_ROLLINGSTOCK_COMFORT';
export const UPDATE_SPEED_LIMIT_BY_TAG = 'osrdconf/UPDATE_SPEED_LIMIT_BY_TAG';
export const UPDATE_ORIGIN = 'osrdconf/UPDATE_ORIGIN';
export const UPDATE_DEPARTURE_TIME = 'osrdconf/UPDATE_DEPARTURE_TIME';
export const UPDATE_INITIAL_SPEED = 'osrdconf/UPDATE_INITIAL_SPEED';
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
export const UPDATE_ITINERARY = 'osrdconf/UPDATE_ITINERARY';
export const UPDATE_FEATURE_INFO_CLICK_OSRD = 'osrdconf/UPDATE_FEATURE_INFO_CLICK_OSRD';
export const UPDATE_GRID_MARGIN_BEFORE = 'osrdconf/UPDATE_GRID_MARGIN_BEFORE';
export const UPDATE_GRID_MARGIN_AFTER = 'osrdconf/UPDATE_GRID_MARGIN_AFTER';
export const UPDATE_STANDARD_STDCM_ALLOWANCE = 'osrdconf/UPDATE_STANDARD_STDCM_ALLOWANCE';
export const UPDATE_POWER_RESTRICTION = 'osrdconf/UPDATE_POWER_RESTRICTION';
export const UPDATE_TRAIN_SCHEDULE_IDS_TO_MODIFY = 'osrdconf/UPDATE_TRAIN_SCHEDULE_IDS_TO_MODIFY';

// Reducer
const defaultCommonConf = {
  name: '',
  trainCount: 1,
  trainDelta: 15,
  trainStep: 2,
  usingElectricalProfiles: true,
  labels: [],
  projectID: undefined,
  studyID: undefined,
  scenarioID: undefined,
  infraID: undefined,
  switchTypes: undefined,
  pathfindingID: undefined,
  timetableID: undefined,
  rollingStockID: undefined,
  rollingStockComfort: 'STANDARD',
  powerRestriction: undefined,
  speedLimitByTag: undefined,
  origin: undefined,
  initialSpeed: 0,
  departureTime: '08:00:00',
  shouldRunPathfinding: true,
  originDate: formatIsoDate(new Date()),
  originTime: '08:00:00',
  originUpperBoundDate: formatIsoDate(new Date()),
  originUpperBoundTime: undefined,
  originLinkedBounds: true,
  destination: undefined,
  destinationDate: formatIsoDate(new Date()),
  destinationTime: undefined,
  vias: [],
  suggeredVias: [],
  trainCompo: undefined,
  geojson: undefined,
  featureInfoClick: { displayPopup: false },
  gridMarginBefore: 0,
  gridMarginAfter: 0,
  trainScheduleIDsToModify: undefined,
};

export const initialState: OsrdMultiConfState = {
  mode: DEFAULT_MODE,
  simulationConf: {
    ...defaultCommonConf,
  },
  stdcmConf: {
    stdcmMode: DEFAULT_STDCM_MODE,
    standardStdcmAllowance: undefined,
    ...defaultCommonConf,
  },
};

const ORIGIN_TIME_BOUND_DEFAULT_DIFFERENCE = 7200;

export default function reducer(inputState: OsrdMultiConfState | undefined, action: AnyAction) {
  const state = inputState || initialState;
  return produce(state, (draft) => {
    type confSections = Omit<OsrdMultiConfState, 'mode'>;
    type SectionKey = keyof confSections;

    const sectionMap: Record<string, SectionKey> = {
      [MODES.simulation]: 'simulationConf',
      [MODES.stdcm]: 'stdcmConf',
    };

    const section: SectionKey = sectionMap[state.mode];

    switch (action.type) {
      case UPDATE_MODE:
        draft.mode = action.mode;
        break;
      case UPDATE_STDCM_MODE:
        draft.stdcmConf.stdcmMode = action.stdcmMode;
        break;
      case UPDATE_NAME:
        draft[section].name = action.name;
        break;
      case UPDATE_TRAIN_COUNT:
        draft[section].trainCount = action.trainCount;
        break;
      case UPDATE_TRAIN_DELTA:
        draft[section].trainDelta = action.trainDelta;
        break;
      case UPDATE_TRAIN_STEP:
        draft[section].trainStep = action.trainStep;
        break;
      case TOGGLE_USING_ELECTRICAL_PROFILES:
        draft[section].usingElectricalProfiles = !draft[section].usingElectricalProfiles;
        break;
      case UPDATE_LABELS:
        draft[section].labels = action.labels;
        break;
      case UPDATE_PROJECT_ID:
        draft[section].projectID = action.projectID;
        break;
      case UPDATE_STUDY_ID:
        draft[section].studyID = action.studyID;
        break;
      case UPDATE_SCENARIO_ID:
        draft[section].scenarioID = action.scenarioID;
        break;
      case UPDATE_INFRA_ID:
        draft[section].infraID = action.infraID;
        break;
      case UPDATE_SWITCH_TYPES:
        draft[section].switchTypes = action.switchTypes;
        break;
      case UPDATE_PATHFINDING_ID:
        draft[section].pathfindingID = action.pathfindingID;
        break;
      case UPDATE_PATH_WITH_CATENARIES:
        draft[section].pathWithCatenaries = action.pathWithCatenaries;
        break;
      case UPDATE_SHOULD_RUN_PATHFINDING:
        draft[section].shouldRunPathfinding = action.shouldRunPathfinding;
        break;
      case UPDATE_TIMETABLE_ID:
        draft[section].timetableID = action.timetableID;
        break;
      case UPDATE_ROLLINGSTOCK_ID:
        draft[section].rollingStockID = action.rollingStockID;
        break;
      case UPDATE_ROLLINGSTOCK_COMFORT:
        draft[section].rollingStockComfort = action.rollingStockComfort;
        break;
      case UPDATE_SPEED_LIMIT_BY_TAG:
        draft[section].speedLimitByTag = action.speedLimitByTag;
        break;
      case UPDATE_ORIGIN:
        draft[section].origin = action.origin;
        break;
      case UPDATE_INITIAL_SPEED:
        draft[section].initialSpeed = action.initialSpeed;
        break;
      case UPDATE_DEPARTURE_TIME:
        draft[section].departureTime = action.departureTime;
        break;
      case UPDATE_ORIGIN_TIME: {
        const newOriginTimeSeconds = time2sec(action.originTime);
        const { originLinkedBounds, originTime, originUpperBoundTime } = draft[section];
        if (originLinkedBounds) {
          const difference =
            originTime && originUpperBoundTime
              ? time2sec(originUpperBoundTime) - time2sec(originTime)
              : ORIGIN_TIME_BOUND_DEFAULT_DIFFERENCE;
          draft[section].originUpperBoundTime = sec2time(newOriginTimeSeconds + difference);
        }
        if (
          draft[section].originUpperBoundTime &&
          time2sec(action.originTime) > time2sec(draft[section].originUpperBoundTime as string)
        ) {
          draft[section].originTime = draft[section].originUpperBoundTime;
        } else {
          draft[section].originTime = action.originTime;
        }
        break;
      }
      case UPDATE_ORIGIN_UPPER_BOUND_TIME: {
        const newOriginUpperBoundTimeSeconds = time2sec(action.originUpperBoundTime);
        if (draft[section].originLinkedBounds) {
          const difference =
            draft[section].originTime && draft[section].originUpperBoundTime
              ? time2sec(draft[section].originUpperBoundTime as string) -
                time2sec(draft[section].originTime as string)
              : ORIGIN_TIME_BOUND_DEFAULT_DIFFERENCE;
          draft[section].originTime = sec2time(newOriginUpperBoundTimeSeconds - difference);
        }
        if (
          draft[section].originTime &&
          time2sec(action.originUpperBoundTime) < time2sec(draft[section].originTime as string)
        ) {
          draft[section].originUpperBoundTime = draft[section].originTime;
        } else {
          draft[section].originUpperBoundTime = action.originUpperBoundTime;
        }
        break;
      }
      case TOGGLE_ORIGIN_LINKED_BOUNDS:
        draft[section].originLinkedBounds = !draft[section].originLinkedBounds;
        break;
      case UPDATE_ORIGIN_DATE:
        draft[section].originDate = action.originDate;
        break;
      case UPDATE_ORIGIN_UPPER_BOUND_DATE:
        draft[section].originUpperBoundDate = action.originUpperBoundDate;
        break;
      case REPLACE_VIAS:
        draft[section].vias = action.vias;
        break;
      case UPDATE_VIAS:
        draft[section].vias.push(action.vias);
        break;
      case UPDATE_VIA_STOPTIME:
        draft[section].vias = action.vias;
        break;
      case PERMUTE_VIAS:
        draft[section].vias = action.vias;
        break;
      case UPDATE_SUGGERED_VIAS:
        draft[section].suggeredVias = action.suggeredVias;
        break;
      case DELETE_VIAS:
        draft[section].vias.splice(action.index, 1);
        break;
      case DELETE_ITINERARY:
        draft[section].origin = undefined;
        draft[section].vias = [];
        draft[section].destination = undefined;
        draft[section].geojson = undefined;
        draft[section].originTime = undefined;
        draft[section].pathfindingID = undefined;
        break;
      case UPDATE_DESTINATION:
        draft[section].destination = action.destination;
        break;
      case UPDATE_DESTINATION_DATE:
        draft[section].destinationDate = action.destinationDate;
        break;
      case UPDATE_DESTINATION_TIME:
        draft[section].destinationTime = action.destinationTime;
        break;
      case UPDATE_ITINERARY:
        draft[section].geojson = action.geojson;
        break;
      case UPDATE_FEATURE_INFO_CLICK_OSRD:
        draft[section].featureInfoClick = action.featureInfoClick;
        break;
      case UPDATE_GRID_MARGIN_BEFORE:
        draft[section].gridMarginBefore = action.gridMarginBefore;
        break;
      case UPDATE_GRID_MARGIN_AFTER:
        draft[section].gridMarginAfter = action.gridMarginAfter;
        break;
      case UPDATE_STANDARD_STDCM_ALLOWANCE:
        draft.stdcmConf.standardStdcmAllowance = action.standardStdcmAllowance;
        break;
      case UPDATE_POWER_RESTRICTION:
        draft[section].powerRestriction = action.powerRestriction;
        break;
      case UPDATE_TRAIN_SCHEDULE_IDS_TO_MODIFY:
        draft[section].trainScheduleIDsToModify = action.trainScheduleIDsToModify;
        break;
    }
  });
}

// Functions
export function updateName(name: string) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_NAME,
      name,
    });
  };
}
export function updateTrainCount(trainCount: number) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_TRAIN_COUNT,
      trainCount,
    });
  };
}
export function updateTrainDelta(trainDelta: number) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_TRAIN_DELTA,
      trainDelta,
    });
  };
}
export function updateTrainStep(trainStep: number) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_TRAIN_STEP,
      trainStep,
    });
  };
}
export function toggleUsingElectricalProfiles() {
  return {
    type: TOGGLE_USING_ELECTRICAL_PROFILES,
  };
}
export function updateMode(mode: string) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_MODE,
      mode,
    });
  };
}
export function updateStdcmMode(stdcmMode: ValueOf<typeof STDCM_MODES>) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_STDCM_MODE,
      stdcmMode,
    });
  };
}
export function updateLabels(labels?: string[]) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_LABELS,
      labels,
    });
  };
}
export function updateSwitchTypes(switchTypes: SwitchType[]) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_SWITCH_TYPES,
      switchTypes,
    });
  };
}
export function updateProjectID(projectID?: number) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_PROJECT_ID,
      projectID,
    });
  };
}
export function updateStudyID(studyID?: number) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_STUDY_ID,
      studyID,
    });
  };
}
export function updateScenarioID(scenarioID?: number) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_SCENARIO_ID,
      scenarioID,
    });
  };
}

type ActionUpdateInfraID = {
  type: typeof UPDATE_INFRA_ID;
  infraID: number | undefined;
};
export function updateInfraID(infraID: number | undefined): ThunkAction<ActionUpdateInfraID> {
  return async (dispatch) => {
    dispatch({
      type: UPDATE_INFRA_ID,
      infraID,
    });
    dispatch(updateSwitchTypes([]));

    if (infraID) {
      try {
        // get switch types  with rtk query
        const { data: newSwitchTypes = [] } = await dispatch(
          osrdEditoastApi.endpoints.getInfraByIdSwitchTypes.initiate({ id: infraID })
        );
        dispatch(updateSwitchTypes(newSwitchTypes as SwitchType[]));
      } catch (e) {
        /* empty */
      }
    }
  };
}
export function updatePathfindingID(pathfindingID?: number) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_PATHFINDING_ID,
      pathfindingID,
    });
  };
}
export function updatePathWithCatenaries(pathWithCatenaries?: CatenaryRange[]) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_PATH_WITH_CATENARIES,
      pathWithCatenaries,
    });
  };
}
export function updateShouldRunPathfinding(shouldRunPathfinding: boolean) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_SHOULD_RUN_PATHFINDING,
      shouldRunPathfinding,
    });
  };
}
export function updateTimetableID(timetableID?: number) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_TIMETABLE_ID,
      timetableID,
    });
  };
}
export function updateRollingStockID(rollingStockID?: number) {
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
export function updateSpeedLimitByTag(speedLimitByTag: string | undefined) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_SPEED_LIMIT_BY_TAG,
      speedLimitByTag,
    });
  };
}
export function updateOrigin(origin: PointOnMap | undefined) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_ORIGIN,
      origin,
    });
  };
}
export function updateInitialSpeed(initialSpeed: number) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_INITIAL_SPEED,
      initialSpeed,
    });
  };
}
export function updateDepartureTime(departureTime: string) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_DEPARTURE_TIME,
      departureTime,
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

export function replaceVias(vias: PointOnMap[]) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: REPLACE_VIAS,
      vias,
    });
  };
}
export function updateVias(vias: PointOnMap) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_VIAS,
      vias,
    });
  };
}
export function permuteVias(vias: PointOnMap[], from: number, to: number) {
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
export function updateSuggeredVias(suggeredVias: PointOnMap[]) {
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
export function deleteVias(index: number) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: DELETE_VIAS,
      index,
    });
  };
}
export function updateDestination(destination: PointOnMap | undefined) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_DESTINATION,
      destination,
    });
  };
}
export function updateDestinationTime(destinationTime: string) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_DESTINATION_TIME,
      destinationTime,
    });
  };
}
export function updateDestinationDate(destinationDate: string) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_DESTINATION_DATE,
      destinationDate,
    });
  };
}
export function updateItinerary(geojson?: Path) {
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
      featureInfoClick: {
        ...featureInfoClick,
        feature: omit(featureInfoClick.feature, ['_vectorTileFeature']),
      },
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
  standardStdcmAllowance: OsrdStdcmConfState['standardStdcmAllowance']
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
export function updatePowerRestriction(powerRestriction?: PowerRestrictionRange[]) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_POWER_RESTRICTION,
      powerRestriction,
    });
  };
}
export function updateTrainScheduleIDsToModify(trainScheduleIDsToModify?: number[]) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_TRAIN_SCHEDULE_IDS_TO_MODIFY,
      trainScheduleIDsToModify,
    });
  };
}
