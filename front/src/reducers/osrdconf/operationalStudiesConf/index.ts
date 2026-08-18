import { createSlice } from '@reduxjs/toolkit';

import { buildMapStateReducer } from 'reducers/commonMap';
import { defaultCommonConf, buildCommonConfReducers } from 'reducers/osrdconf/osrdConfCommon';
import type { OperationalStudiesConfState } from 'reducers/osrdconf/types';

export const operationalStudiesInitialConf: OperationalStudiesConfState = {
  ...defaultCommonConf,
};

export const operationalStudiesConfSlice = createSlice({
  name: 'operationalStudiesConf',
  initialState: operationalStudiesInitialConf,
  reducers: {
    ...buildCommonConfReducers<OperationalStudiesConfState>(),
    ...buildMapStateReducer<OperationalStudiesConfState>(),
  },
});

export const operationalStudiesConfSliceActions = operationalStudiesConfSlice.actions;
export type OperationalStudiesConfSlice = typeof operationalStudiesConfSlice;

export default operationalStudiesConfSlice.reducer;
