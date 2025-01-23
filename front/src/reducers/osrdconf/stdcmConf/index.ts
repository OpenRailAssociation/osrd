import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Draft } from 'immer';
import { v4 as uuidV4 } from 'uuid';

import {
  ArrivalTimeTypes,
  StdcmStopTypes,
  type ExtremityPathStepType,
  type StdcmLinkedTrainExtremity,
} from 'applications/stdcm/types';
import { defaultCommonConf, buildCommonConfReducers } from 'reducers/osrdconf/osrdConfCommon';
import type { OsrdStdcmConfState, StdcmPathStep } from 'reducers/osrdconf/types';
import { addElementAtIndex } from 'utils/array';
import { isArrivalDateInSearchTimeWindow } from 'utils/date';
import type { ArrayElement, PickAndNonNullableFields } from 'utils/types';

const DEFAULT_TOLERANCE = 1800; // 30min

export const stdcmConfInitialState: OsrdStdcmConfState = {
  stdcmPathSteps: [
    {
      id: uuidV4(),
      isVia: false,
      arrivalType: ArrivalTimeTypes.PRECISE_TIME,
      tolerances: { before: DEFAULT_TOLERANCE, after: DEFAULT_TOLERANCE },
    },
    {
      id: uuidV4(),
      isVia: false,
      arrivalType: ArrivalTimeTypes.ASAP,
      tolerances: { before: DEFAULT_TOLERANCE, after: DEFAULT_TOLERANCE },
    },
  ],
  margins: {
    standardAllowance: { type: 'time_per_distance', value: 4.5 },
    gridMarginBefore: 15,
    gridMarginAfter: 15,
  },
  totalMass: undefined,
  totalLength: undefined,
  maxSpeed: undefined,
  towedRollingStockID: undefined,
  linkedTrains: {
    anteriorTrain: undefined,
    posteriorTrain: undefined,
  },
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
      state.towedRollingStockID = stdcmConfInitialState.towedRollingStockID;
      state.totalLength = stdcmConfInitialState.totalLength;
      state.totalMass = stdcmConfInitialState.totalMass;
      state.maxSpeed = stdcmConfInitialState.maxSpeed;
      state.speedLimitByTag = stdcmConfInitialState.speedLimitByTag;
      state.linkedTrains = stdcmConfInitialState.linkedTrains;
    },
    restoreStdcmConfig(
      _state: Draft<OsrdStdcmConfState>,
      action: PayloadAction<OsrdStdcmConfState>
    ) {
      return action.payload;
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
    updateTowedRollingStockID(
      state: Draft<OsrdStdcmConfState>,
      action: PayloadAction<OsrdStdcmConfState['towedRollingStockID']>
    ) {
      state.towedRollingStockID = action.payload;
    },
    updateStdcmConfigWithData(
      state: Draft<OsrdStdcmConfState>,
      action: PayloadAction<
        Pick<
          OsrdStdcmConfState,
          | 'rollingStockID'
          | 'towedRollingStockID'
          | 'stdcmPathSteps'
          | 'speedLimitByTag'
          | 'totalLength'
          | 'totalMass'
          | 'maxSpeed'
        >
      >
    ) {
      state.rollingStockID = action.payload.rollingStockID;
      state.towedRollingStockID = action.payload.towedRollingStockID;
      state.totalLength = action.payload.totalLength;
      state.totalMass = action.payload.totalMass;
      state.maxSpeed = action.payload.maxSpeed;
      state.stdcmPathSteps = action.payload.stdcmPathSteps;
      state.speedLimitByTag = action.payload.speedLimitByTag;
    },
    resetMargins(state: Draft<OsrdStdcmConfState>) {
      state.margins = {
        standardAllowance: { type: 'time_per_distance', value: 4.5 },
        gridMarginBefore: 15,
        gridMarginAfter: 15,
      };
    },
    updateStandardAllowance(
      state: Draft<OsrdStdcmConfState>,
      action: PayloadAction<OsrdStdcmConfState['margins']['standardAllowance']>
    ) {
      state.margins = { ...state.margins, standardAllowance: action.payload };
    },
    updateGridMarginBefore(
      state: Draft<OsrdStdcmConfState>,
      action: PayloadAction<OsrdStdcmConfState['margins']['gridMarginBefore']>
    ) {
      state.margins = { ...state.margins, gridMarginBefore: action.payload };
    },
    updateGridMarginAfter(
      state: Draft<OsrdStdcmConfState>,
      action: PayloadAction<OsrdStdcmConfState['margins']['gridMarginAfter']>
    ) {
      state.margins = { ...state.margins, gridMarginAfter: action.payload };
    },
    updateStdcmEnvironment(
      state: Draft<OsrdStdcmConfState>,
      action: PayloadAction<
        PickAndNonNullableFields<
          OsrdStdcmConfState,
          | 'infraID'
          | 'timetableID'
          | 'electricalProfileSetId'
          | 'workScheduleGroupId'
          | 'temporarySpeedLimitGroupId'
          | 'searchDatetimeWindow',
          'infraID' | 'timetableID'
        >
      >
    ) {
      const { searchDatetimeWindow } = action.payload;
      state.infraID = action.payload.infraID;
      state.timetableID = action.payload.timetableID;
      state.electricalProfileSetId = action.payload.electricalProfileSetId;
      state.searchDatetimeWindow = searchDatetimeWindow;
      state.workScheduleGroupId = action.payload.workScheduleGroupId;
      state.temporarySpeedLimitGroupId = action.payload.temporarySpeedLimitGroupId;

      // check that the arrival dates are in the search time window
      const origin = state.stdcmPathSteps.at(0) as Extract<StdcmPathStep, { isVia: false }>;
      const destination = state.stdcmPathSteps.at(-1) as Extract<StdcmPathStep, { isVia: false }>;
      let newOrigin = origin;
      let newDestination = destination;

      if (searchDatetimeWindow) {
        if (
          !origin.arrival ||
          !isArrivalDateInSearchTimeWindow(origin.arrival, searchDatetimeWindow)
        ) {
          newOrigin = { ...origin, arrival: searchDatetimeWindow.begin };
        }
        if (
          !destination.arrival ||
          !isArrivalDateInSearchTimeWindow(destination.arrival, searchDatetimeWindow)
        ) {
          newDestination = { ...destination, arrival: searchDatetimeWindow.begin };
        }
      }

      state.stdcmPathSteps = [newOrigin, ...state.stdcmPathSteps.slice(1, -1), newDestination];
    },
    updateStdcmPathSteps(
      state: Draft<OsrdStdcmConfState>,
      action: PayloadAction<OsrdStdcmConfState['stdcmPathSteps']>
    ) {
      state.stdcmPathSteps = action.payload;
    },
    updateStdcmPathStep(
      state: Draft<OsrdStdcmConfState>,
      action: PayloadAction<{
        id: string;
        updates: Partial<ArrayElement<OsrdStdcmConfState['stdcmPathSteps']>>;
      }>
    ) {
      const newPathSteps = state.stdcmPathSteps.map((pathStep) =>
        pathStep.id === action.payload.id
          ? ({ ...pathStep, ...action.payload.updates } as StdcmPathStep)
          : pathStep
      );
      state.stdcmPathSteps = newPathSteps;
    },
    addStdcmVia(state: Draft<OsrdStdcmConfState>, action: PayloadAction<number>) {
      // Index takes count of the origin in the array
      state.stdcmPathSteps = addElementAtIndex(state.stdcmPathSteps, action.payload, {
        id: uuidV4(),
        stopType: StdcmStopTypes.PASSAGE_TIME,
        isVia: true,
      });
    },
    deleteStdcmVia(state: Draft<OsrdStdcmConfState>, action: PayloadAction<string>) {
      state.stdcmPathSteps = state.stdcmPathSteps.filter(
        (pathStep) => pathStep.id !== action.payload
      );
    },
    updateLinkedTrainExtremity(
      state: Draft<OsrdStdcmConfState>,
      action: PayloadAction<{
        linkedTrainExtremity: ExtremityPathStepType;
        trainName: string;
        pathStep: StdcmLinkedTrainExtremity;
        pathStepId: string;
      }>
    ) {
      const { linkedTrainExtremity, trainName, pathStep, pathStepId } = action.payload;
      const { name, ch, uic, geographic, arrivalDate, date, time, trigram } = pathStep;

      const newPathStep = {
        location: { name, coordinates: geographic.coordinates, uic, secondary_code: ch, trigram },
        id: pathStepId,
        arrival: arrivalDate,
        ...(linkedTrainExtremity === 'origin' && { arrivalType: ArrivalTimeTypes.PRECISE_TIME }),
      };

      const newLinkedTrain = { date, time, trainName };

      if (linkedTrainExtremity === 'destination') {
        state.linkedTrains.anteriorTrain = newLinkedTrain;
      } else {
        state.linkedTrains.posteriorTrain = newLinkedTrain;
      }
      const newPathSteps = state.stdcmPathSteps.map((step) =>
        step.id === action.payload.pathStepId
          ? ({ ...step, ...newPathStep } as StdcmPathStep)
          : step
      );
      state.stdcmPathSteps = newPathSteps;
    },
  },
});

export const stdcmConfSliceActions = stdcmConfSlice.actions;

export const {
  resetMargins,
  updateGridMarginAfter,
  updateGridMarginBefore,
  updateStandardAllowance,
} = stdcmConfSliceActions;

export type StdcmConfSlice = typeof stdcmConfSlice;

export type StdcmConfSliceActions = typeof stdcmConfSliceActions;

export default stdcmConfSlice.reducer;
