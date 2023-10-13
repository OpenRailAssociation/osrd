import { createSlice, ListenerMiddlewareInstance, PayloadAction } from '@reduxjs/toolkit';
import { DEFAULT_STDCM_MODE, OsrdStdcmConfState } from 'applications/operationalStudies/consts';
import { Draft } from 'immer';
import {
  defaultCommonConf,
  buildCommonOsrdConfReducers,
  registerUpdateInfraIDListener,
  addCommonOsrdConfMatchers,
} from '../common';

export const stdcmConfInitialState: OsrdStdcmConfState = {
  maximumRunTime: 43200,
  stdcmMode: DEFAULT_STDCM_MODE,
  standardStdcmAllowance: undefined,
  ...defaultCommonConf,
};

export const stdcmConfSlice = createSlice({
  name: 'stdcmconf',
  initialState: stdcmConfInitialState,
  reducers: {
    ...buildCommonOsrdConfReducers<OsrdStdcmConfState>(),
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
  extraReducers: (builder) => {
    addCommonOsrdConfMatchers(builder);
  },
});

export const stdcmConfSliceActions = stdcmConfSlice.actions;

export function registerStdcmUpdateInfraIDListeners(listener: ListenerMiddlewareInstance) {
  registerUpdateInfraIDListener(listener, stdcmConfSliceActions.updateInfraID);
}

export type stdcmConfSliceType = typeof stdcmConfSlice;

export type stdcmConfSliceActionsType = typeof stdcmConfSliceActions;

export default stdcmConfSlice.reducer;