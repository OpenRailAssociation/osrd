import {
  ActionReducerMapBuilder,
  CaseReducer,
  ListenerMiddlewareInstance,
  PayloadAction,
  PrepareAction,
} from '@reduxjs/toolkit';
import { OsrdConfState, PointOnMap } from 'applications/operationalStudies/consts';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { Draft } from 'immer';
import { omit } from 'lodash';
import { formatIsoDate } from 'utils/date';
import { sec2time, time2sec } from 'utils/timeManipulation';
import type { simulationConfSliceActionsType } from '../simulationConf';
import type { stdcmConfSliceActionsType } from '../stdcmConf';

const ORIGIN_TIME_BOUND_DEFAULT_DIFFERENCE = 7200;

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
  infraID: undefined,
  switchTypes: undefined,
  pathfindingID: undefined,
  timetableID: undefined,
  rollingStockID: undefined,
  rollingStockComfort: 'STANDARD' as const,
  powerRestrictionRanges: [],
  speedLimitByTag: undefined,
  origin: undefined,
  initialSpeed: 0,
  departureTime: '08:00:00',
  shouldRunPathfinding: true,
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
  trainCompo: undefined,
  geojson: undefined,
  featureInfoClick: { displayPopup: false },
  gridMarginBefore: 0,
  gridMarginAfter: 0,
  trainScheduleIDsToModify: undefined,
};

type CommonOsrdConfReducersType<S extends OsrdConfState> = {
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
  ['updateInfraID']: CaseReducer<S, PayloadAction<S['infraID']>>;
  ['updateSwitchTypes']: CaseReducer<S, PayloadAction<S['switchTypes']>>;
  ['updatePathfindingID']: CaseReducer<S, PayloadAction<S['pathfindingID']>>;
  ['updateShouldRunPathfinding']: CaseReducer<S, PayloadAction<S['shouldRunPathfinding']>>;
  ['updateTimetableID']: CaseReducer<S, PayloadAction<S['timetableID']>>;
  ['updateRollingStockID']: CaseReducer<S, PayloadAction<S['rollingStockID']>>;
  ['updateRollingStockComfort']: CaseReducer<S, PayloadAction<S['rollingStockComfort']>>;
  ['updateSpeedLimitByTag']: CaseReducer<S, PayloadAction<S['speedLimitByTag']>>;
  ['updateOrigin']: CaseReducer<S, PayloadAction<S['origin']>>;
  ['updateInitialSpeed']: CaseReducer<S, PayloadAction<S['initialSpeed']>>;
  ['updateDepartureTime']: CaseReducer<S, PayloadAction<S['departureTime']>>;
  ['updateOriginTime']: CaseReducer<S, PayloadAction<S['originTime']>>;
  ['updateOriginUpperBoundTime']: CaseReducer<S, PayloadAction<S['originUpperBoundTime']>>;
  ['toggleOriginLinkedBounds']: CaseReducer<S>;
  ['updateOriginDate']: CaseReducer<S, PayloadAction<S['originDate']>>;
  ['updateOriginUpperBoundDate']: CaseReducer<S, PayloadAction<S['originUpperBoundDate']>>;
  ['replaceVias']: CaseReducer<S, PayloadAction<S['vias']>>;
  ['updateVias']: CaseReducer<S, PayloadAction<PointOnMap>>;
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
  ['updateFeatureInfoClickOSRD']: {
    reducer: CaseReducer<S, PayloadAction<S['featureInfoClick']>>;
    prepare: PrepareAction<S['featureInfoClick']>;
  };
  ['updateGridMarginBefore']: CaseReducer<S, PayloadAction<S['gridMarginBefore']>>;
  ['updateGridMarginAfter']: CaseReducer<S, PayloadAction<S['gridMarginAfter']>>;
  ['updatePowerRestrictionRanges']: CaseReducer<S, PayloadAction<S['powerRestrictionRanges']>>;
  ['updateTrainScheduleIDsToModify']: CaseReducer<S, PayloadAction<S['trainScheduleIDsToModify']>>;
};

export function buildCommonOsrdConfReducers<
  S extends OsrdConfState
>(): CommonOsrdConfReducersType<S> {
  return {
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
    // TODO REWORK use listener or createThunk ?
    updateInfraID(state: Draft<S>, action: PayloadAction<S['infraID']>) {
      state.infraID = action.payload;
    },
    updateSwitchTypes(state: Draft<S>, action: PayloadAction<S['switchTypes']>) {
      state.switchTypes = action.payload;
    },
    updatePathfindingID(state: Draft<S>, action: PayloadAction<S['pathfindingID']>) {
      state.pathfindingID = action.payload;
      // TODO, move it to rtk listener
      state.powerRestrictionRanges = [];
    },
    updateShouldRunPathfinding(state: Draft<S>, action: PayloadAction<S['shouldRunPathfinding']>) {
      state.shouldRunPathfinding = action.payload;
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
    updateSpeedLimitByTag(state: Draft<S>, action: PayloadAction<S['speedLimitByTag']>) {
      state.speedLimitByTag = action.payload;
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
    // TODO TEST undefined value
    updateOriginTime(state: Draft<S>, action: PayloadAction<S['originTime']>) {
      if (action.payload) {
        const newOriginTimeSeconds = time2sec(action.payload);
        const { originLinkedBounds, originTime, originUpperBoundTime } = state;
        if (originLinkedBounds) {
          const difference =
            originTime && originUpperBoundTime
              ? time2sec(originUpperBoundTime) - time2sec(originTime)
              : ORIGIN_TIME_BOUND_DEFAULT_DIFFERENCE;
          state.originUpperBoundTime = sec2time(newOriginTimeSeconds + difference);
        }
        if (
          state.originUpperBoundTime &&
          time2sec(action.payload) > time2sec(state.originUpperBoundTime)
        ) {
          state.originTime = state.originUpperBoundTime;
        } else {
          state.originTime = action.payload;
        }
      }
    },
    // TODO TEST undefined value
    updateOriginUpperBoundTime(state: Draft<S>, action: PayloadAction<S['originUpperBoundTime']>) {
      if (action.payload) {
        const newOriginUpperBoundTimeSeconds = time2sec(action.payload);
        if (state.originLinkedBounds) {
          const difference =
            state.originTime && state.originUpperBoundTime
              ? time2sec(state.originUpperBoundTime) - time2sec(state.originTime)
              : ORIGIN_TIME_BOUND_DEFAULT_DIFFERENCE;
          state.originTime = sec2time(newOriginUpperBoundTimeSeconds - difference);
        }
        if (state.originTime && time2sec(action.payload) < time2sec(state.originTime)) {
          state.originUpperBoundTime = state.originTime;
        } else {
          state.originUpperBoundTime = action.payload;
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
    updateVias(state: Draft<S>, action: PayloadAction<PointOnMap>) {
      state.vias.push(action.payload);
    },
    // TODO TEST prepare
    updateViaStopTime: {
      reducer: (state: Draft<S>, action: PayloadAction<S['vias']>) => {
        state.vias = action.payload;
      },
      prepare: (vias: PointOnMap[], index: number, value: number) => {
        const newVias = Array.from(vias);
        newVias[index] = { ...newVias[index], duration: value };
        return { payload: newVias };
      },
    },
    // TODO TEST prepare
    permuteVias: {
      reducer: (state: Draft<S>, action: PayloadAction<S['vias']>) => {
        state.vias = action.payload;
      },
      prepare: (vias: PointOnMap[], from: number, to: number) => {
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
    updateFeatureInfoClickOSRD: {
      reducer: (state: Draft<S>, action: PayloadAction<S['featureInfoClick']>) => {
        state.featureInfoClick = action.payload;
      },
      prepare: (featureInfoClick: S['featureInfoClick']) => ({
        payload: {
          ...featureInfoClick,
          feature: omit(featureInfoClick.feature, ['_vectorTileFeature']),
        },
      }),
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
  };
}

/**
 *
 */
export function addCommonOsrdConfMatchers<S extends OsrdConfState>(
  builder: ActionReducerMapBuilder<S>
) {
  return builder
    .addMatcher(
      osrdEditoastApi.endpoints.getInfraByIdSwitchTypes.matchPending,
      (state: Draft<S>) => {
        state.switchTypes = [];
      }
    )
    .addMatcher(
      osrdEditoastApi.endpoints.getInfraByIdSwitchTypes.matchFulfilled,
      (state: Draft<S>, action) => {
        state.switchTypes = action.payload as S['switchTypes'];
      }
    );
}

export function registerUpdateInfraIDListener(
  listener: ListenerMiddlewareInstance,
  updateInfraID:
    | simulationConfSliceActionsType['updateInfraID']
    | stdcmConfSliceActionsType['updateInfraID']
) {
  listener.startListening({
    actionCreator: updateInfraID,
    effect: (action, listenerApi) => {
      const infraID = action.payload;
      if (infraID) {
        listenerApi.dispatch(
          osrdEditoastApi.endpoints.getInfraByIdSwitchTypes.initiate({ id: infraID })
        );
      }
    },
  });
}
