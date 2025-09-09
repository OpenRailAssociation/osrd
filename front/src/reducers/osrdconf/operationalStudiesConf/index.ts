import { createSlice, type Draft, type PayloadAction } from '@reduxjs/toolkit';
import { v4 as uuidV4 } from 'uuid';

import computeBasePathStep from 'modules/timetableItem/helpers/computeBasePathStep';
import type {
  PacedTrainWithDetails,
  SuggestedOP,
  TrainScheduleWithDetails,
} from 'modules/timetableItem/types';
import { buildMapStateReducer } from 'reducers/commonMap';
import { defaultCommonConf, buildCommonConfReducers } from 'reducers/osrdconf/osrdConfCommon';
import type { OperationalStudiesConfState } from 'reducers/osrdconf/types';
import { Duration } from 'utils/duration';
import { msToKmh } from 'utils/physics';
import { isPacedTrainWithDetails } from 'utils/trainId';

import powerRestrictionReducer from './powerRestrictionReducer';
import trainSettingsReducer from './trainSettingsReducer';
import { upsertPathStep } from '../helpers';
import itineraryReducer from './itineraryReducer';

export const operationalStudiesInitialConf: OperationalStudiesConfState = {
  ...defaultCommonConf,
  name: '',
  startTime: new Date(),
  initialSpeed: 0,
  labels: [],
  rollingStockComfort: 'STANDARD',
  category: null,
  // Corresponds to origin and destination not defined
  pathSteps: [null, null],
  constraintDistribution: 'MARECO',
  usingElectricalProfiles: true,
  usingSpeedLimits: true,
  powerRestriction: [],
  timeWindow: new Duration({ minutes: 120 }),
  interval: new Duration({ minutes: 60 }),
  addedExceptions: [],
  editingItemType: 'trainSchedule',
};

export const operationalStudiesConfSlice = createSlice({
  name: 'operationalStudiesConf',
  initialState: operationalStudiesInitialConf,
  reducers: {
    ...buildCommonConfReducers<OperationalStudiesConfState>(),
    ...buildMapStateReducer<OperationalStudiesConfState>(),

    ...powerRestrictionReducer,
    ...trainSettingsReducer,
    ...itineraryReducer,
    selectTrainToEdit(
      state: Draft<OperationalStudiesConfState>,
      action: PayloadAction<{
        item: TrainScheduleWithDetails | PacedTrainWithDetails;
        isOccurrence?: boolean;
      }>
    ) {
      const {
        rollingStock,
        name,
        initial_speed,
        startTime,
        options,
        speedLimitTag,
        labels,
        power_restrictions,
        path,
        constraint_distribution,
        category,
      } = action.payload.item;

      state.rollingStockID = rollingStock?.id;
      state.pathSteps = path.map((_, index) => computeBasePathStep(action.payload.item, index));
      state.startTime = startTime;

      state.name = name;
      state.category = category ?? null;
      state.initialSpeed = initial_speed ? Math.floor(msToKmh(initial_speed) * 10) / 10 : 0;

      state.usingElectricalProfiles = options?.use_electrical_profiles ?? true;
      state.usingSpeedLimits = options?.use_speed_limits_for_simulation ?? true;
      state.labels = labels;
      state.speedLimitByTag = speedLimitTag || undefined;
      state.powerRestriction = power_restrictions || [];
      state.constraintDistribution = constraint_distribution || 'STANDARD';

      if (isPacedTrainWithDetails(action.payload.item)) {
        state.editingItemType = action.payload.isOccurrence ? 'occurrence' : 'pacedTrain';
        state.timeWindow = action.payload.item.paced.timeWindow;
        state.interval = action.payload.item.paced.interval;
      } else {
        state.editingItemType = 'trainSchedule';
        state.timeWindow = new Duration({ minutes: 120 });
        state.interval = new Duration({ minutes: 60 });
      }
    },
    // Use this action to transform an op to via from times and stop table or
    // from the suggested via modal
    upsertViaFromSuggestedOP(
      state: Draft<OperationalStudiesConfState>,
      action: PayloadAction<SuggestedOP>
    ) {
      upsertPathStep(state.pathSteps, action.payload);
    },
    upsertSeveralViasFromSuggestedOP(
      state: Draft<OperationalStudiesConfState>,
      action: PayloadAction<SuggestedOP[]>
    ) {
      action.payload.forEach((suggestedOp) => {
        upsertPathStep(state.pathSteps, suggestedOp);
      });
    },
    resetUsingSpeedLimits(state: Draft<OperationalStudiesConfState>) {
      state.usingSpeedLimits = true;
    },
    addAddedException(state: Draft<OperationalStudiesConfState>, action: PayloadAction<Date>) {
      state.addedExceptions.push({
        key: uuidV4(),
        startTime: action.payload,
      });
    },
    deleteAddedException(state: Draft<OperationalStudiesConfState>, action: PayloadAction<string>) {
      const indexToDelete = state.addedExceptions.findIndex((e) => e.key === action.payload);
      state.addedExceptions.splice(indexToDelete, 1);
    },
    clearAddedExceptionsList(state: Draft<OperationalStudiesConfState>) {
      state.addedExceptions = [];
    },
  },
});

export const operationalStudiesConfSliceActions = operationalStudiesConfSlice.actions;

export const {
  selectTrainToEdit,
  resetUsingSpeedLimits,

  // train settings reducer
  updateName,
  updateStartTime,
  updateInitialSpeed,
  updateLabels,
  updateRollingStockComfort,
  updateConstraintDistribution,
  toggleUsingElectricalProfiles,
  upsertViaFromSuggestedOP,
  upsertSeveralViasFromSuggestedOP,
  updateTimeWindow,
  updateInterval,
  addAddedException,
  deleteAddedException,
  clearAddedExceptionsList,
  toggleEditingItemType,
  updateCategory,

  // itinerary reducer
  updatePathSteps,
  deleteItinerary,
  replaceItinerary,

  // power restrictions reducer
  upsertPowerRestrictionRanges,
  cutPowerRestrictionRanges,
  mergePowerRestrictionRanges,
  deletePowerRestrictionRanges,
  resizeSegmentEndInput,
  resizeSegmentBeginInput,
  cleanPowerRestrictionsCoveredByANewRange,
} = operationalStudiesConfSliceActions;

export type OperationalStudiesConfSlice = typeof operationalStudiesConfSlice;

export type OperationalStudiesConfSliceActions = typeof operationalStudiesConfSliceActions;

export default operationalStudiesConfSlice.reducer;
