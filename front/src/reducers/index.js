import { persistCombineReducers, persistReducer } from 'redux-persist';

import createCompressor from 'redux-persist-transform-compress';
import { createFilter } from 'redux-persist-transform-filter';
import editorReducer from './editor.ts';
import mainReducer from './main.ts';
import mapReducer from './map';
import osrdconfReducer from './osrdconf';
import osrdsimulationReducer from './osrdsimulation';
import rollingStockReducer from './rollingstock';
import storage from 'redux-persist/lib/storage'; // defaults to localStorage
import userReducer from './user';

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
  blacklist: ['featureInfoClick'],
};

/**
 *
 */
const persistConfig = {
  key: 'root',
  storage,
  transforms: [compressor, saveMapFilter, saveUserFilter, saveMainFilter, saveSimulationFilter],
  blacklist: ['osrdconf'],
  whitelist: ['user', 'map', 'main', 'simulation'],
};

/**
 * @property {object}  user  - user settings and meta datas
 * @property {object}  map  - ?
 * @property {object}  editor  - ?
 * @property {object}  main  - notifications, loading state
 * @property {object}  osrdconf  - persisted settings necessary for a simulaiton
 * @property {object}  osrdsimulation  - simulation results, both abstract and display-ready
 * @property {object}  rollingstock  - possible trains configuration
 */
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
