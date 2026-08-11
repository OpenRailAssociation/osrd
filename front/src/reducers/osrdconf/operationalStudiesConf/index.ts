import { createSlice, type Draft, type PayloadAction } from '@reduxjs/toolkit';

import computeBasePathStep from 'modules/trainSchedule/helpers/computeBasePathStep';
import { isPacedTrainWithDetails } from 'modules/trainSchedule/helpers/pacedTrain';
import type { TrainScheduleWithDetails } from 'modules/trainSchedule/types';
import { buildMapStateReducer } from 'reducers/commonMap';
import { defaultCommonConf, buildCommonConfReducers } from 'reducers/osrdconf/osrdConfCommon';
import type { OperationalStudiesConfState } from 'reducers/osrdconf/types';
import { Duration, startTimeToDate } from 'utils/duration';
import { msToKmh } from 'utils/physics';

import itineraryReducer from './itineraryReducer';
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
      // TODO Hourly timetables: keep the Duration start time in the conf state instead of a fictive date
      state.startTime = startTimeToDate(startTime);

      state.name = name;
      state.category = category ?? null;
      state.initialSpeed = initial_speed ? Math.floor(msToKmh(initial_speed) * 10) / 10 : 0;

      state.usingElectricalProfiles = options?.use_electrical_profiles ?? true;
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
    clearAddedExceptionsList(state: Draft<OperationalStudiesConfState>) {
      state.addedExceptions = [];
    },
  },
});

export const operationalStudiesConfSliceActions = operationalStudiesConfSlice.actions;

export const {
  selectTrainToEdit,
  resetItineraryForm,

  // train settings reducer
  updateRollingStockName,
  clearAddedExceptionsList,
  updateItineraryForm,

  // itinerary reducer
  updatePathSteps,
  deleteItinerary,
  replaceItinerary,
} = operationalStudiesConfSliceActions;

export type OperationalStudiesConfSlice = typeof operationalStudiesConfSlice;

export type OperationalStudiesConfSliceActions = typeof operationalStudiesConfSliceActions;

export default operationalStudiesConfSlice.reducer;
