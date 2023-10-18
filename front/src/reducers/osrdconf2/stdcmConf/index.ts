import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { DEFAULT_STDCM_MODE, OsrdStdcmConfState } from 'applications/operationalStudies/consts';
import { Draft } from 'immer';
import { defaultCommonConf, buildCommonConfReducers } from '../common';

export const stdcmConfInitialState: OsrdStdcmConfState = {
  maximumRunTime: 43200,
  stdcmMode: DEFAULT_STDCM_MODE,
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
    updateStdcmMode(
      state: Draft<OsrdStdcmConfState>,
      action: PayloadAction<OsrdStdcmConfState['stdcmMode']>
    ) {
      state.stdcmMode = action.payload;
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

export type stdcmConfSliceType = typeof stdcmConfSlice;

export type stdcmConfSliceActionsType = typeof stdcmConfSliceActions;

export default stdcmConfSlice.reducer;
