import type { Config } from '@redux-devtools/extension';
import { configureStore, type Middleware } from '@reduxjs/toolkit';
import { type TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import { persistStore, getStoredState } from 'redux-persist';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { osrdGatewayApi } from 'common/api/osrdGatewayApi';
import { ChartSynchronizer } from 'modules/simulationResult/components/ChartSynchronizer';
import persistedReducer, {
  rootReducer,
  rootInitialState,
  type RootState,
  persistConfig,
} from 'reducers';

import { listenerMiddleware } from './listenerMiddleware';

const reduxDevToolsOptions: Config = {
  serialize: {
    options: {
      symbol: true,
    },
  },
};

const middlewares: Middleware[] = [osrdEditoastApi.middleware, osrdGatewayApi.middleware];

const store = configureStore({
  reducer: persistedReducer,
  devTools: reduxDevToolsOptions,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
      // The following line disables the detection of immutability across the entire Redux state.
      // Immutability detection can be time-consuming, especially for large stores
      // and can show warning message : "ImmutableStateInvariantMiddleware took xms, which is more than the warning threshold of 32ms."
      // Since we use RTK, which incorporates Immer for managing our store slices,
      // this check is not really necessary since Immer has already ensured the store immutability.
      // Disabling this feature improve performance. https://github.com/reduxjs/redux-toolkit/issues/415
      immutableCheck: false,
      thunk: {
        extraArgument: ChartSynchronizer.getInstance(),
      },
    })
      .prepend(listenerMiddleware.middleware)
      .concat(...middlewares),
});

// workaround for the dependency cycle
// thunk needs chart sychronizer for side effects
// chart synchronizer needs store
// store needs thunk
ChartSynchronizer.getInstance().setReduxStore(store);

export type AppDispatch = typeof store.dispatch;
export type GetState = typeof store.getState;
export type Store = typeof store;

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

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
  configureStore({
    reducer: rootReducer,
    preloadedState: {
      ...rootInitialState,
      ...initialStateExtra,
    },
  });

export { store, persistor, createStoreWithoutMiddleware };
