import type { CaseReducer, PayloadAction, PrepareAction } from '@reduxjs/toolkit';
import type { Draft } from 'immer';
import { omit } from 'lodash';

import { formatIsoDate } from 'utils/date';

import { computeLinkedOriginTimes, insertVia } from 'reducers/osrdconf/helpers';
import { InfraStateReducers, buildInfraStateReducers, infraState } from 'reducers/infra';
import type { PointOnMap } from 'applications/operationalStudies/consts';
import type {
  OperationalStudiesConfSlice,
  OperationalStudiesConfSliceActions,
} from 'reducers/osrdconf/operationalStudiesConf';
import type { StdcmConfSlice, StdcmConfSliceActions } from 'reducers/osrdconf/stdcmConf';
import type { StdcmConfSelectors } from 'reducers/osrdconf/stdcmConf/selectors';
import type { OperationalStudiesConfSelectors } from 'reducers/osrdconf/operationalStudiesConf/selectors';
import type { OsrdConfState } from 'reducers/osrdconf/consts';

export const defaultCommonConf: OsrdConfState = {
  name: '',
  trainCount: 1,
  trainDelta: 15,
  trainStep: 2,
  allowances: [],
  usingElectricalProfiles: true,
  labels: [],
  projectID: undefined,
  studyID: undefined,
  scenarioID: undefined,
  pathfindingID: undefined,
  timetableID: undefined,
  rollingStockID: undefined,
  rollingStockComfort: 'STANDARD' as const,
  powerRestrictionRanges: [],
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
};

interface CommonConfReducers<S extends OsrdConfState> extends InfraStateReducers<S> {
  ['updateName']: CaseReducer<S, PayloadAction<S['name']>>;
  ['updateTrainCount']: CaseReducer<S, PayloadAction<S['trainCount']>>;
  ['updateTrainDelta']: CaseReducer<S, PayloadAction<OsrdConfState['trainDelta']>>;
  ['updateTrainStep']: CaseReducer<S, PayloadAction<S['trainStep']>>;
  ['updateAllowances']: CaseReducer<S, PayloadAction<S['allowances']>>;
  ['toggleUsingElectricalProfiles']: CaseReducer<S>;
  ['updateLabels']: CaseReducer<S, PayloadAction<S['labels']>>;
  ['updateProjectID']: CaseReducer<S, PayloadAction<S['projectID']>>;
  ['updateStudyID']: CaseReducer<S, PayloadAction<S['studyID']>>;
  ['updateScenarioID']: CaseReducer<S, PayloadAction<S['scenarioID']>>;
  ['updatePathfindingID']: CaseReducer<S, PayloadAction<S['pathfindingID']>>;
  ['updateTimetableID']: CaseReducer<S, PayloadAction<S['timetableID']>>;
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
  ['updatePowerRestrictionRanges']: CaseReducer<S, PayloadAction<S['powerRestrictionRanges']>>;
  ['updateTrainScheduleIDsToModify']: CaseReducer<S, PayloadAction<S['trainScheduleIDsToModify']>>;
  ['updateFeatureInfoClick']: CaseReducer<S, PayloadAction<S['featureInfoClick']>>;
}

export function buildCommonConfReducers<S extends OsrdConfState>(): CommonConfReducers<S> {
  return {
    ...buildInfraStateReducers<S>(),
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
    updateAllowances(state: Draft<S>, action: PayloadAction<S['allowances']>) {
      state.allowances = action.payload;
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
      state.powerRestrictionRanges = [];
    },
    updateTimetableID(state: Draft<S>, action: PayloadAction<S['timetableID']>) {
      state.timetableID = action.payload;
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
    updatePowerRestrictionRanges(
      state: Draft<S>,
      action: PayloadAction<S['powerRestrictionRanges']>
    ) {
      state.powerRestrictionRanges = action.payload;
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
  };
}

export type ConfSlice = StdcmConfSlice | OperationalStudiesConfSlice;

export type ConfSliceActions = StdcmConfSliceActions | OperationalStudiesConfSliceActions;

export type ConfSelectors = StdcmConfSelectors | OperationalStudiesConfSelectors;
