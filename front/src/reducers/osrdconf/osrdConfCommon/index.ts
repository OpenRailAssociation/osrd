import type { CaseReducer, PayloadAction, PrepareAction } from '@reduxjs/toolkit';
import type { Draft } from 'immer';
import { compact, omit } from 'lodash';
import nextId from 'react-id-generator';

import type { PointOnMap } from 'applications/operationalStudies/consts';
import type { ManageTrainSchedulePathProperties } from 'applications/operationalStudies/types';
import { isVia } from 'modules/pathfinding/utils';
import type { SuggestedOP } from 'modules/trainschedule/components/ManageTrainSchedule/types';
import { type InfraStateReducers, buildInfraStateReducers, infraState } from 'reducers/infra';
import { computeLinkedOriginTimes, insertVia, insertViaFromMap } from 'reducers/osrdconf/helpers';
import type {
  OperationalStudiesConfSlice,
  OperationalStudiesConfSliceActions,
} from 'reducers/osrdconf/operationalStudiesConf';
import type { OperationalStudiesConfSelectors } from 'reducers/osrdconf/operationalStudiesConf/selectors';
import type { StdcmConfSlice, StdcmConfSliceActions } from 'reducers/osrdconf/stdcmConf';
import type { StdcmConfSelectors } from 'reducers/osrdconf/stdcmConf/selectors';
import type { OsrdConfState, PathStep } from 'reducers/osrdconf/types';
import { addElementAtIndex, removeElementAtIndex, replaceElementAtIndex } from 'utils/array';
import { formatIsoDate } from 'utils/date';
import type { ArrayElement } from 'utils/types';

export const defaultCommonConf: OsrdConfState = {
  constraintDistribution: 'MARECO',
  name: '',
  trainCount: 1,
  trainDelta: 15,
  trainStep: 2,
  usingElectricalProfiles: true,
  labels: [],
  projectID: undefined,
  studyID: undefined,
  scenarioID: undefined,
  pathfindingID: undefined,
  timetableID: undefined,
  electricalProfileSetId: undefined,
  rollingStockID: undefined,
  rollingStockComfort: 'STANDARD' as const,
  powerRestrictionV2: [],
  speedLimitByTag: undefined,
  origin: undefined,
  initialSpeed: 0,
  departureTime: '08:00:00',
  originDate: formatIsoDate(new Date()),
  originTime: '08:00:00',
  originUpperBoundDate: formatIsoDate(new Date()),
  originUpperBoundTime: '10:00:00',
  originLinkedBounds: true,
  destination: undefined,
  destinationDate: formatIsoDate(new Date()),
  destinationTime: undefined,
  vias: [],
  suggeredVias: [],
  geojson: undefined,
  gridMarginBefore: undefined,
  gridMarginAfter: undefined,
  trainScheduleIDsToModify: [],
  ...infraState,
  featureInfoClick: { displayPopup: false },
  // Corresponds to origin and destination not defined
  pathSteps: [null, null],
  rollingStockComfortV2: 'STANDARD' as const,
  startTime: new Date().toISOString(),
};

interface CommonConfReducers<S extends OsrdConfState> extends InfraStateReducers<S> {
  ['updateConstraintDistribution']: CaseReducer<S, PayloadAction<S['constraintDistribution']>>;
  ['updateName']: CaseReducer<S, PayloadAction<S['name']>>;
  ['updateTrainCount']: CaseReducer<S, PayloadAction<S['trainCount']>>;
  ['updateTrainDelta']: CaseReducer<S, PayloadAction<OsrdConfState['trainDelta']>>;
  ['updateTrainStep']: CaseReducer<S, PayloadAction<S['trainStep']>>;
  ['toggleUsingElectricalProfiles']: CaseReducer<S>;
  ['updateLabels']: CaseReducer<S, PayloadAction<S['labels']>>;
  ['updateProjectID']: CaseReducer<S, PayloadAction<S['projectID']>>;
  ['updateStudyID']: CaseReducer<S, PayloadAction<S['studyID']>>;
  ['updateScenarioID']: CaseReducer<S, PayloadAction<S['scenarioID']>>;
  ['updatePathfindingID']: CaseReducer<S, PayloadAction<S['pathfindingID']>>;
  ['updateTimetableID']: CaseReducer<S, PayloadAction<S['timetableID']>>;
  ['updateElectricalProfileSetId']: CaseReducer<S, PayloadAction<S['electricalProfileSetId']>>;
  ['updateRollingStockID']: CaseReducer<S, PayloadAction<S['rollingStockID']>>;
  ['updateRollingStockComfort']: CaseReducer<S, PayloadAction<S['rollingStockComfort']>>;
  ['updateSpeedLimitByTag']: CaseReducer<S, PayloadAction<S['speedLimitByTag'] | null>>;
  ['updateOrigin']: CaseReducer<S, PayloadAction<S['origin']>>;
  ['updateInitialSpeed']: CaseReducer<S, PayloadAction<S['initialSpeed']>>;
  ['updateDepartureTime']: CaseReducer<S, PayloadAction<S['departureTime']>>;
  ['updateOriginTime']: CaseReducer<S, PayloadAction<S['originTime']>>;
  ['updateOriginUpperBoundTime']: CaseReducer<S, PayloadAction<S['originUpperBoundTime']>>;
  ['toggleOriginLinkedBounds']: CaseReducer<S>;
  ['updateOriginDate']: CaseReducer<S, PayloadAction<S['originDate']>>;
  ['updateOriginUpperBoundDate']: CaseReducer<S, PayloadAction<S['originUpperBoundDate']>>;
  ['replaceVias']: CaseReducer<S, PayloadAction<S['vias']>>;
  ['addVias']: CaseReducer<S, PayloadAction<PointOnMap>>;
  ['clearVias']: CaseReducer<S>;
  ['updateViaStopTime']: {
    reducer: CaseReducer<S, PayloadAction<S['vias']>>;
    prepare: PrepareAction<S['vias']>;
  };
  ['updateViaStopTimeV2']: CaseReducer<S, PayloadAction<{ via: PathStep; duration: string }>>;
  ['permuteVias']: {
    reducer: CaseReducer<S, PayloadAction<S['vias']>>;
    prepare: PrepareAction<S['vias']>;
  };
  ['updateSuggeredVias']: CaseReducer<S, PayloadAction<S['suggeredVias']>>;
  ['deleteVias']: CaseReducer<S, PayloadAction<number>>;
  ['deleteItinerary']: CaseReducer<S>;
  ['updateDestination']: CaseReducer<S, PayloadAction<S['destination']>>;
  ['updateDestinationDate']: CaseReducer<S, PayloadAction<S['destinationDate']>>;
  ['updateDestinationTime']: CaseReducer<S, PayloadAction<S['destinationTime']>>;
  ['updateItinerary']: CaseReducer<S, PayloadAction<S['geojson']>>;
  ['updateGridMarginBefore']: CaseReducer<S, PayloadAction<S['gridMarginBefore']>>;
  ['updateGridMarginAfter']: CaseReducer<S, PayloadAction<S['gridMarginAfter']>>;
  ['updateTrainScheduleIDsToModify']: CaseReducer<S, PayloadAction<S['trainScheduleIDsToModify']>>;
  ['updateFeatureInfoClick']: CaseReducer<S, PayloadAction<S['featureInfoClick']>>;
  ['updatePathSteps']: CaseReducer<
    S,
    PayloadAction<{ pathSteps: S['pathSteps']; resetPowerRestrictions?: boolean }>
  >;
  ['updateOriginV2']: CaseReducer<S, PayloadAction<ArrayElement<S['pathSteps']>>>;
  ['updateDestinationV2']: CaseReducer<S, PayloadAction<ArrayElement<S['pathSteps']>>>;
  ['deleteItineraryV2']: CaseReducer<S>;
  ['clearViasV2']: CaseReducer<S>;
  ['deleteViaV2']: CaseReducer<S, PayloadAction<number>>;
  ['addViaV2']: CaseReducer<
    S,
    PayloadAction<{ newVia: PathStep; pathProperties: ManageTrainSchedulePathProperties }>
  >;
  ['moveVia']: {
    reducer: CaseReducer<S, PayloadAction<S['pathSteps']>>;
    prepare: PrepareAction<S['pathSteps']>;
  };
  ['upsertViaFromSuggestedOP']: CaseReducer<S, PayloadAction<SuggestedOP>>;
  ['updateRollingStockComfortV2']: CaseReducer<S, PayloadAction<S['rollingStockComfortV2']>>;
  ['updateStartTime']: CaseReducer<S, PayloadAction<S['startTime']>>;
}

export function buildCommonConfReducers<S extends OsrdConfState>(): CommonConfReducers<S> {
  return {
    ...buildInfraStateReducers<S>(),
    updateConstraintDistribution(
      state: Draft<S>,
      action: PayloadAction<S['constraintDistribution']>
    ) {
      state.constraintDistribution = action.payload;
    },
    updateName(state: Draft<S>, action: PayloadAction<S['name']>) {
      state.name = action.payload;
    },
    updateTrainCount(state: Draft<S>, action: PayloadAction<S['trainCount']>) {
      state.trainCount = action.payload;
    },
    updateTrainDelta(state: Draft<S>, action: PayloadAction<OsrdConfState['trainDelta']>) {
      state.trainDelta = action.payload;
    },
    updateTrainStep(state: Draft<S>, action: PayloadAction<S['trainStep']>) {
      state.trainStep = action.payload;
    },
    toggleUsingElectricalProfiles(state: Draft<S>) {
      state.usingElectricalProfiles = !state.usingElectricalProfiles;
    },
    updateLabels(state: Draft<S>, action: PayloadAction<S['labels']>) {
      state.labels = action.payload;
    },
    updateProjectID(state: Draft<S>, action: PayloadAction<S['projectID']>) {
      state.projectID = action.payload;
    },
    updateStudyID(state: Draft<S>, action: PayloadAction<S['studyID']>) {
      state.studyID = action.payload;
    },
    updateScenarioID(state: Draft<S>, action: PayloadAction<S['scenarioID']>) {
      state.scenarioID = action.payload;
    },
    updatePathfindingID(state: Draft<S>, action: PayloadAction<S['pathfindingID']>) {
      state.pathfindingID = action.payload;
    },
    updateTimetableID(state: Draft<S>, action: PayloadAction<S['timetableID']>) {
      state.timetableID = action.payload;
    },
    updateElectricalProfileSetId(
      state: Draft<S>,
      action: PayloadAction<S['electricalProfileSetId']>
    ) {
      state.electricalProfileSetId = action.payload;
    },
    updateRollingStockID(state: Draft<S>, action: PayloadAction<S['rollingStockID']>) {
      state.rollingStockID = action.payload;
    },
    updateRollingStockComfort(state: Draft<S>, action: PayloadAction<S['rollingStockComfort']>) {
      state.rollingStockComfort = action.payload;
    },
    updateSpeedLimitByTag(state: Draft<S>, action: PayloadAction<S['speedLimitByTag'] | null>) {
      state.speedLimitByTag = action.payload === null ? undefined : action.payload;
    },
    updateOrigin(state: Draft<S>, action: PayloadAction<S['origin']>) {
      state.origin = action.payload;
    },
    updateInitialSpeed(state: Draft<S>, action: PayloadAction<S['initialSpeed']>) {
      state.initialSpeed = action.payload;
    },
    updateDepartureTime(state: Draft<S>, action: PayloadAction<S['departureTime']>) {
      state.departureTime = action.payload;
    },
    updateOriginTime(state: Draft<S>, action: PayloadAction<S['originTime']>) {
      if (action.payload) {
        const { originLinkedBounds } = state;
        if (!originLinkedBounds) {
          state.originTime = action.payload;
        } else {
          const { originDate, originTime, originUpperBoundDate, originUpperBoundTime } = state;
          const { newOriginTime, newOriginUpperBoundDate, newOriginUpperBoundTime } =
            computeLinkedOriginTimes(
              originDate,
              originTime,
              originUpperBoundDate,
              originUpperBoundTime,
              action.payload
            );
          if (newOriginUpperBoundDate) {
            state.originUpperBoundDate = newOriginUpperBoundDate;
          }
          state.originTime = newOriginTime;
          state.originUpperBoundTime = newOriginUpperBoundTime;
        }
      }
    },
    updateOriginUpperBoundTime(state: Draft<S>, action: PayloadAction<S['originUpperBoundTime']>) {
      if (action.payload) {
        const { originLinkedBounds } = state;
        if (!originLinkedBounds) {
          state.originUpperBoundTime = action.payload;
        } else {
          const { originDate, originTime, originUpperBoundDate, originUpperBoundTime } = state;
          const { newOriginTime, newOriginUpperBoundDate, newOriginUpperBoundTime } =
            computeLinkedOriginTimes(
              originDate,
              originTime,
              originUpperBoundDate,
              originUpperBoundTime,
              undefined,
              action.payload
            );
          if (newOriginUpperBoundDate) {
            state.originUpperBoundDate = newOriginUpperBoundDate;
          }
          state.originTime = newOriginTime;
          state.originUpperBoundTime = newOriginUpperBoundTime;
        }
      }
    },
    toggleOriginLinkedBounds(state: Draft<S>) {
      state.originLinkedBounds = !state.originLinkedBounds;
    },
    updateOriginDate(state: Draft<S>, action: PayloadAction<S['originDate']>) {
      state.originDate = action.payload;
    },
    updateOriginUpperBoundDate(state: Draft<S>, action: PayloadAction<S['originUpperBoundDate']>) {
      state.originUpperBoundDate = action.payload;
    },
    replaceVias(state: Draft<S>, action: PayloadAction<S['vias']>) {
      state.vias = action.payload;
    },
    addVias(state: Draft<S>, action: PayloadAction<PointOnMap>) {
      if (state.origin && state.destination) {
        state.vias = insertVia(state.vias, state.origin, state.destination, action.payload);
      }
    },
    clearVias(state: Draft<S>) {
      state.vias = [];
    },
    updateViaStopTime: {
      reducer: (state: Draft<S>, action: PayloadAction<S['vias']>) => {
        state.vias = action.payload;
      },
      prepare: (vias: S['vias'], index: number, value: number) => {
        const newVias = Array.from(vias);
        newVias[index] = { ...newVias[index], duration: value };
        return { payload: newVias };
      },
    },
    // TODO: Change the type of duration to number. It is preferable to keep this value in seconds in the store
    //* to avoid multiple conversions between seconds and ISO8601 format across the front.
    updateViaStopTimeV2(
      state: Draft<S>,
      action: PayloadAction<{ via: PathStep; duration: string }>
    ) {
      const {
        payload: { via, duration },
      } = action;
      state.pathSteps = state.pathSteps.map((pathStep) => {
        if (pathStep && pathStep.id === via.id) {
          return { ...pathStep, stopFor: duration };
        }
        return pathStep;
      });
    },
    permuteVias: {
      reducer: (state: Draft<S>, action: PayloadAction<S['vias']>) => {
        state.vias = action.payload;
      },
      prepare: (vias: S['vias'], from: number, to: number) => {
        const newVias = Array.from(vias);
        const itemToPermute = newVias.slice(from, from + 1);
        newVias.splice(from, 1); // Remove it from array
        newVias.splice(to, 0, itemToPermute[0]); // Replace to right position
        return { payload: newVias };
      },
    },
    updateSuggeredVias(state: Draft<S>, action: PayloadAction<S['suggeredVias']>) {
      state.suggeredVias = action.payload;
    },
    deleteVias(state: Draft<S>, action: PayloadAction<number>) {
      state.vias.splice(action.payload, 1);
    },
    deleteItinerary(state: Draft<S>) {
      state.origin = undefined;
      state.vias = [];
      state.destination = undefined;
      state.geojson = undefined;
      state.originTime = undefined;
      state.pathfindingID = undefined;
    },
    updateDestination(state: Draft<S>, action: PayloadAction<S['destination']>) {
      state.destination = action.payload;
    },
    updateDestinationDate(state: Draft<S>, action: PayloadAction<S['destinationDate']>) {
      state.destinationDate = action.payload;
    },
    updateDestinationTime(state: Draft<S>, action: PayloadAction<S['destinationTime']>) {
      state.destinationTime = action.payload;
    },
    updateItinerary(state: Draft<S>, action: PayloadAction<S['geojson']>) {
      state.geojson = action.payload;
    },
    updateGridMarginBefore(state: Draft<S>, action: PayloadAction<S['gridMarginBefore']>) {
      state.gridMarginBefore = action.payload;
    },
    updateGridMarginAfter(state: Draft<S>, action: PayloadAction<S['gridMarginAfter']>) {
      state.gridMarginAfter = action.payload;
    },
    updateTrainScheduleIDsToModify(
      state: Draft<S>,
      action: PayloadAction<S['trainScheduleIDsToModify']>
    ) {
      state.trainScheduleIDsToModify = action.payload;
    },
    updateFeatureInfoClick(state: Draft<S>, action: PayloadAction<S['featureInfoClick']>) {
      const feature = omit(action.payload.feature, ['_vectorTileFeature']);
      state.featureInfoClick = { ...action.payload, feature };
    },
    updatePathSteps(
      state: Draft<S>,
      action: PayloadAction<{ pathSteps: S['pathSteps']; resetPowerRestrictions?: boolean }>
    ) {
      state.pathSteps = action.payload.pathSteps;
      if (action.payload.resetPowerRestrictions) {
        state.powerRestrictionV2 = [];
      }
    },
    updateOriginV2(state: Draft<S>, action: PayloadAction<ArrayElement<S['pathSteps']>>) {
      state.pathSteps = replaceElementAtIndex(state.pathSteps, 0, action.payload);
    },
    updateDestinationV2(state: Draft<S>, action: PayloadAction<ArrayElement<S['pathSteps']>>) {
      state.pathSteps = replaceElementAtIndex(
        state.pathSteps,
        state.pathSteps.length - 1,
        action.payload
      );
    },
    deleteItineraryV2(state: Draft<S>) {
      state.pathSteps = [null, null];
    },
    clearViasV2(state: Draft<S>) {
      state.pathSteps = [state.pathSteps[0], state.pathSteps[state.pathSteps.length - 1]];
    },
    // Use this action in the via list, not the suggested op list
    deleteViaV2(state: Draft<S>, action: PayloadAction<number>) {
      // Index takes count of the origin in the array
      state.pathSteps = removeElementAtIndex(state.pathSteps, action.payload + 1);
    },
    // Use this action only to via added by click on map
    addViaV2(
      state: Draft<S>,
      action: PayloadAction<{
        newVia: PathStep;
        pathProperties: ManageTrainSchedulePathProperties;
      }>
    ) {
      state.pathSteps = insertViaFromMap(
        state.pathSteps,
        action.payload.newVia,
        action.payload.pathProperties
      );
    },
    moveVia: {
      reducer: (state: Draft<S>, action: PayloadAction<S['pathSteps']>) => {
        state.pathSteps = action.payload;
      },
      prepare: (vias: S['pathSteps'], from: number, to: number) => {
        const newVias = Array.from(vias);
        // Index takes count of the origin in the array
        const itemToPermute = newVias.slice(from + 1, from + 2);
        newVias.splice(from + 1, 1); // Remove it from array
        newVias.splice(to + 1, 0, itemToPermute[0]); // Replace to right position
        return { payload: newVias };
      },
    },
    // Use this action to transform an op to via from times and stop table or
    // from the suggested via modal
    upsertViaFromSuggestedOP(state: Draft<S>, action: PayloadAction<SuggestedOP>) {
      // We know that, at this point, origin and destination are defined because pathfinding has been done
      const pathSteps = compact(state.pathSteps);

      let newVia: PathStep = {
        coordinates: action.payload.coordinates,
        id: nextId(),
        positionOnPath: action.payload.positionOnPath,
        name: action.payload.name,
        ch: action.payload.ch,
        kp: action.payload.kp,
        stopFor: action.payload.stopFor,
        arrival: action.payload.arrival,
        locked: action.payload.locked,
        deleted: action.payload.deleted,
        onStopSignal: action.payload.onStopSignal,
        theoreticalMargin: action.payload.theoreticalMargin,
        ...(action.payload.uic
          ? { uic: action.payload.uic }
          : {
              track: action.payload.track,
              offset: action.payload.offsetOnTrack,
            }),
      };

      const isInVias = isVia(pathSteps, action.payload);
      if (isInVias) {
        // Because of import issues, there can be multiple ops with same position on path
        // To avoid updating the wrong one, we need to find the one that matches the payload
        const stepIndex = pathSteps.findIndex(
          (step) =>
            ('uic' in step &&
              'ch' in step &&
              step.uic === action.payload.uic &&
              step.ch === action.payload.ch &&
              step.name === action.payload.name) ||
            step.id === action.payload.opId
        );
        newVia = { ...newVia, id: pathSteps[stepIndex].id }; // We don't need to change the id of the updated via
        state.pathSteps = replaceElementAtIndex(state.pathSteps, stepIndex, newVia);
      } else {
        const index = pathSteps.findIndex(
          (step) => step.positionOnPath! >= action.payload.positionOnPath
        );
        // Because of import issues, there can be multiple ops at position 0
        // To avoid inserting a new via before the origin we need to check if the index is 0
        state.pathSteps = addElementAtIndex(state.pathSteps, index || 1, newVia);
      }
    },
    updateRollingStockComfortV2(
      state: Draft<S>,
      action: PayloadAction<S['rollingStockComfortV2']>
    ) {
      state.rollingStockComfortV2 = action.payload;
    },
    updateStartTime(state: Draft<S>, action: PayloadAction<S['startTime']>) {
      state.startTime = action.payload;
    },
  };
}

export type ConfSlice = StdcmConfSlice | OperationalStudiesConfSlice;

export type ConfSliceActions = StdcmConfSliceActions | OperationalStudiesConfSliceActions;

export type ConfSelectors = StdcmConfSelectors | OperationalStudiesConfSelectors;
