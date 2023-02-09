import { legacy_createStore as createStore, combineReducers } from 'redux';
import { configureStore, Middleware } from '@reduxjs/toolkit';
import thunk from 'redux-thunk';
import { persistStore } from 'redux-persist';
import { Config } from '@redux-devtools/extension';

import { osrdMiddlewareApi } from 'common/api/osrdMiddlewareApi';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import persistedReducer, { rootReducer, rootInitialState, RootState } from 'reducers';

const reduxDevToolsOptions: Config = {
  serialize: {
    options: {
      symbol: true,
    },
  },
};

const middlewares: Middleware[] = [thunk, osrdMiddlewareApi.middleware, osrdEditoastApi.middleware];

const store = configureStore({
  reducer: persistedReducer,
  devTools: reduxDevToolsOptions,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({ serializableCheck: false }).concat(...middlewares),
});

const persistor = persistStore(store);

const createStoreWithoutMiddleware = (initialStateExtra: Partial<RootState>) =>
  createStore(combineReducers<RootState>(rootReducer), {
    ...rootInitialState,
    ...initialStateExtra,
  });

export { store, persistor, createStoreWithoutMiddleware };
