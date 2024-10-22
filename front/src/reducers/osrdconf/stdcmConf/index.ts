import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Draft } from 'immer';

import {
  ArrivalTimeTypes,
  StdcmStopTypes,
  type StdcmSimulationInputs,
} from 'applications/stdcmV2/types';
import { defaultCommonConf, buildCommonConfReducers } from 'reducers/osrdconf/osrdConfCommon';
import type { OsrdStdcmConfState } from 'reducers/osrdconf/types';

import type { ArrayElement } from 'utils/types';
import { addElementAtIndex } from 'utils/array';
import nextId from 'react-id-generator';

export const stdcmConfInitialState: OsrdStdcmConfState = {
  ...defaultCommonConf,
  stdcmPathSteps: [
    { id: nextId(), isVia: false, arrivalType: ArrivalTimeTypes.PRECISE_TIME },
    { id: nextId(), isVia: false, arrivalType: ArrivalTimeTypes.ASAP },
  ],
  maximumRunTime: 43200,
  standardStdcmAllowance: undefined,
  totalMass: undefined,
  totalLength: undefined,
  maxSpeed: undefined,
};

export const stdcmConfSlice = createSlice({
  name: 'stdcmConf',
  initialState: stdcmConfInitialState,
  reducers: {
    ...buildCommonConfReducers<OsrdStdcmConfState>(),
    resetStdcmConfig(state: Draft<OsrdStdcmConfState>) {
      state.rollingStockID = stdcmConfInitialState.rollingStockID;
      state.stdcmPathSteps = stdcmConfInitialState.stdcmPathSteps;
      state.originDate = stdcmConfInitialState.originDate;
      state.originTime = stdcmConfInitialState.originTime;
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
    addStdcmVia(state: Draft<OsrdStdcmConfState>, action: PayloadAction<number>) {
      // Index takes count of the origin in the array
      state.stdcmPathSteps = addElementAtIndex(state.stdcmPathSteps, action.payload, {
        id: nextId(),
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
