import {
  applyMiddleware,
  compose,
  legacy_createStore as createStore,
  combineReducers,
} from 'redux';
import thunk from 'redux-thunk';
import { persistStore } from 'redux-persist';
import { composeWithDevTools, Config } from '@redux-devtools/extension';

import { osrdMiddlewareApi } from 'common/api/osrdMiddlewareApi';
import persistedReducer, { rootReducer, rootInitialState, RootState } from 'reducers';

const reduxDevToolsOptions: Config = {
  serialize: {
    options: {
      symbol: true,
    },
  },
};

// const composeEnhancers = composeWithDevToolsLogOnlyInProduction(reduxDevToolsOptions);
const composeEnhancers = composeWithDevTools(reduxDevToolsOptions) || compose;

const enhancers = composeEnhancers(applyMiddleware(thunk, osrdMiddlewareApi.middleware));
const store = createStore(persistedReducer, enhancers);

const persistor = persistStore(store);

const createStoreWithoutMiddleware = (initialStateExtra: Partial<RootState>) =>
  createStore(combineReducers<RootState>(rootReducer), {
    ...rootInitialState,
    ...initialStateExtra,
  });

export { store, persistor, createStoreWithoutMiddleware };
