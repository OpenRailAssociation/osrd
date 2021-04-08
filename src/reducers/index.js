import { persistCombineReducers, persistReducer } from 'redux-persist';
import createCompressor from 'redux-persist-transform-compress';
import { createFilter } from 'redux-persist-transform-filter';
import storage from 'redux-persist/lib/storage'; // defaults to localStorage

import mainReducer from './main';
import userReducer from './user';
import mapReducer from './map';
import osrdconfReducer from './osrdconf';
import osrdsimulationReducer from './osrdsimulation';
import trainCompoReducer from './traincompo';
// import phritReducer from './phrit';

const compressor = createCompressor({
  whitelist: ['traincompo'],
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

const saveMapFilter = createFilter(
  'map',
  mapWhiteList,
);

const saveUserFilter = createFilter(
  'user',
  userWhiteList,
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
  transforms: [compressor, saveMapFilter, saveUserFilter],
  blacklist: ['osrdconf'],
  whitelist: ['user', 'map', 'hermes'],
};

const rootReducer = {
  user: userReducer,
  map: mapReducer,
  main: mainReducer,
  osrdconf: persistReducer(osrdconfPersistConfig, osrdconfReducer),
  osrdsimulation: osrdsimulationReducer,
  traincompo: trainCompoReducer,
};

export default persistCombineReducers(persistConfig, rootReducer);
