import type { CaseReducer, PayloadAction, PrepareAction } from '@reduxjs/toolkit';
import type { Draft } from 'immer';
import { compact, omit } from 'lodash';
import nextId from 'react-id-generator';

import type { ManageTrainSchedulePathProperties } from 'applications/operationalStudies/types';
import { ArrivalTimeTypes } from 'applications/stdcmV2/types';
import { isVia } from 'modules/pathfinding/utils';
import type { SuggestedOP } from 'modules/trainschedule/components/ManageTrainSchedule/types';
import { type InfraStateReducers, buildInfraStateReducers, infraState } from 'reducers/infra';
import {
  computeLinkedOriginTimes,
  insertViaFromMap,
  updateDestinationPathStep,
  updateOriginPathStep,
} from 'reducers/osrdconf/helpers';
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
  timetableID: undefined,
  electricalProfileSetId: undefined,
  rollingStockID: undefined,
  powerRestriction: [],
  speedLimitByTag: undefined,
  initialSpeed: 0,
  originDate: formatIsoDate(new Date()),
  originTime: '08:00:00',
  originUpperBoundDate: formatIsoDate(new Date()),
  originUpperBoundTime: '10:00:00',
  originLinkedBounds: true,
  gridMarginBefore: undefined,
  gridMarginAfter: undefined,
  ...infraState,
  featureInfoClick: { displayPopup: false },
  // Corresponds to origin and destination not defined
  pathSteps: [null, null],
  rollingStockComfort: 'STANDARD' as const,
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
  ['updateTimetableID']: CaseReducer<S, PayloadAction<S['timetableID']>>;
  ['updateElectricalProfileSetId']: CaseReducer<S, PayloadAction<S['electricalProfileSetId']>>;
  ['updateRollingStockID']: CaseReducer<S, PayloadAction<S['rollingStockID']>>;
  ['updateSpeedLimitByTag']: CaseReducer<S, PayloadAction<S['speedLimitByTag'] | null>>;
  ['updateInitialSpeed']: CaseReducer<S, PayloadAction<S['initialSpeed']>>;
  ['updateOriginTime']: CaseReducer<S, PayloadAction<S['originTime']>>;
  ['updateOriginUpperBoundTime']: CaseReducer<S, PayloadAction<S['originUpperBoundTime']>>;
  ['toggleOriginLinkedBounds']: CaseReducer<S>;
  ['updateOriginDate']: CaseReducer<S, PayloadAction<S['originDate']>>;
  ['updateOriginUpperBoundDate']: CaseReducer<S, PayloadAction<S['originUpperBoundDate']>>;
  ['updateViaStopTime']: CaseReducer<S, PayloadAction<{ via: PathStep; duration: string }>>;
  ['updateGridMarginBefore']: CaseReducer<S, PayloadAction<S['gridMarginBefore']>>;
  ['updateGridMarginAfter']: CaseReducer<S, PayloadAction<S['gridMarginAfter']>>;
  ['updateFeatureInfoClick']: CaseReducer<S, PayloadAction<S['featureInfoClick']>>;
  ['updatePathSteps']: CaseReducer<
    S,
    PayloadAction<{ pathSteps: S['pathSteps']; resetPowerRestrictions?: boolean }>
  >;
  ['deleteItinerary']: CaseReducer<S>;
  ['clearVias']: CaseReducer<S>;
  ['deleteVia']: CaseReducer<S, PayloadAction<number>>;
  ['addVia']: CaseReducer<
    S,
    PayloadAction<{ newVia: PathStep; pathProperties: ManageTrainSchedulePathProperties }>
  >;
  ['moveVia']: {
    reducer: CaseReducer<S, PayloadAction<S['pathSteps']>>;
    prepare: PrepareAction<S['pathSteps']>;
  };
  ['upsertViaFromSuggestedOP']: CaseReducer<S, PayloadAction<SuggestedOP>>;
  ['updateRollingStockComfort']: CaseReducer<S, PayloadAction<S['rollingStockComfort']>>;
  ['updateStartTime']: CaseReducer<S, PayloadAction<S['startTime']>>;
  ['updateOrigin']: CaseReducer<S, PayloadAction<ArrayElement<S['pathSteps']>>>;
  ['updateDestination']: CaseReducer<S, PayloadAction<ArrayElement<S['pathSteps']>>>;
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
    updateSpeedLimitByTag(state: Draft<S>, action: PayloadAction<S['speedLimitByTag'] | null>) {
      state.speedLimitByTag = action.payload === null ? undefined : action.payload;
    },
    updateInitialSpeed(state: Draft<S>, action: PayloadAction<S['initialSpeed']>) {
      state.initialSpeed = action.payload;
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
    // TODO: Change the type of duration to number. It is preferable to keep this value in seconds in the store
    //* to avoid multiple conversions between seconds and ISO8601 format across the front.
    updateViaStopTime(state: Draft<S>, action: PayloadAction<{ via: PathStep; duration: string }>) {
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
    updateGridMarginBefore(state: Draft<S>, action: PayloadAction<S['gridMarginBefore']>) {
      state.gridMarginBefore = action.payload;
    },
    updateGridMarginAfter(state: Draft<S>, action: PayloadAction<S['gridMarginAfter']>) {
      state.gridMarginAfter = action.payload;
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
        state.powerRestriction = [];
      }
    },
    deleteItinerary(state: Draft<S>) {
      state.pathSteps = [null, null];
    },
    clearVias(state: Draft<S>) {
      state.pathSteps = [state.pathSteps[0], state.pathSteps[state.pathSteps.length - 1]];
    },
    // Use this action in the via list, not the suggested op list
    deleteVia(state: Draft<S>, action: PayloadAction<number>) {
      // Index takes count of the origin in the array
      state.pathSteps = removeElementAtIndex(state.pathSteps, action.payload + 1);
    },
    // Use this action only to via added by click on map
    addVia(
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
    updateRollingStockComfort(state: Draft<S>, action: PayloadAction<S['rollingStockComfort']>) {
      state.rollingStockComfort = action.payload;
    },
    updateStartTime(state: Draft<S>, action: PayloadAction<S['startTime']>) {
      state.startTime = action.payload;
    },
    updateOrigin(state: Draft<S>, action: PayloadAction<ArrayElement<S['pathSteps']>>) {
      const newPoint = action.payload
        ? {
            ...action.payload,
            arrivalType: ArrivalTimeTypes.PRECISE_TIME,
          }
        : null;
      state.pathSteps = updateOriginPathStep(state.pathSteps, newPoint, true);
    },
    updateDestination(state: Draft<S>, action: PayloadAction<ArrayElement<S['pathSteps']>>) {
      const newPoint = action.payload
        ? {
            ...action.payload,
            arrivalType: ArrivalTimeTypes.ASAP,
          }
        : null;
      state.pathSteps = updateDestinationPathStep(state.pathSteps, newPoint, true);
    },
  };
}

export type ConfSlice = StdcmConfSlice | OperationalStudiesConfSlice;

export type ConfSliceActions = StdcmConfSliceActions | OperationalStudiesConfSliceActions;

export type ConfSelectors = StdcmConfSelectors | OperationalStudiesConfSelectors;
