import { createSlice } from '@reduxjs/toolkit';

import type { OsrdConfState } from 'applications/operationalStudies/consts';

import { defaultCommonConf, buildCommonConfReducers } from 'reducers/osrdconf/osrdConfCommon';

export type OperationalStudiesConfState = OsrdConfState;

export const operationalStudiesConfSlice = createSlice({
  name: 'operationalStudiesConf',
  initialState: defaultCommonConf,
  reducers: {
    ...buildCommonConfReducers<OperationalStudiesConfState>(),
  },
});

export const operationalStudiesConfSliceActions = operationalStudiesConfSlice.actions;

export type OperationalStudiesConfSlice = typeof operationalStudiesConfSlice;

export type OperationalStudiesConfSliceActions = typeof operationalStudiesConfSliceActions;

export default operationalStudiesConfSlice.reducer;
