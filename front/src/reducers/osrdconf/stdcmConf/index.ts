import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Draft } from 'immer';

import { ArrivalTimeTypes, type StdcmSimulationInputs } from 'applications/stdcmV2/types';
import { defaultCommonConf, buildCommonConfReducers } from 'reducers/osrdconf/osrdConfCommon';
import type { OsrdStdcmConfState } from 'reducers/osrdconf/types';

import { removeElementAtIndex } from 'utils/array';
import nextId from 'react-id-generator';
import type { ArrayElement } from 'utils/types';

export const stdcmConfInitialState: OsrdStdcmConfState = {
  stdcmPathSteps: [
    { id: nextId(), isVia: false, arrivalType: ArrivalTimeTypes.PRECISE_TIME },
    { id: nextId(), isVia: false, arrivalType: ArrivalTimeTypes.ASAP },
  ],
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
      action: PayloadAction<StdcmSimulationInputs>
    ) {
      state.rollingStockID = action.payload.consist?.tractionEngine?.id;
      state.stdcmPathSteps = action.payload.pathSteps;
      state.originDatetime = action.payload.departureDatetime;
      state.speedLimitByTag = action.payload.consist?.speedLimitByTag;
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
    updateStdcmEnvironment(
      state: Draft<OsrdStdcmConfState>,
      action: PayloadAction<
        Pick<
          OsrdStdcmConfState,
          | 'infraID'
          | 'timetableID'
          | 'electricalProfileSetId'
          | 'workScheduleGroupId'
          | 'searchDatetimeWindow'
        >
      >
    ) {
      state.infraID = action.payload.infraID;
      state.timetableID = action.payload.timetableID;
      state.electricalProfileSetId = action.payload.electricalProfileSetId;
      state.workScheduleGroupId = action.payload.workScheduleGroupId;
      state.searchDatetimeWindow = action.payload.searchDatetimeWindow;
    },
    updateStdcmPathSteps(
      state: Draft<OsrdStdcmConfState>,
      action: PayloadAction<OsrdStdcmConfState['stdcmPathSteps']>
    ) {
      state.stdcmPathSteps = action.payload;
    },
    updateStdcmPathStep(
      state: Draft<OsrdStdcmConfState>,
      action: PayloadAction<ArrayElement<OsrdStdcmConfState['stdcmPathSteps']>>
    ) {
      const newPathSteps = state.stdcmPathSteps.map((pathStep) =>
        pathStep.id === action.payload.id ? action.payload : pathStep
      );
      state.stdcmPathSteps = newPathSteps;
    },
    deleteStdcmVia(state: Draft<OsrdStdcmConfState>, action: PayloadAction<number>) {
      // Index takes count of the origin in the array
      state.stdcmPathSteps = removeElementAtIndex(state.stdcmPathSteps, action.payload + 1);
    },
  },
});

export const stdcmConfSliceActions = stdcmConfSlice.actions;

export type StdcmConfSlice = typeof stdcmConfSlice;

export type StdcmConfSliceActions = typeof stdcmConfSliceActions;

export default stdcmConfSlice.reducer;
