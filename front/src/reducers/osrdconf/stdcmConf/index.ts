import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Draft } from 'immer';

import type { ArrivalTimeTypes } from 'applications/stdcmV2/types';
import { defaultCommonConf, buildCommonConfReducers } from 'reducers/osrdconf/osrdConfCommon';
import type { OsrdStdcmConfState } from 'reducers/osrdconf/types';

import { updateOriginPathStep, updateDestinationPathStep } from '../helpers';

export const stdcmConfInitialState: OsrdStdcmConfState = {
  maximumRunTime: 43200,
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
      state.pathSteps = stdcmConfInitialState.pathSteps;
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
      action: PayloadAction<
        Pick<
          OsrdStdcmConfState,
          'rollingStockID' | 'pathSteps' | 'originDate' | 'originTime' | 'speedLimitByTag'
        >
      >
    ) {
      state.rollingStockID = action.payload.rollingStockID;
      state.pathSteps = action.payload.pathSteps;
      state.originDate = action.payload.originDate;
      state.originTime = action.payload.originTime;
      state.speedLimitByTag = action.payload.speedLimitByTag;
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
      state.searchDatetimeWindow = action.payload.searchDatetimeWindow;
      if (action.payload.workScheduleGroupId) {
        state.workScheduleGroupId = action.payload.workScheduleGroupId;
      }
    },
    updateOriginArrival(
      state: Draft<OsrdStdcmConfState>,
      action: PayloadAction<string | undefined>
    ) {
      state.pathSteps = updateOriginPathStep(state.pathSteps, { arrival: action.payload });
    },
    updateDestinationArrival(
      state: Draft<OsrdStdcmConfState>,
      action: PayloadAction<string | undefined>
    ) {
      state.pathSteps = updateDestinationPathStep(state.pathSteps, { arrival: action.payload });
    },
    updateOriginArrivalType(
      state: Draft<OsrdStdcmConfState>,
      action: PayloadAction<ArrivalTimeTypes>
    ) {
      state.pathSteps = updateOriginPathStep(state.pathSteps, { arrivalType: action.payload });
    },
    updateDestinationArrivalType(
      state: Draft<OsrdStdcmConfState>,
      action: PayloadAction<ArrivalTimeTypes>
    ) {
      state.pathSteps = updateDestinationPathStep(state.pathSteps, { arrivalType: action.payload });
    },
    updateOriginTolerances(
      state: Draft<OsrdStdcmConfState>,
      action: PayloadAction<{ toleranceBefore: number; toleranceAfter: number }>
    ) {
      state.pathSteps = updateOriginPathStep(state.pathSteps, {
        arrivalToleranceBefore: action.payload.toleranceBefore,
        arrivalToleranceAfter: action.payload.toleranceAfter,
      });
    },
    updateDestinationTolerances(
      state: Draft<OsrdStdcmConfState>,
      action: PayloadAction<{ toleranceBefore: number; toleranceAfter: number }>
    ) {
      state.pathSteps = updateDestinationPathStep(state.pathSteps, {
        arrivalToleranceBefore: action.payload.toleranceBefore,
        arrivalToleranceAfter: action.payload.toleranceAfter,
      });
    },
  },
});

export const stdcmConfSliceActions = stdcmConfSlice.actions;

export type StdcmConfSlice = typeof stdcmConfSlice;

export type StdcmConfSliceActions = typeof stdcmConfSliceActions;

export default stdcmConfSlice.reducer;
