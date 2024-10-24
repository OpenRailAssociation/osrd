import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Draft } from 'immer';
import nextId from 'react-id-generator';

import { ArrivalTimeTypes, StdcmStopTypes } from 'applications/stdcm/types';
import { defaultCommonConf, buildCommonConfReducers } from 'reducers/osrdconf/osrdConfCommon';
import type { OsrdStdcmConfState } from 'reducers/osrdconf/types';
import { addElementAtIndex } from 'utils/array';
import type { ArrayElement } from 'utils/types';

export const stdcmConfInitialState: OsrdStdcmConfState = {
  // TODO: remove all the default uic values
  stdcmPathSteps: [
    { id: nextId(), uic: -1, isVia: false, arrivalType: ArrivalTimeTypes.PRECISE_TIME },
    { id: nextId(), uic: -1, isVia: false, arrivalType: ArrivalTimeTypes.ASAP },
  ],
  standardStdcmAllowance: undefined,
  totalMass: undefined,
  totalLength: undefined,
  maxSpeed: undefined,
  ...defaultCommonConf,
};

export const stdcmConfSlice = createSlice({
  name: 'stdcmConf',
  initialState: stdcmConfInitialState,
  reducers: {
    ...buildCommonConfReducers<OsrdStdcmConfState>(),
    resetStdcmConfig(state: Draft<OsrdStdcmConfState>) {
      state.rollingStockID = stdcmConfInitialState.rollingStockID;
      state.stdcmPathSteps = stdcmConfInitialState.stdcmPathSteps;
      state.speedLimitByTag = stdcmConfInitialState.speedLimitByTag;
    },
    updateTotalMass(
      state: Draft<OsrdStdcmConfState>,
      action: PayloadAction<OsrdStdcmConfState['totalMass']>
    ) {
      state.totalMass = action.payload;
    },
    updateTotalLength(
      state: Draft<OsrdStdcmConfState>,
      action: PayloadAction<OsrdStdcmConfState['totalLength']>
    ) {
      state.totalLength = action.payload;
    },
    updateMaxSpeed(
      state: Draft<OsrdStdcmConfState>,
      action: PayloadAction<OsrdStdcmConfState['maxSpeed']>
    ) {
      state.maxSpeed = action.payload;
    },
    updateStdcmConfigWithData(
      state: Draft<OsrdStdcmConfState>,
      action: PayloadAction<
        Pick<OsrdStdcmConfState, 'rollingStockID' | 'pathSteps' | 'speedLimitByTag'>
      >
    ) {
      state.rollingStockID = action.payload.rollingStockID;
      state.pathSteps = action.payload.pathSteps;
      state.speedLimitByTag = action.payload.speedLimitByTag;
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
      state.searchDatetimeWindow = action.payload.searchDatetimeWindow;
      if (action.payload.workScheduleGroupId) {
        state.workScheduleGroupId = action.payload.workScheduleGroupId;
      }
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
    addStdcmVia(state: Draft<OsrdStdcmConfState>, action: PayloadAction<number>) {
      // Index takes count of the origin in the array
      state.stdcmPathSteps = addElementAtIndex(state.stdcmPathSteps, action.payload, {
        id: nextId(),
        uic: -1,
        stopType: StdcmStopTypes.PASSAGE_TIME,
        isVia: true,
      });
    },
    deleteStdcmVia(state: Draft<OsrdStdcmConfState>, action: PayloadAction<string>) {
      state.stdcmPathSteps = state.stdcmPathSteps.filter(
        (pathStep) => pathStep.id !== action.payload
      );
    },
  },
});

export const stdcmConfSliceActions = stdcmConfSlice.actions;

export type StdcmConfSlice = typeof stdcmConfSlice;

export type StdcmConfSliceActions = typeof stdcmConfSliceActions;

export default stdcmConfSlice.reducer;
