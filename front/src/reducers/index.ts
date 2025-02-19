import type { Action, Reducer, ReducersMapObject, AnyAction } from 'redux';
import type { PersistConfig } from 'redux-persist';
import { createTransform, persistCombineReducers, persistReducer } from 'redux-persist';
import storage from 'redux-persist/lib/storage'; // defaults to localStorage
import createCompressor from 'redux-persist-transform-compress';
import { createFilter } from 'redux-persist-transform-filter';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { osrdGatewayApi } from 'common/api/osrdGatewayApi';
import type { EditorSlice, EditorState } from 'reducers/editor';
import editorReducer, { editorInitialState, editorSlice } from 'reducers/editor';
import mainReducer, { mainInitialState, mainSlice } from 'reducers/main';
import type { MainState } from 'reducers/main';
import mapReducer, { mapInitialState, mapSlice } from 'reducers/map';
import type { MapState } from 'reducers/map';
import type { MapViewerState, MapViewerSlice } from 'reducers/mapViewer';
import mapViewerReducer, { mapViewerInitialState, mapViewerSlice } from 'reducers/mapViewer';
import operationalStudiesConfReducer, {
  operationalStudiesConfSlice,
  operationalStudiesInitialConf,
  type OperationalStudiesConfState,
} from 'reducers/osrdconf/operationalStudiesConf';
import stdcmConfReducer, {
  stdcmConfInitialState,
  stdcmConfSlice,
} from 'reducers/osrdconf/stdcmConf';
import type { OsrdStdcmConfState } from 'reducers/osrdconf/types';
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

const mapWhiteList = [
  'mapStyle',
  'showOrthoPhoto',
  'showOSM',
  'layers',
  'layersSettings',
  'userPreference',
  'terrain3DExaggeration',
];

const userWhiteList = ['account', 'userPreferences'];

const mainWhiteList = ['lastInterfaceVersion'];

const saveMapFilter = createFilter('map', mapWhiteList);

const saveUserFilter = createFilter('user', userWhiteList);

const saveMainFilter = createFilter('main', mainWhiteList);

// Deserialize date strings coming from local storage
const operationalStudiesDateTransform = createTransform(
  null,
  ({ startTime, ...outboundState }: { startTime: string }) => ({
    ...outboundState,
    startTime: new Date(startTime),
  }),
  { whitelist: ['operationalStudiesConf'] }
);
const pathStepsTransform = createTransform(
  null,
  (pathSteps: ({ arrival: string; stopFor: string } | null)[]) =>
    pathSteps.map((pathStep) => {
      if (!pathStep) return null;

      return {
        ...pathStep,
        arrival: pathStep.arrival ? Duration.parse(pathStep.arrival) : null,
        stopFor: pathStep.stopFor ? Duration.parse(pathStep.stopFor) : null,
      };
    }),
  { whitelist: ['pathSteps'] }
);

// Useful to only blacklist a sub-propertie of osrdconf
const buildOsrdConfPersistConfig = <T extends OperationalStudiesConfState | OsrdStdcmConfState>(
  slice: ConfSlice
): PersistConfig<T> => ({
  key: slice.name,
  storage,
  transforms: [operationalStudiesDateTransform, pathStepsTransform],
  blacklist: ['usingSpeedLimits'],
});

export const persistConfig = {
  key: 'root',
  storage,
  transforms: [compressor, saveMapFilter, saveUserFilter, saveMainFilter],
  blacklist: [stdcmConfSlice.name, operationalStudiesConfSlice.name],
  whitelist: ['user', 'map', 'main', 'simulation', 'mapViewer'],
};

type AllActions = Action;

export type OsrdSlice = ConfSlice | EditorSlice | MapViewerSlice;

export interface RootState {
  [userSlice.name]: UserState;
  [mapSlice.name]: MapState;
  [mapViewerSlice.name]: MapViewerState;
  [editorSlice.name]: EditorState;
  [mainSlice.name]: MainState;
  [stdcmConfSlice.name]: OsrdStdcmConfState;
  [operationalStudiesConfSlice.name]: OperationalStudiesConfState;
  [simulationResultsSlice.name]: SimulationResultsState;
  [osrdEditoastApi.reducerPath]: ReturnType<typeof osrdEditoastApi.reducer>;
  [osrdGatewayApi.reducerPath]: ReturnType<typeof osrdGatewayApi.reducer>;
}

export const rootInitialState: RootState = {
  [userSlice.name]: userInitialState,
  [mapSlice.name]: mapInitialState,
  [mapViewerSlice.name]: mapViewerInitialState,
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
  | MapState
  | MapViewerState
  | EditorState
  | MainState
  | OsrdStdcmConfState
  | OperationalStudiesConfState
  | SimulationResultsState;

export const rootReducer: ReducersMapObject<RootState> = {
  [userSlice.name]: userReducer,
  [mapSlice.name]: mapReducer,
  [mapViewerSlice.name]: mapViewerReducer,
  [editorSlice.name]: editorReducer as Reducer<EditorState, AnyAction>,
  [mainSlice.name]: mainReducer,
  [stdcmConfSlice.name]: stdcmConfReducer,
  [operationalStudiesConfSlice.name]: persistReducer(
    buildOsrdConfPersistConfig<OperationalStudiesConfState>(operationalStudiesConfSlice),
    operationalStudiesConfReducer
  ) as unknown as Reducer<OperationalStudiesConfState, AnyAction>,
  [simulationResultsSlice.name]: simulationReducer,
  [osrdEditoastApi.reducerPath]: osrdEditoastApi.reducer,
  [osrdGatewayApi.reducerPath]: osrdGatewayApi.reducer,
};

export default persistCombineReducers<RootState, AllActions>(persistConfig, rootReducer);
