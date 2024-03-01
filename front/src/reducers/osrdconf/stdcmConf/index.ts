import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Draft } from 'immer';
import { defaultCommonConf, buildCommonConfReducers } from 'reducers/osrdconf/osrdConfCommon';
import type { OsrdStdcmConfState } from 'reducers/osrdconf/consts';

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
