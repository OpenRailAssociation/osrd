import React, { Suspense, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import 'i18n';

import Home from 'main/home';
import Loader from 'common/Loader';
import useAuth from 'utils/hooks/OsrdAuth';
import ErrorBoundary from 'common/ErrorBoundary';
import { OsrdContextLayout } from 'common/osrdContext';
import { NotificationsState } from 'common/Notifications';

import HomeStdcm from 'applications/stdcm/Home';
import HomeEditor from 'applications/editor/Home';
import HomeMap from 'applications/referenceMap/Home';
import { MODES } from 'applications/operationalStudies/consts';
import Study from 'applications/operationalStudies/views/Study';
import Project from 'applications/operationalStudies/views/Project';
import Scenario from 'applications/operationalStudies/views/Scenario';
import HomeOperationalStudies from 'applications/operationalStudies/Home';
import HomeRollingStockEditor from 'applications/rollingStockEditor/Home';

import { editorSlice } from 'reducers/editor';
import { mapViewerSlice } from 'reducers/mapViewer';
import editorSelectors from 'reducers/editor/selectors';
import { updateLastInterfaceVersion } from 'reducers/main';
import { stdcmConfSlice } from 'reducers/osrdconf/stdcmConf';
import mapViewerSelectors from 'reducers/mapViewer/selectors';
import stdcmConfSelectors from 'reducers/osrdconf/stdcmConf/selectors';
import { operationalStudiesConfSlice } from 'reducers/osrdconf/operationalStudiesConf';
import simulationConfSelectors from 'reducers/osrdconf/operationalStudiesConf/selectors';

import('@sncf/bootstrap-sncf.metier.reseau/dist/css/bootstrap-sncf.min.css');

const router = createBrowserRouter([
  {
    path: '/',
    element: <Home />,
  },
  {
    path: 'map/*',
    element: (
      <OsrdContextLayout
        slice={mapViewerSlice}
        selectors={mapViewerSelectors}
        mode={MODES.mapViewer}
      />
    ),
    children: [{ path: '*', element: <HomeMap /> }],
  },
  {
    path: 'editor/*',
    element: (
      <OsrdContextLayout slice={editorSlice} selectors={editorSelectors} mode={MODES.editor} />
    ),
    children: [
      {
        path: '*',
        element: <HomeEditor />,
      },
    ],
  },
  {
    path: 'stdcm/*',
    element: (
      <OsrdContextLayout slice={stdcmConfSlice} selectors={stdcmConfSelectors} mode={MODES.stdcm} />
    ),
    children: [
      {
        path: '*',
        element: <HomeStdcm />,
      },
    ],
  },
  {
    path: 'rolling-stock-editor/*',
    element: <HomeRollingStockEditor />,
  },
  {
    path: 'operational-studies/',
    element: (
      <OsrdContextLayout
        slice={operationalStudiesConfSlice}
        selectors={simulationConfSelectors}
        mode={MODES.simulation}
      />
    ),
    errorElement: <ErrorBoundary />,
    children: [
      {
        path: 'projects',
        element: <HomeOperationalStudies />,
      },
      {
        path: 'projects/:projectId',
        element: <Project />,
      },
      {
        path: 'projects/:projectId/studies/:studyId',
        element: <Study />,
      },
      {
        path: 'projects/:projectId/studies/:studyId/scenarios/:scenarioId',
        element: <Scenario />,
      },
    ],
  },
  {
    path: '*',
    element: <ErrorBoundary />,
  },
]);

export default function App() {
  const dispatch = useDispatch();
  useEffect(() => {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // Blindly dispatch current front version for storage
    dispatch(updateLastInterfaceVersion(import.meta.env.OSRD_GIT_DESCRIBE));
  }, []);
  const { isUserLogged } = useAuth();
  return (
    <Suspense fallback={<Loader />}>
      <NotificationsState />
      {isUserLogged && <RouterProvider router={router} />}
      {!isUserLogged && <Loader />}
    </Suspense>
  );
}
