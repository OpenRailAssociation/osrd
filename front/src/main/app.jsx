import React, { Suspense, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import 'i18n';
import { updateLastInterfaceVersion } from 'reducers/main';

import HomeEditor from 'applications/editor/Home';
import HomeMap from 'applications/referenceMap/Home';
import HomeOperationalStudies from 'applications/operationalStudies/Home';
import HomeStdcm from 'applications/stdcm/Home';
import Loader from 'common/Loader';
import Home from 'main/home';
import { NotificationsState } from 'common/Notifications';
import Project from 'applications/operationalStudies/views/Project';
import Study from 'applications/operationalStudies/views/Study';
import Scenario from 'applications/operationalStudies/views/Scenario';
import HomeRollingStockEditor from 'applications/rollingStockEditor/Home';
import { getIsUserLogged } from 'reducers/user/userSelectors';
import { attemptLoginOnLaunch } from 'reducers/user';
import { OsrdConfContextLayout } from 'common/osrdConfContext';
import { simulationConfSlice, simulationConfSliceActions } from 'reducers/osrdconf2/simulationConf';
import { stdcmConfSlice, stdcmConfSliceActions } from 'reducers/osrdconf2/stdcmConf';

import('@sncf/bootstrap-sncf.metier.reseau/dist/css/bootstrap-sncf.min.css');

const router = createBrowserRouter([
  {
    path: '/',
    element: <Home />,
  },
  {
    path: 'map/*',
    element: <HomeMap />,
  },
  {
    path: 'editor/*',
    element: <HomeEditor />,
  },
  {
    path: 'stdcm/*',
    element: <OsrdConfContextLayout slice={stdcmConfSlice} selectors={stdcmConfSliceActions} />,
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
      <OsrdConfContextLayout slice={simulationConfSlice} selectors={simulationConfSliceActions} />
    ),
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
]);

export default function App() {
  const isUserLogged = useSelector(getIsUserLogged);

  const dispatch = useDispatch();
  const isLocalBackend = import.meta.env.OSRD_LOCAL_BACKEND.trim().toLowerCase() === 'true';

  useEffect(() => {
    if (isLocalBackend) {
      console.info('*** USING LOCAL BACKEND ***');
    } else {
      console.info('*** USING OSRD.DEV BACKEND ***');
      dispatch(attemptLoginOnLaunch());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // Blindly dispatch current front version for storage
    dispatch(updateLastInterfaceVersion(import.meta.env.OSRD_GIT_DESCRIBE));
  }, []);

  return (
    <Suspense fallback={<Loader />}>
      <NotificationsState />
      {(isUserLogged || isLocalBackend) && <RouterProvider router={router} />}
      {!isUserLogged && !isLocalBackend && <Loader />}
    </Suspense>
  );
}
