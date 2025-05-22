import { createSlice, type Draft, type PayloadAction } from '@reduxjs/toolkit';

import type { SuggestedOP } from 'modules/trainschedule/components/ManageTrainSchedule/types';
import type {
  PacedTrainWithDetails,
  TrainScheduleWithDetails,
} from 'modules/trainschedule/components/Timetable/types';
import computeBasePathStep from 'modules/trainschedule/helpers/computeBasePathStep';
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
  editingItemType: 'trainSchedule',
};

export const operationalStudiesConfSlice = createSlice({
  name: 'operationalStudiesConf',
  initialState: operationalStudiesInitialConf,
  reducers: {
    ...buildCommonConfReducers<OperationalStudiesConfState>(),
    ...powerRestrictionReducer,
    ...trainSettingsReducer,
    ...itineraryReducer,
    selectTrainToEdit(
      state: Draft<OperationalStudiesConfState>,
      action: PayloadAction<TrainScheduleWithDetails | PacedTrainWithDetails>
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
      } = action.payload;

      state.rollingStockID = rollingStock?.id;
      state.pathSteps = path.map((_, index) => computeBasePathStep(action.payload, index));
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

      if (isPacedTrainWithDetails(action.payload)) {
        state.editingItemType = 'pacedTrain';
        state.timeWindow = action.payload.paced.timeWindow;
        state.interval = action.payload.paced.interval;
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
