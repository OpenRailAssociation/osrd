import { applyMiddleware, createStore } from 'redux';
import { compose, createStateSyncMiddleware, initMessageListener } from 'redux-state-sync';

import { persistStore } from 'redux-persist';
import persistedReducer from 'reducers';
import thunk from 'redux-thunk';

const composeEnhancers = window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose;

const store = createStore(
  persistedReducer,
  composeEnhancers(
    applyMiddleware(
      thunk,
      /* createStateSyncMiddleware({
      blacklist: ['persist/PERSIST', 'persist/REHYDRATE'],
    }), */
    ),
  ),
);

// initMessageListener(store);

const persistor = persistStore(store);

export { store, persistor };
