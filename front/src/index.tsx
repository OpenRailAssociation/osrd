import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import * as Sentry from '@sentry/react';
import { BrowserTracing } from '@sentry/tracing';
// Styles
import 'maplibre-gl/dist/maplibre-gl.css';
import 'styles/styles.scss';

import { SENTRY_CONFIG } from 'config/config';
import { persistor, store } from 'Store';

// Components
import App from 'main/app';
import Loader from 'common/Loader';
import { version } from '../package.json';
import reportWebVitals from './reportWebVitals';

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

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
