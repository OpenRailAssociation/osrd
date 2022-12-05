import 'i18n';

import { unstable_HistoryRouter as HistoryRouter, Route, Routes } from 'react-router-dom';
import React, { Suspense, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import Home from 'main/Home';
import HomeCarto from 'applications/carto/Home';
import HomeEditor from 'applications/editor/Home';
import HomeOSRD from 'applications/osrd/Home';
import HomeStdcm from 'applications/stdcm/Home';
import HomeOpenData from 'applications/opendata/Home';
import HomeCustomGET from 'applications/customget/Home';
import Loader from 'common/Loader';
import { attemptLoginOnLaunch } from 'reducers/user';
import { bootstrapOSRDConf } from 'reducers/osrdconf';
import { getInfraID } from 'reducers/osrdconf/selectors';
import history from '../history';

export default function App() {
  const user = useSelector((state) => state.user);
  const infraID = useSelector(getInfraID);

  const { darkmode } = useSelector((state) => state.main);
  const dispatch = useDispatch();

  useEffect(() => {
    if (process.env.REACT_APP_LOCAL_BACKEND) {
      console.log('*** USING LOCAL BACKEND ***');
    } else {
      dispatch(attemptLoginOnLaunch());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Conditionnal theming
  useEffect(() => {
    if (darkmode) {
      import('@sncf/bootstrap-sncf.metier.reseau/dist/css/bootstrap-sncf.dark.min.css');
    } else {
      import('@sncf/bootstrap-sncf.metier.reseau/dist/css/bootstrap-sncf.min.css');
    }
  }, [darkmode]);

  // Loading initial data
  useEffect(() => {
    dispatch(bootstrapOSRDConf(infraID));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Suspense fallback={<Loader />}>
      {(user.isLogged || process.env.REACT_APP_LOCAL_BACKEND) && (
        <HistoryRouter history={history}>
          <Routes>
            <Route path="/osrd/*" element={<HomeOSRD />} />
            <Route path="/carto/*" element={<HomeCarto />} />
            <Route path="/editor/*" element={<HomeEditor />} />
            <Route path="/stdcm/*" element={<HomeStdcm />} />
            <Route path="/opendata/*" element={<HomeOpenData />} />
            <Route path="/customget/*" element={<HomeCustomGET />} />
            <Route path="/*" element={<Home />} />
          </Routes>
        </HistoryRouter>
      )}
      {!user.isLogged && !process.env.REACT_APP_LOCAL_BACKEND && <Loader />}
    </Suspense>
  );
}
