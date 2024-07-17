import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Draft } from 'immer';

import { defaultCommonConf, buildCommonConfReducers } from 'reducers/osrdconf/osrdConfCommon';
import type { OsrdStdcmConfState } from 'reducers/osrdconf/types';

export const stdcmConfInitialState: OsrdStdcmConfState = {
  maximumRunTime: 43200,
  standardStdcmAllowance: undefined,
  ...defaultCommonConf,
};

export const stdcmConfSlice = createSlice({
  name: 'stdcmConf',
  initialState: stdcmConfInitialState,
  reducers: {
    ...buildCommonConfReducers<OsrdStdcmConfState>(),
    resetStdcmConfig(state: Draft<OsrdStdcmConfState>) {
      state.rollingStockID = stdcmConfInitialState.rollingStockID;
      state.pathSteps = stdcmConfInitialState.pathSteps;
      state.originDate = stdcmConfInitialState.originDate;
      state.originTime = stdcmConfInitialState.originTime;
      state.speedLimitByTag = stdcmConfInitialState.speedLimitByTag;
    },
    updateStdcmConfigWithData(
      state: Draft<OsrdStdcmConfState>,
      action: PayloadAction<
        Pick<
          OsrdStdcmConfState,
          'rollingStockID' | 'pathSteps' | 'originDate' | 'originTime' | 'speedLimitByTag'
        >
      >
    ) {
      state.rollingStockID = action.payload.rollingStockID;
      state.pathSteps = action.payload.pathSteps;
      state.originDate = action.payload.originDate;
      state.originTime = action.payload.originTime;
      state.speedLimitByTag = action.payload.speedLimitByTag;
    },
    updateMaximumRunTime(
      state: Draft<OsrdStdcmConfState>,
      action: PayloadAction<OsrdStdcmConfState['maximumRunTime']>
    ) {
      state.maximumRunTime = action.payload;
    },
    updateStdcmStandardAllowance(
      state: Draft<OsrdStdcmConfState>,
      action: PayloadAction<OsrdStdcmConfState['standardStdcmAllowance']>
    ) {
      state.standardStdcmAllowance = action.payload;
    },
  },
});

export const stdcmConfSliceActions = stdcmConfSlice.actions;

export type StdcmConfSlice = typeof stdcmConfSlice;

export type StdcmConfSliceActions = typeof stdcmConfSliceActions;

export default stdcmConfSlice.reducer;
