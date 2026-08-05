import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Draft } from 'immer';
import { v4 as uuidV4 } from 'uuid';

import {
  ArrivalTimeTypes,
  MarginType,
  StdcmStopTypes,
  type ConsistData,
  type ExtremityPathStepType,
  type StdcmLinkedTrainExtremity,
  type StdcmSimulation,
} from 'applications/stdcm/types';
import { buildMapStateReducer } from 'reducers/commonMap';
import { defaultCommonConf, buildCommonConfReducers } from 'reducers/osrdconf/osrdConfCommon';
import type { OsrdStdcmConfState, StdcmPathStep } from 'reducers/osrdconf/types';
import { addElementAtIndex } from 'utils/array';
import { isArrivalDateInSearchTimeWindow } from 'utils/date';
import { Duration } from 'utils/duration';
import type { ArrayElement, PickAndNonNullableFields } from 'utils/types';

const DEFAULT_TOLERANCE = new Duration({ minutes: 30 });

export const stdcmConfInitialState: OsrdStdcmConfState = {
  ...defaultCommonConf,
  speedLimitsByTag: {},
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
    standardAllowance: { type: MarginType.TIME_PER_DISTANCE, value: 4.5 },
    gridMarginBefore: new Duration({ seconds: 0 }),
    gridMarginAfter: new Duration({ seconds: 0 }),
  },
  totalMass: undefined,
  totalLength: undefined,
  maxSpeed: undefined,
  loadingGauge: 'GA',
  towedRollingStockID: undefined,
  linkedTrains: {
    anteriorTrain: undefined,
    posteriorTrain: undefined,
  },
  simulations: [],
};

const updateSimulationState = (state: Draft<OsrdStdcmConfState>, simulation: StdcmSimulation) => {
  const {
    inputs: { consist, pathSteps },
  } = simulation;
  state.rollingStockID = consist?.tractionEngine?.id;
  state.towedRollingStockID = consist?.towedRollingStock?.id;
  state.totalLength = consist?.totalLength;
  state.totalMass = consist?.totalMass;
  state.maxSpeed = consist?.maxSpeed;
  state.loadingGauge = consist?.loadingGauge ?? 'GA';
  state.speedLimitByTag = consist?.speedLimitByTag;
  state.stdcmPathSteps = pathSteps;
};

export const stdcmConfSlice = createSlice({
  name: 'stdcmConf',
  initialState: stdcmConfInitialState,
  reducers: {
    ...buildCommonConfReducers<OsrdStdcmConfState>(),
    ...buildMapStateReducer<OsrdStdcmConfState>(),

    resetStdcmConfig(state: Draft<OsrdStdcmConfState>) {
      state.rollingStockID = stdcmConfInitialState.rollingStockID;
      state.stdcmPathSteps = stdcmConfInitialState.stdcmPathSteps;
      state.towedRollingStockID = stdcmConfInitialState.towedRollingStockID;
      state.totalLength = stdcmConfInitialState.totalLength;
      state.totalMass = stdcmConfInitialState.totalMass;
      state.maxSpeed = stdcmConfInitialState.maxSpeed;
      state.speedLimitByTag = stdcmConfInitialState.speedLimitByTag;
      state.linkedTrains = stdcmConfInitialState.linkedTrains;
      state.retainedSimulationIndex = stdcmConfInitialState.retainedSimulationIndex;
      state.selectedSimulationIndex = stdcmConfInitialState.selectedSimulationIndex;
      state.simulations = stdcmConfInitialState.simulations;
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
    updateLoadingGauge(
      state: Draft<OsrdStdcmConfState>,
      action: PayloadAction<OsrdStdcmConfState['loadingGauge']>
    ) {
      state.loadingGauge = action.payload;
    },
    updateTowedRollingStockID(
      state: Draft<OsrdStdcmConfState>,
      action: PayloadAction<OsrdStdcmConfState['towedRollingStockID']>
    ) {
      state.towedRollingStockID = action.payload;
    },
    updateInitialConsist(state: Draft<OsrdStdcmConfState>, action: PayloadAction<ConsistData>) {
      state.rollingStockID = action.payload.rollingStockID;
      state.towedRollingStockID = action.payload.towedRollingStockID;
      state.totalMass = action.payload.totalMass;
      state.totalLength = action.payload.totalLength;
      state.maxSpeed = action.payload.maxSpeed;
      state.loadingGauge = action.payload.loadingGauge;
      state.speedLimitByTag = action.payload.speedLimitByTag;
    },
    resetMargins(state: Draft<OsrdStdcmConfState>) {
      state.margins = {
        standardAllowance: { type: MarginType.TIME_PER_DISTANCE, value: 4.5 },
        gridMarginBefore: new Duration({ seconds: 0 }),
        gridMarginAfter: new Duration({ seconds: 0 }),
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
          | 'searchDatetimeWindow'
          | 'operationalPointsIdFiltered'
          | 'projectID'
          | 'studyID'
          | 'scenarioID'
          | 'operationalPoints'
          | 'trackSectionIdsByLoadingGauge'
          | 'speedLimitsByTag',
          'infraID' | 'timetableID'
        > & { defaultSpeedLimitTag?: string }
      >
    ) {
      const { searchDatetimeWindow, speedLimitsByTag, defaultSpeedLimitTag } = action.payload;
      state.infraID = action.payload.infraID;
      state.timetableID = action.payload.timetableID;
      state.electricalProfileSetId = action.payload.electricalProfileSetId;
      state.searchDatetimeWindow = searchDatetimeWindow;
      state.workScheduleGroupId = action.payload.workScheduleGroupId;
      state.temporarySpeedLimitGroupId = action.payload.temporarySpeedLimitGroupId;

      state.projectID = action.payload.projectID;
      state.studyID = action.payload.studyID;
      state.scenarioID = action.payload.scenarioID;
      state.operationalPoints = action.payload.operationalPoints;
      state.trackSectionIdsByLoadingGauge = action.payload.trackSectionIdsByLoadingGauge;
      state.speedLimitsByTag = speedLimitsByTag;
      state.operationalPointsIdFiltered = action.payload.operationalPointsIdFiltered;

      // check if a speedLimitTag is already defined, and if not, use the defaultSpeedLimitTag
      const speedLimitTags = Object.keys(speedLimitsByTag);
      if (!state.speedLimitByTag || !speedLimitTags.includes(state.speedLimitByTag)) {
        state.speedLimitByTag =
          defaultSpeedLimitTag && speedLimitTags.includes(defaultSpeedLimitTag)
            ? defaultSpeedLimitTag
            : speedLimitTags.at(0);
      }

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
        consistChange: undefined,
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
        pathStepKey: string;
      }>
    ) {
      const { linkedTrainExtremity, trainName, pathStep, pathStepKey } = action.payload;
      const {
        name,
        secondary_code,
        country_code,
        geographic,
        arrivalDate,
        date,
        time,
        main_code,
        uic,
        obj_id,
      } = pathStep;

      if (!geographic) {
        throw new Error('Path step does not have geographic position');
      }

      const coordinates: [number, number] = [geographic.coordinates[0], geographic.coordinates[1]];

      const newPathStep = {
        operationalPoint: {
          id: obj_id,
          name,
          coordinates,
          mainCode: main_code,
          secondaryCode: secondary_code,
          countryCode: country_code,
          uic,
        },
        id: pathStepKey,
        arrival: arrivalDate,
        ...(linkedTrainExtremity === 'origin' && {
          arrivalType: ArrivalTimeTypes.PRECISE_TIME,
        }),
      };

      const newLinkedTrain = { date, time, trainName };

      if (linkedTrainExtremity === 'destination') {
        state.linkedTrains.anteriorTrain = newLinkedTrain;
      } else {
        state.linkedTrains.posteriorTrain = newLinkedTrain;
      }
      const newPathSteps = state.stdcmPathSteps.map((step) => {
        if (step.id === action.payload.pathStepKey) {
          return { ...step, ...newPathStep };
        }
        return step;
      });
      state.stdcmPathSteps = newPathSteps;
    },
    addStdcmSimulations(
      state: Draft<OsrdStdcmConfState>,
      action: PayloadAction<Omit<StdcmSimulation, 'index' | 'creationDate'>[]>
    ) {
      action.payload.forEach((simulation) => {
        state.simulations.push({
          ...simulation,
          index: state.simulations.length,
          creationDate: new Date(),
        });
      });

      // select the first simulation added
      state.selectedSimulationIndex = state.simulations.length - action.payload.length;
    },
    selectSimulation(state: Draft<OsrdStdcmConfState>, action: PayloadAction<number>) {
      state.selectedSimulationIndex = action.payload;
      updateSimulationState(state, state.simulations[action.payload]);
    },
    retainSimulation(state: Draft<OsrdStdcmConfState>, action: PayloadAction<number>) {
      state.retainedSimulationIndex = action.payload;
    },
    resetStdcmSimulations(state: Draft<OsrdStdcmConfState>) {
      state.retainedSimulationIndex = stdcmConfInitialState.retainedSimulationIndex;
      state.selectedSimulationIndex = stdcmConfInitialState.selectedSimulationIndex;
      state.simulations = stdcmConfInitialState.simulations;
    },
  },
});

export const {
  resetStdcmConfig,
  restoreStdcmConfig,
  updateTotalMass,
  updateTotalLength,
  updateMaxSpeed,
  updateLoadingGauge,
  updateTowedRollingStockID,
  updateInitialConsist,
  resetMargins,
  updateGridMarginAfter,
  updateGridMarginBefore,
  updateStandardAllowance,
  updateStdcmEnvironment,
  updateStdcmPathSteps,
  updateStdcmPathStep,
  addStdcmVia,
  deleteStdcmVia,
  updateLinkedTrainExtremity,
  selectSimulation,
  retainSimulation,
  addStdcmSimulations,
  resetStdcmSimulations,
  updateMapSettings,
} = stdcmConfSlice.actions;

export type StdcmConfSlice = typeof stdcmConfSlice;

export type StdcmConfSliceActions = typeof stdcmConfSlice.actions;

export default stdcmConfSlice.reducer;
