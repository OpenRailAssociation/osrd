import type { PayloadAction } from '@reduxjs/toolkit';
import type { Draft } from 'immer';

import type { ItineraryForm, OperationalStudiesConfState } from '../types';

const trainSettingsReducer = {
  updateRollingStockName(
    state: Draft<OperationalStudiesConfState>,
    action: PayloadAction<OperationalStudiesConfState['rollingStockName']>
  ) {
    state.rollingStockName = action.payload;
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
