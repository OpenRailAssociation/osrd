import 'i18n';

import { BrowserRouter, Route, Routes } from 'react-router-dom';
import React, { Suspense, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import Home from 'main/Home';
import HomeCarto from 'applications/carto/Home';
import HomeEditor from 'applications/editor/Home';
import HomeOSRD from 'applications/osrd/Home';
import HomeStdcm from 'applications/stdcm/Home';
import Loader from 'common/Loader';
import { attemptLoginOnLaunch } from 'reducers/user';

export default function App() {
  const user = useSelector((state) => state.user);
  const { darkmode } = useSelector((state) => state.main);
  const dispatch = useDispatch();

  useEffect(() => {
    if (process.env.REACT_APP_LOCAL_BACKEND) {
      console.log('*** USING LOCAL BACKEND ***');
    } else {
      dispatch(attemptLoginOnLaunch());
    }
  }, []);

  // Conditionnal theming
  useEffect(() => {
    if (darkmode) {
      import('@sncf/bootstrap-sncf.metier.reseau/dist/css/bootstrap-sncf.dark.min.css');
    } else {
      import('@sncf/bootstrap-sncf.metier.reseau/dist/css/bootstrap-sncf.min.css');
    }
  }, [darkmode]);

  return (
    <Suspense fallback={<Loader />}>
      {(user.isLogged || process.env.REACT_APP_LOCAL_BACKEND) && (
        <BrowserRouter>
          <Routes>
            <Route path="/osrd/*" element={<HomeOSRD />} />
            <Route path="/carto/*" element={<HomeCarto />} />
            <Route path="/editor/*" element={<HomeEditor />} />
            <Route path="/stdcm/*" element={<HomeStdcm />} />
            <Route path="/*" element={<Home />} />
          </Routes>
        </BrowserRouter>
      )}
      {!user.isLogged && !process.env.REACT_APP_LOCAL_BACKEND && <Loader />}
    </Suspense>
  );
}
