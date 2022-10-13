import { applyMiddleware, compose, createStore } from 'redux';

import { persistStore } from 'redux-persist';
import persistedReducer from 'reducers';
import thunk from 'redux-thunk';

const composeEnhancers = window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose;

const store = createStore(persistedReducer, composeEnhancers(applyMiddleware(thunk)));

const persistor = persistStore(store);

export { store, persistor };
