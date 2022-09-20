// Styles
import 'config/variables.css';
import 'main/App/App.scss';
import 'mapbox-gl/dist/mapbox-gl.css';

import * as Sentry from '@sentry/react';

// Components
import { BrowserTracing } from '@sentry/tracing';
import { PersistGate } from 'redux-persist/integration/react';
import { Provider } from 'react-redux';
import React from 'react';
import ReactDOM from 'react-dom';
// Services
import { SENTRY_CONFIG } from 'config/config';
import App from './main/App';
import { persistor, store } from './Store';
import * as serviceWorker from './serviceWorker';
import Loader from './common/Loader';
import { version } from '../package.json';

// Must be required and not imported to be included in production build (strange bug ?)
require('@sncf/bootstrap-sncf.metier.reseau');

if (SENTRY_CONFIG.react_sentry_dsn) {
  Sentry.init({
    dsn: SENTRY_CONFIG.react_sentry_dsn,
    integrations: [new BrowserTracing()],
    environment: SENTRY_CONFIG.environment,
    // We recommend adjusting this value in production, or using tracesSampler
    // for finer control
    tracesSampleRate: 1.0,
  });
}

export default function Container() {
  // eslint-disable-next-line no-console
  console.log('OSRD VERSION', version);
  return (
    <Provider store={store}>
      <PersistGate loading={<Loader />} persistor={persistor}>
        <App />
      </PersistGate>
    </Provider>
  );
}

ReactDOM.render(<Container />, document.getElementById('root'));

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
serviceWorker.unregister();
