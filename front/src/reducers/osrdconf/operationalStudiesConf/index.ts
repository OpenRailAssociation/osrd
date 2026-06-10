import { createSlice, type Draft, type PayloadAction } from '@reduxjs/toolkit';

import computeBasePathStep from 'modules/trainSchedule/helpers/computeBasePathStep';
import { isPacedTrainWithDetails } from 'modules/trainSchedule/helpers/pacedTrain';
import type { SuggestedOP, TrainScheduleWithDetails } from 'modules/trainSchedule/types';
import { buildMapStateReducer } from 'reducers/commonMap';
import { defaultCommonConf, buildCommonConfReducers } from 'reducers/osrdconf/osrdConfCommon';
import type { OperationalStudiesConfState } from 'reducers/osrdconf/types';
import { Duration } from 'utils/duration';
import { msToKmh } from 'utils/physics';

import { upsertPathStep } from '../helpers';
import itineraryReducer from './itineraryReducer';
import powerRestrictionReducer from './powerRestrictionReducer';
import trainSettingsReducer from './trainSettingsReducer';

export const operationalStudiesInitialConf: OperationalStudiesConfState = {
  ...defaultCommonConf,
  name: '',
  startTime: new Date(),
  initialSpeed: 0,
  labels: [],
  rollingStockName: '',
  rollingStockComfort: 'STANDARD',
  category: null,
  // Corresponds to origin and destination not defined
  pathSteps: [null, null],
  constraintDistribution: 'STANDARD',
  usingElectricalProfiles: true,
  usingSpeedLimits: true,
  stopsAtEndOfBlock: false,
  powerRestriction: [],
  timeWindow: new Duration({ minutes: 120 }),
  interval: new Duration({ minutes: 60 }),
  addedExceptions: [],
  editingTrainType: 'uniqueTrain',
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
        trainSchedule: TrainScheduleWithDetails;
        isOccurrence?: boolean;
      }>
    ) {
      const {
        rollingStock,
        rollingStockName,
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
      } = action.payload.trainSchedule;

      state.rollingStockName = rollingStockName;
      state.rollingStockID = rollingStock?.id;
      state.pathSteps = path.map((_, index) =>
        computeBasePathStep(action.payload.trainSchedule, index)
      );
      state.startTime = startTime;

      state.name = name;
      state.category = category ?? null;
      state.initialSpeed = initial_speed ? Math.floor(msToKmh(initial_speed) * 10) / 10 : 0;

      state.usingElectricalProfiles = options?.use_electrical_profiles ?? true;
      state.usingSpeedLimits = options?.use_speed_limits_for_simulation ?? true;
      state.stopsAtEndOfBlock = options?.stops_at_end_of_block ?? false;
      state.labels = labels;
      state.speedLimitByTag = speedLimitTag || undefined;
      state.powerRestriction = power_restrictions || [];
      state.constraintDistribution = constraint_distribution || 'STANDARD';

      if (isPacedTrainWithDetails(action.payload.trainSchedule)) {
        state.editingTrainType = action.payload.isOccurrence ? 'occurrence' : 'pacedTrain';
        state.timeWindow = action.payload.trainSchedule.paced.timeWindow;
        state.interval = action.payload.trainSchedule.paced.interval;
      } else {
        state.editingTrainType = 'uniqueTrain';
        state.timeWindow = new Duration({ minutes: 120 });
        state.interval = new Duration({ minutes: 60 });
      }
    },
    // Clears stale data left by selectTrainToEdit/updateItineraryForm so a new train form starts empty
    resetItineraryForm(state: Draft<OperationalStudiesConfState>) {
      return {
        ...operationalStudiesInitialConf,
        mapSettings: state.mapSettings,
        infraID: state.infraID,
      };
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
        startTime: action.payload,
      });
    },
    deleteAddedException(state: Draft<OperationalStudiesConfState>, action: PayloadAction<number>) {
      const indexToDelete = action.payload;
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
  resetItineraryForm,
  resetUsingSpeedLimits,

  // train settings reducer
  updateName,
  updateStartTime,
  updateInitialSpeed,
  updateLabels,
  updateRollingStockName,
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
  toggleEditingTrainType,
  updateCategory,
  updateItineraryForm,

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
