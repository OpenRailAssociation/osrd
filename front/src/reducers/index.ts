import { Action } from 'redux';
import { persistCombineReducers, persistReducer } from 'redux-persist';
import createCompressor from 'redux-persist-transform-compress';
import { createFilter } from 'redux-persist-transform-filter';
import storage from 'redux-persist/lib/storage'; // defaults to localStorage

import mainReducer, { MainActions } from './main';
import userReducer from './user';
import mapReducer, { MapState } from './map';
import editorReducer, { EditorActions } from './editor';

import osrdconfReducer from './osrdconf';
import osrdsimulationReducer, { OsrdSimulationState } from './osrdsimulation';
import rollingStockReducer from './rollingstock';
import { EditorState } from '../applications/editor/tools/types';

const compressor = createCompressor({
  whitelist: ['rollingstock'],
});

const mapWhiteList = [
  'mapStyle',
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
const osrdconfPersistConfig = {
  key: 'osrdconf',
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

type AllActions<T = unknown> = EditorActions | MainActions | Action<T>;

interface GenericState {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: unknown;
}

export interface RootState {
  user: GenericState;
  map: MapState;
  editor: EditorState;
  main: GenericState;
  osrdconf: GenericState;
  osrdsimulation: OsrdSimulationState;
  rollingstock: GenericState;
}

const rootReducer = {
  user: userReducer,
  map: mapReducer,
  editor: editorReducer,
  main: mainReducer,
  osrdconf: persistReducer(osrdconfPersistConfig, osrdconfReducer),
  osrdsimulation: osrdsimulationReducer,
  rollingstock: rollingStockReducer,
};

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore: temporary
export default persistCombineReducers<RootState, AllActions>(persistConfig, rootReducer);
