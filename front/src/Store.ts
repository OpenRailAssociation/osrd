import { legacy_createStore as createStore, combineReducers } from 'redux';
import { configureStore, Middleware } from '@reduxjs/toolkit';
import thunk from 'redux-thunk';
import { persistStore, getStoredState } from 'redux-persist';
import { Config } from '@redux-devtools/extension';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { osrdGatewayApi } from 'common/api/osrdGatewayApi';

import persistedReducer, {
  rootReducer,
  rootInitialState,
  RootState,
  persistConfig,
} from 'reducers';
import { listenerMiddleware } from 'listenerMiddleware';

const reduxDevToolsOptions: Config = {
  serialize: {
    options: {
      symbol: true,
    },
  },
};

const middlewares: Middleware[] = [thunk, osrdEditoastApi.middleware, osrdGatewayApi.middleware];

const store = configureStore({
  reducer: persistedReducer,
  devTools: reduxDevToolsOptions,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({ serializableCheck: false })
      .prepend(listenerMiddleware.middleware)
      .concat(...middlewares),
});

export type AppDispatch = typeof store.dispatch;

const persistor = persistStore(store);

// Retrieve the persisted state from storage and purge if new front version
getStoredState(persistConfig)
  .then((persistedState) => {
    console.info('Front OSRD Version', import.meta.env.OSRD_GIT_DESCRIBE);

    const envInterfaceVersion = import.meta.env.OSRD_GIT_DESCRIBE;
    const persistedRootState = persistedState as RootState;

    if (
      envInterfaceVersion &&
      persistedRootState?.main?.lastInterfaceVersion !== envInterfaceVersion
    )
      persistor.purge().then(() => {
        console.warn('New Front Version since last launch, persisted Store purged');
      });
  })
  .catch((err) => {
    console.error('Error retrieving persisted state:', err);
  });

const createStoreWithoutMiddleware = (initialStateExtra: Partial<RootState>) =>
  createStore(combineReducers<RootState>(rootReducer), {
    ...rootInitialState,
    ...initialStateExtra,
  });

export { store, persistor, createStoreWithoutMiddleware };
