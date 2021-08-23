import { persistCombineReducers, persistReducer } from 'redux-persist';
import createCompressor from 'redux-persist-transform-compress';
import { createFilter } from 'redux-persist-transform-filter';
import storage from 'redux-persist/lib/storage'; // defaults to localStorage

import mainReducer from './main';
import userReducer from './user';
import mapReducer from './map';
import editorReducer from './editor';
import osrdconfReducer from './osrdconf';
import osrdsimulationReducer from './osrdsimulation';
import rollingStockReducer from './rollingstock';
// import phritReducer from './phrit';

const compressor = createCompressor({
  whitelist: ['rollingstock'],
});

const mapWhiteList = [
  'mapStyle',
  'showOSM',
  'mapTrackSources',
  'trackSource',
  'layers',
  'userPreference',
  'signalsSettings',
];

const userWhiteList = [
  'account',
];

const mainWhiteList = [
  'fullscreen',
  'darkmode',
];

const saveMapFilter = createFilter(
  'map',
  mapWhiteList,
);

const saveUserFilter = createFilter(
  'user',
  userWhiteList,
);

const saveMainFilter = createFilter(
  'main',
  mainWhiteList,
);

// Useful to only blacklist a sub-propertie of osrdconf
const osrdconfPersistConfig = {
  key: 'osrdconf',
  storage,
  blacklist: ['featureInfoClick'],
};

const persistConfig = {
  key: 'root',
  storage,
  transforms: [compressor, saveMapFilter, saveUserFilter, saveMainFilter],
  blacklist: ['osrdconf'],
  whitelist: ['user', 'map', 'main'],
};

const rootReducer = {
  user: userReducer,
  map: mapReducer,
  editor: editorReducer,
  main: mainReducer,
  osrdconf: persistReducer(osrdconfPersistConfig, osrdconfReducer),
  osrdsimulation: osrdsimulationReducer,
  rollingstock: rollingStockReducer,
};

export default persistCombineReducers(persistConfig, rootReducer);
