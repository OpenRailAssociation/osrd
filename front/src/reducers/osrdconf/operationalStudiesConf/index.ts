import { createSlice } from '@reduxjs/toolkit';

import { defaultCommonConf, buildCommonConfReducers } from 'reducers/osrdconf/osrdConfCommon';
import type { OsrdConfState } from 'reducers/osrdconf/types';

import { builPowerRestrictionReducer } from './powerRestrictionReducer';

export type OperationalStudiesConfState = OsrdConfState;

export const operationalStudiesConfSlice = createSlice({
  name: 'operationalStudiesConf',
  initialState: defaultCommonConf,
  reducers: {
    ...buildCommonConfReducers<OperationalStudiesConfState>(),
    ...builPowerRestrictionReducer<OperationalStudiesConfState>(),
  },
});

export const operationalStudiesConfSliceActions = operationalStudiesConfSlice.actions;

export type OperationalStudiesConfSlice = typeof operationalStudiesConfSlice;

export type OperationalStudiesConfSliceActions = typeof operationalStudiesConfSliceActions;

export default operationalStudiesConfSlice.reducer;
