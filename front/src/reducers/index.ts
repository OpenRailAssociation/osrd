import type { Action, Reducer, ReducersMapObject, AnyAction } from 'redux';
import type { PersistConfig } from 'redux-persist';
import { persistCombineReducers, persistReducer } from 'redux-persist';
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
} from 'reducers/osrdconf/operationalStudiesConf';
import stdcmConfReducer, {
  stdcmConfInitialState,
  stdcmConfSlice,
} from 'reducers/osrdconf/stdcmConf';
import type { OsrdConfState, OsrdStdcmConfState } from 'reducers/osrdconf/types';
import osrdsimulationReducer, {
  initialState as osrdSimulationInitialState,
} from 'reducers/osrdsimulation';
import type { OsrdSimulationState } from 'reducers/osrdsimulation/types';
import userReducer, { userInitialState, userSlice } from 'reducers/user';
import type { UserState } from 'reducers/user';

import { type ConfSlice, defaultCommonConf } from './osrdconf/osrdConfCommon';

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

const userWhiteList = [
  'account',
  'userPreferences',
  'trainScheduleV2Activated',
  'stdcmV2Activated',
];

const mainWhiteList = ['lastInterfaceVersion'];

const simulationWhiteList = ['marginsSettings'];

const saveMapFilter = createFilter('map', mapWhiteList);

const saveUserFilter = createFilter('user', userWhiteList);

const saveMainFilter = createFilter('main', mainWhiteList);

const saveSimulationFilter = createFilter('osrdsimulation', simulationWhiteList);

// Useful to only blacklist a sub-propertie of osrdconf
const buildOsrdConfPersistConfig = <T extends OsrdConfState>(
  slice: ConfSlice
): PersistConfig<T> => ({
  key: slice.name,
  storage,
  blacklist: ['featureInfoClick'],
});

export const persistConfig = {
  key: 'root',
  storage,
  transforms: [compressor, saveMapFilter, saveUserFilter, saveMainFilter, saveSimulationFilter],
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
  [operationalStudiesConfSlice.name]: OsrdConfState;
  [osrdEditoastApi.reducerPath]: ReturnType<typeof osrdEditoastApi.reducer>;
  [osrdGatewayApi.reducerPath]: ReturnType<typeof osrdGatewayApi.reducer>;
  osrdsimulation: OsrdSimulationState;
}

export const rootInitialState: RootState = {
  [userSlice.name]: userInitialState,
  [mapSlice.name]: mapInitialState,
  [mapViewerSlice.name]: mapViewerInitialState,
  [editorSlice.name]: editorInitialState,
  [mainSlice.name]: mainInitialState,
  [stdcmConfSlice.name]: stdcmConfInitialState,
  [operationalStudiesConfSlice.name]: defaultCommonConf,
  [osrdEditoastApi.reducerPath]: {} as ReturnType<typeof osrdEditoastApi.reducer>,
  [osrdGatewayApi.reducerPath]: {} as ReturnType<typeof osrdGatewayApi.reducer>,
  osrdsimulation: osrdSimulationInitialState,
};

export type AnyReducerState =
  | UserState
  | MapState
  | MapViewerState
  | EditorState
  | MainState
  | OsrdStdcmConfState
  | OsrdConfState
  | OsrdSimulationState;

export const rootReducer: ReducersMapObject<RootState> = {
  [userSlice.name]: userReducer,
  [mapSlice.name]: mapReducer,
  [mapViewerSlice.name]: mapViewerReducer,
  [editorSlice.name]: editorReducer as Reducer<EditorState, AnyAction>,
  [mainSlice.name]: mainReducer,
  [stdcmConfSlice.name]: persistReducer(
    buildOsrdConfPersistConfig<OsrdStdcmConfState>(stdcmConfSlice),
    stdcmConfReducer
  ) as unknown as Reducer<OsrdStdcmConfState, AnyAction>,
  [operationalStudiesConfSlice.name]: persistReducer(
    buildOsrdConfPersistConfig<OsrdConfState>(operationalStudiesConfSlice),
    operationalStudiesConfReducer
  ) as unknown as Reducer<OsrdConfState, AnyAction>,
  osrdsimulation: osrdsimulationReducer,
  [osrdEditoastApi.reducerPath]: osrdEditoastApi.reducer,
  [osrdGatewayApi.reducerPath]: osrdGatewayApi.reducer,
};

export default persistCombineReducers<RootState, AllActions>(persistConfig, rootReducer);
