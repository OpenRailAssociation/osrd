import { createSlice } from '@reduxjs/toolkit';

import { buildMapStateReducer } from 'reducers/commonMap';
import { defaultCommonConf, buildCommonConfReducers } from 'reducers/osrdconf/osrdConfCommon';

import type { OsrdConfState } from '../types';

export const operationalStudiesInitialConf: OsrdConfState = {
  ...defaultCommonConf,
};

export const operationalStudiesConfSlice = createSlice({
  name: 'operationalStudiesConf',
  initialState: operationalStudiesInitialConf,
  reducers: {
    ...buildCommonConfReducers<OsrdConfState>(),
    ...buildMapStateReducer<OsrdConfState>(),
  },
});

export const operationalStudiesConfSliceActions = operationalStudiesConfSlice.actions;
export type OperationalStudiesConfSlice = typeof operationalStudiesConfSlice;

export default operationalStudiesConfSlice.reducer;
