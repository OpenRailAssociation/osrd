import { Action, ReducersMapObject } from 'redux';
import { persistCombineReducers, persistReducer, PersistConfig } from 'redux-persist';
import createCompressor from 'redux-persist-transform-compress';
import { createFilter } from 'redux-persist-transform-filter';
import storage from 'redux-persist/lib/storage'; // defaults to localStorage

import { OsrdConfState } from 'applications/operationalStudies/consts';

import { osrdMiddlewareApi } from 'common/api/osrdMiddlewareApi';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import mainReducer, { MainState, MainActions, initialState as mainInitialState } from './main';
import userReducer, { UserState, initialState as userInitialState } from './user';
import mapReducer, { MapState, initialState as mapInitialState } from './map';
import editorReducer, { EditorActions, initialState as editorInitialState } from './editor';
import osrdconfReducer, { initialState as osrdconfInitialState } from './osrdconf';
import osrdStdcmConfReducer, { initialState as osrdStdcmConfInitialState } from './osrdStdcmConf';
import osrdsimulationReducer, {
  initialState as osrdSimulationInitialState,
} from './osrdsimulation';
import { OsrdSimulationState } from './osrdsimulation/types';

import { EditorState } from '../applications/editor/tools/types';

const compressor = createCompressor({
  whitelist: ['rollingstock'],
});

const mapWhiteList = [
  'mapStyle',
  'showOrthoPhoto',
  'showOSM',
  'mapTrackSources',
  'trackSource',
  'layers',
  'layersSettings',
  'userPreference',
  'signalsSettings',
];

const userWhiteList = ['account'];

const mainWhiteList = ['fullscreen', 'darkmode'];

const simulationWhiteList = ['marginsSettings'];

const saveMapFilter = createFilter('map', mapWhiteList);

const saveUserFilter = createFilter('user', userWhiteList);

const saveMainFilter = createFilter('main', mainWhiteList);

const saveSimulationFilter = createFilter('osrdsimulation', simulationWhiteList);

// Useful to only blacklist a sub-propertie of osrdconf
const osrdconfPersistConfig: PersistConfig<OsrdConfState> = {
  key: 'osrdconf',
  storage,
  blacklist: ['featureInfoClick', 'switchTypes'],
};

// Useful to only blacklist a sub-propertie of osrdStdcmConf
const osrdStdcmConfPersistConfig: PersistConfig<OsrdConfState> = {
  key: 'osrdStdcmConf',
  storage,
  blacklist: ['featureInfoClick', 'switchTypes'],
};

const persistConfig = {
  key: 'root',
  storage,
  transforms: [compressor, saveMapFilter, saveUserFilter, saveMainFilter, saveSimulationFilter],
  blacklist: ['osrdconf'],
  whitelist: ['user', 'map', 'main', 'simulation'],
};

type AllActions = EditorActions | MainActions | Action;

export interface RootState {
  user: UserState;
  map: MapState;
  editor: EditorState;
  main: MainState;
  osrdconf: OsrdConfState;
  osrdStdcmConf: OsrdConfState;
  osrdsimulation: OsrdSimulationState;
  [osrdMiddlewareApi.reducerPath]: any;
  [osrdEditoastApi.reducerPath]: any;
}

export const rootInitialState: RootState = {
  user: userInitialState,
  map: mapInitialState,
  editor: editorInitialState,
  main: mainInitialState,
  osrdconf: osrdconfInitialState,
  osrdStdcmConf: osrdStdcmConfInitialState,
  osrdsimulation: osrdSimulationInitialState,
  [osrdMiddlewareApi.reducerPath]: {},
  [osrdEditoastApi.reducerPath]: {},
};

export type AnyReducerState =
  | UserState
  | MapState
  | EditorState
  | MainState
  | OsrdConfState
  | OsrdSimulationState;

export const rootReducer: ReducersMapObject<RootState> = {
  user: userReducer,
  map: mapReducer,
  editor: editorReducer,
  main: mainReducer,
  // @ts-ignore
  osrdconf: persistReducer(osrdconfPersistConfig, osrdconfReducer),
  // @ts-ignore
  osrdStdcmConf: persistReducer(osrdStdcmConfPersistConfig, osrdStdcmConfReducer),
  osrdsimulation: osrdsimulationReducer,
  [osrdMiddlewareApi.reducerPath]: osrdMiddlewareApi.reducer,
  [osrdEditoastApi.reducerPath]: osrdEditoastApi.reducer,
};

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore: temporary
export default persistCombineReducers<RootState, AllActions>(persistConfig, rootReducer);
