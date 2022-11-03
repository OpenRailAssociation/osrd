import { applyMiddleware, compose, createStore } from 'redux';

import { persistStore } from 'redux-persist';
import persistedReducer from 'reducers';
import thunk from 'redux-thunk';

const reduxDevToolsOptions = {
  serialize: true,
}

const composeEnhancers = window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__(reduxDevToolsOptions) || compose;

const enhancers = composeEnhancers(applyMiddleware(thunk));
const store = createStore(persistedReducer, enhancers);

const persistor = persistStore(store);

export { store, persistor };
