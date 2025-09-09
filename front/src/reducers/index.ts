import type { Action, ReducersMapObject } from 'redux';
import { createTransform, persistCombineReducers } from 'redux-persist';
import storage from 'redux-persist/lib/storage'; // defaults to localStorage
import createCompressor from 'redux-persist-transform-compress';
import { createFilter, createBlacklistFilter } from 'redux-persist-transform-filter';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { osrdGatewayApi } from 'common/api/osrdGatewayApi';
import type { EditorSlice, EditorState } from 'reducers/editor';
import editorReducer, { editorInitialState, editorSlice } from 'reducers/editor';
import mainReducer, { mainInitialState, mainSlice } from 'reducers/main';
import type { MainState } from 'reducers/main';
import operationalStudiesConfReducer, {
  operationalStudiesConfSlice,
  operationalStudiesInitialConf,
} from 'reducers/osrdconf/operationalStudiesConf';
import stdcmConfReducer, {
  stdcmConfInitialState,
  stdcmConfSlice,
} from 'reducers/osrdconf/stdcmConf';
import type { OperationalStudiesConfState, OsrdStdcmConfState } from 'reducers/osrdconf/types';
import referenceMapReducer, {
  referenceMapInitialState,
  referenceMapSlice,
} from 'reducers/referenceMap';
import type { ReferenceMapSlice, ReferenceMapState } from 'reducers/referenceMap';
import simulationReducer, {
  simulationResultsInitialState,
  simulationResultsSlice,
} from 'reducers/simulationResults';
import type { SimulationResultsState } from 'reducers/simulationResults/types';
import userReducer, { userInitialState, userSlice } from 'reducers/user';
import type { UserState } from 'reducers/user';
import { Duration } from 'utils/duration';

import type { ConfSlice } from './osrdconf/osrdConfCommon';

const compressor = createCompressor({
  whitelist: ['rollingstock'],
});

const userWhiteList = ['account', 'userPreferences', 'impersonatedUser'];

const mainWhiteList = ['lastInterfaceVersion'];

const operationalStudiesConfBlackList = ['usingSpeedLimits'];

const saveUserFilter = createFilter(userSlice.name, userWhiteList);

const saveMainFilter = createFilter(mainSlice.name, mainWhiteList);

const operationalStudiesFilter = createBlacklistFilter(
  operationalStudiesConfSlice.name,
  operationalStudiesConfBlackList
);

// Deserialize date strings coming from local storage
const operationalStudiesDateTransform = createTransform(
  null,
  ({
    startTime,
    interval,
    timeWindow,
    pathSteps,
    ...outboundState
  }: {
    startTime: string;
    interval: string;
    timeWindow: string;
    pathSteps: ({ arrival: string; stopFor: string } | null)[];
  }) => ({
    ...outboundState,
    startTime: new Date(startTime),
    interval: Duration.parse(interval),
    timeWindow: Duration.parse(timeWindow),
    pathSteps: pathSteps.map((pathStep) => {
      if (!pathStep) return null;

      return {
        ...pathStep,
        arrival: pathStep.arrival ? Duration.parse(pathStep.arrival) : null,
        stopFor: pathStep.stopFor ? Duration.parse(pathStep.stopFor) : null,
      };
    }),
  }),
  {
    whitelist: [operationalStudiesConfSlice.name],
  }
);

export const persistConfig = {
  key: 'root',
  storage,
  transforms: [
    compressor,
    saveUserFilter,
    saveMainFilter,
    operationalStudiesFilter,
    operationalStudiesDateTransform,
  ],
  whitelist: [userSlice.name, mainSlice.name, simulationResultsSlice.name, referenceMapSlice.name],
};

type AllActions = Action;

export type OsrdSlice = ConfSlice | EditorSlice | ReferenceMapSlice;

export type RootState = {
  [userSlice.name]: UserState;
  [referenceMapSlice.name]: ReferenceMapState;
  [editorSlice.name]: EditorState;
  [mainSlice.name]: MainState;
  [stdcmConfSlice.name]: OsrdStdcmConfState;
  [operationalStudiesConfSlice.name]: OperationalStudiesConfState;
  [simulationResultsSlice.name]: SimulationResultsState;
  [osrdEditoastApi.reducerPath]: ReturnType<typeof osrdEditoastApi.reducer>;
  [osrdGatewayApi.reducerPath]: ReturnType<typeof osrdGatewayApi.reducer>;
};

export const rootInitialState: RootState = {
  [userSlice.name]: userInitialState,
  [referenceMapSlice.name]: referenceMapInitialState,
  [editorSlice.name]: editorInitialState,
  [mainSlice.name]: mainInitialState,
  [stdcmConfSlice.name]: stdcmConfInitialState,
  [operationalStudiesConfSlice.name]: operationalStudiesInitialConf,
  [simulationResultsSlice.name]: simulationResultsInitialState,
  [osrdEditoastApi.reducerPath]: {} as ReturnType<typeof osrdEditoastApi.reducer>,
  [osrdGatewayApi.reducerPath]: {} as ReturnType<typeof osrdGatewayApi.reducer>,
};

export type AnyReducerState =
  | UserState
  | ReferenceMapState
  | EditorState
  | MainState
  | OsrdStdcmConfState
  | OperationalStudiesConfState
  | SimulationResultsState;

export const rootReducer: ReducersMapObject<RootState> = {
  [userSlice.name]: userReducer,
  [referenceMapSlice.name]: referenceMapReducer,
  [editorSlice.name]: editorReducer,
  [mainSlice.name]: mainReducer,
  [stdcmConfSlice.name]: stdcmConfReducer,
  [operationalStudiesConfSlice.name]: operationalStudiesConfReducer,
  [simulationResultsSlice.name]: simulationReducer,
  [osrdEditoastApi.reducerPath]: osrdEditoastApi.reducer,
  [osrdGatewayApi.reducerPath]: osrdGatewayApi.reducer,
};

export default persistCombineReducers<RootState, AllActions>(persistConfig, rootReducer);
