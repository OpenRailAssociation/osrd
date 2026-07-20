import type { PayloadAction } from '@reduxjs/toolkit';
import type { Draft } from 'immer';

import type { ItineraryForm, OperationalStudiesConfState } from '../types';

const trainSettingsReducer = {
  updateConstraintDistribution(
    state: Draft<OperationalStudiesConfState>,
    action: PayloadAction<OperationalStudiesConfState['constraintDistribution']>
  ) {
    state.constraintDistribution = action.payload;
  },
  updateName(
    state: Draft<OperationalStudiesConfState>,
    action: PayloadAction<OperationalStudiesConfState['name']>
  ) {
    state.name = action.payload;
  },
  updateCategory(
    state: Draft<OperationalStudiesConfState>,
    action: PayloadAction<OperationalStudiesConfState['category']>
  ) {
    state.category = action.payload;
  },
  toggleUsingElectricalProfiles(state: Draft<OperationalStudiesConfState>) {
    state.usingElectricalProfiles = !state.usingElectricalProfiles;
  },
  updateLabels(
    state: Draft<OperationalStudiesConfState>,
    action: PayloadAction<OperationalStudiesConfState['labels']>
  ) {
    state.labels = action.payload;
  },
  updateInitialSpeed(
    state: Draft<OperationalStudiesConfState>,
    action: PayloadAction<OperationalStudiesConfState['initialSpeed']>
  ) {
    state.initialSpeed = action.payload;
  },
  updateStartTime(
    state: Draft<OperationalStudiesConfState>,
    action: PayloadAction<OperationalStudiesConfState['startTime']>
  ) {
    state.startTime = action.payload;
  },
  updateRollingStockName(
    state: Draft<OperationalStudiesConfState>,
    action: PayloadAction<OperationalStudiesConfState['rollingStockName']>
  ) {
    state.rollingStockName = action.payload;
  },
  updateRollingStockComfort(
    state: Draft<OperationalStudiesConfState>,
    action: PayloadAction<OperationalStudiesConfState['rollingStockComfort']>
  ) {
    state.rollingStockComfort = action.payload;
  },
  updateTimeWindow(
    state: Draft<OperationalStudiesConfState>,
    action: PayloadAction<OperationalStudiesConfState['timeWindow']>
  ) {
    state.timeWindow = action.payload;
  },
  updateInterval(
    state: Draft<OperationalStudiesConfState>,
    action: PayloadAction<OperationalStudiesConfState['interval']>
  ) {
    state.interval = action.payload;
  },
  toggleEditingTrainType(state: Draft<OperationalStudiesConfState>) {
    state.editingTrainType = state.editingTrainType === 'pacedTrain' ? 'uniqueTrain' : 'pacedTrain';
  },
  updateItineraryForm(
    state: Draft<OperationalStudiesConfState>,
    action: PayloadAction<ItineraryForm>
  ) {
    state.name = action.payload.name;
    state.category = action.payload.category;
    state.rollingStockID = action.payload.rollingStockId;
    state.rollingStockName = action.payload.rollingStockName;
    state.speedLimitByTag = action.payload.speedLimitTag;
    state.pathSteps = action.payload.pathSteps;

    if (action.payload.trainType) {
      state.editingTrainType = action.payload.trainType;
    }
  },
};

export default trainSettingsReducer;
