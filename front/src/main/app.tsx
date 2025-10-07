import { Suspense, useEffect, useCallback } from 'react';

import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import 'i18n';

import HomeEditor from 'applications/editor/Home';
import Project from 'applications/operationalStudies/views/Project';
import ProjectList from 'applications/operationalStudies/views/ProjectList';
import Scenario from 'applications/operationalStudies/views/Scenario';
import Study from 'applications/operationalStudies/views/Study';
import HomeMap from 'applications/referenceMap/Home';
import RollingStockEditor from 'applications/rollingStockEditor/RollingStockEditorView';
import Stdcm from 'applications/stdcm/StdcmView';
import Error403 from 'common/authorization/components/Error403';
import InitialRedirect from 'common/authorization/components/InitialRedirect';
import ErrorBoundary from 'common/ErrorBoundary';
import { Loader } from 'common/Loaders';
import NotificationsState from 'common/Notifications';
import { OsrdContextLayout } from 'common/osrdContext';
import { MODES } from 'main/consts';
import { editorSlice } from 'reducers/editor';
import editorSelectors from 'reducers/editor/selectors';
import { setFailure, updateLastInterfaceVersion } from 'reducers/main';
import { operationalStudiesConfSlice } from 'reducers/osrdconf/operationalStudiesConf';
import simulationConfSelectors from 'reducers/osrdconf/operationalStudiesConf/selectors';
import { stdcmConfSlice } from 'reducers/osrdconf/stdcmConf';
import stdcmConfSelectors from 'reducers/osrdconf/stdcmConf/selectors';
import { referenceMapSlice } from 'reducers/referenceMap';
import referenceMapSelectors from 'reducers/referenceMap/selectors';
import { useAppDispatch } from 'store';
import { castErrorToFailure } from 'utils/error';
import useAuth from 'utils/hooks/useAuth';
import { DeploymentContextProvider } from 'utils/hooks/useDeploymentSettings';

import('@sncf/bootstrap-sncf.metier.reseau/dist/css/bootstrap-sncf.min.css');

const router = createBrowserRouter([
  {
    path: '/',
    element: <InitialRedirect />,
  },
  {
    path: 'map/*',
    element: (
      <OsrdContextLayout
        slice={referenceMapSlice}
        selectors={referenceMapSelectors}
        mode={MODES.referenceMap}
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
        element: <Stdcm />,
      },
    ],
  },
  {
    path: 'rolling-stock-editor/*',
    element: <RollingStockEditor />,
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
        element: <ProjectList />,
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
    path: '403/*',
    element: <Error403 />,
  },
  {
    path: '*',
    element: <ErrorBoundary />,
  },
]);

export default function App() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    // Blindly dispatch current front version for storage
    dispatch(updateLastInterfaceVersion(import.meta.env.VITE_OSRD_GIT_DESCRIBE));
  }, []);

  const handleError = useCallback((event: ErrorEvent) => {
    if (event.error instanceof Error) {
      dispatch(setFailure(castErrorToFailure(event.error)));
    }
  }, []);

  useEffect(() => {
    window.addEventListener('error', handleError);
    return () => {
      window.removeEventListener('error', handleError);
    };
  }, [handleError]);

  const { isLoading } = useAuth();

  return (
    <Suspense fallback={<Loader />}>
      <DeploymentContextProvider>
        <NotificationsState />
        {!isLoading && <RouterProvider router={router} />}
        {isLoading && <Loader />}
      </DeploymentContextProvider>
    </Suspense>
  );
}
