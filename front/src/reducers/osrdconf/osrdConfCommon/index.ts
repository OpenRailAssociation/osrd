import type { CaseReducer, PayloadAction } from '@reduxjs/toolkit';
import type { Draft } from 'immer';

import { defaultMapSettings, buildMapStateReducer } from 'reducers/commonMap';
import { type InfraStateReducers, buildInfraStateReducers, infraState } from 'reducers/infra';
import type { StdcmConfSlice, StdcmConfSliceActions } from 'reducers/osrdconf/stdcmConf';
import type { StdcmConfSelectors } from 'reducers/osrdconf/stdcmConf/selectors';
import type { OsrdConfState } from 'reducers/osrdconf/types';

import type { OperationalStudiesConfSlice } from '../operationalStudiesConf';

export const defaultCommonConf: OsrdConfState = {
  projectID: undefined,
  studyID: undefined,
  scenarioID: undefined,
  timetableID: undefined,
  electricalProfileSetId: undefined,
  rollingStockID: undefined,
  speedLimitByTag: undefined,
  mapSettings: defaultMapSettings,
  ...infraState,
};

type CommonConfReducers<S extends OsrdConfState> = InfraStateReducers<S> & {
  ['updateTimetableID']: CaseReducer<S, PayloadAction<S['timetableID']>>;
  ['updateRollingStockID']: CaseReducer<S, PayloadAction<S['rollingStockID']>>;
  ['updateSpeedLimitByTag']: CaseReducer<S, PayloadAction<S['speedLimitByTag'] | null>>;
};

export function buildCommonConfReducers<S extends OsrdConfState>(): CommonConfReducers<S> {
  return {
    ...buildInfraStateReducers<S>(),
    ...buildMapStateReducer<OsrdConfState>(),
    updateTimetableID(state: Draft<S>, action: PayloadAction<S['timetableID']>) {
      state.timetableID = action.payload;
    },
    updateRollingStockID(state: Draft<S>, action: PayloadAction<S['rollingStockID']>) {
      state.rollingStockID = action.payload;
    },
    updateSpeedLimitByTag(state: Draft<S>, action: PayloadAction<S['speedLimitByTag'] | null>) {
      state.speedLimitByTag = action.payload === null ? undefined : action.payload;
    },
  };
}

export type ConfSlice = OperationalStudiesConfSlice | StdcmConfSlice;

export type ConfSliceActions = StdcmConfSliceActions;

export type ConfSelectors = StdcmConfSelectors;
