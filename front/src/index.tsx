import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import * as Sentry from '@sentry/react';
import { BrowserTracing } from '@sentry/tracing';

// Styles
import 'maplibre-gl/dist/maplibre-gl.css';
import 'styles/styles.scss';

import { SENTRY_CONFIG } from 'config/config';
import { persistor, store } from 'store';

// Components
import App from 'main/app';
import Loader from 'common/Loader/Loader';
import { version } from '../package.json';

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
  console.info('OSRD VERSION', version);

  return (
    <Provider store={store}>
      <PersistGate loading={<Loader />} persistor={persistor}>
        <App />
      </PersistGate>
    </Provider>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(<Container />);
