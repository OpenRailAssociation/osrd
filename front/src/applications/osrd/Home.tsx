/* eslint-disable import/order */
import React from 'react';
import { Route, Routes } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router';

import { RootState } from 'reducers';

import MastNavItemSNCF from 'common/BootstrapSNCF/MastNavItemSNCF';
import MastNavSNCF from 'common/BootstrapSNCF/MastNavSNCF';
import NavBarSNCF from 'common/BootstrapSNCF/NavBarSNCF';
import { NotificationsState } from 'common/Notifications';
import OSRDSimulationConfig from './views/OSDSimulationConfig';
import OSRDSimulation from './views/OSRDSimulation/OSRDSimulation';

import logo from 'assets/logo_osrd_seul_blanc.svg';
import 'applications/osrd/osrd.scss';

function HomeOSRD() {
  const { t } = useTranslation(['translation']);
  const redirectToGraph = useSelector((state: RootState) => state.osrdsimulation.redirectToGraph);
  return (
    <>
      <MastNavSNCF
        items={
          <>
            <MastNavItemSNCF
              link="/osrd/settings"
              linkname={t('osrd.nav.home')}
              icon="icons-itinerary-train-station"
            />
            <MastNavItemSNCF
              link="/osrd/simulation"
              linkname={t('osrd.nav.simulation')}
              icon="icons-itinerary-train"
            />
            <MastNavItemSNCF
              link="/osrd/simulation"
              linkname="chaussette"
              icon="icons-itinerary-train"
            />
          </>
        }
        itemsBottom={
          <MastNavItemSNCF
            link="/osrd/contact"
            linkname={t('osrd.nav.contact')}
            icon="icons-support"
            bottom
          />
        }
      />
      <NavBarSNCF appName="OSRD" logo={logo} />
      <Routes>
        <Route path="/settings" element={<OSRDSimulationConfig />} />
        <Route path="/simulation" element={<OSRDSimulation />} />
        <Route
          path=""
          element={
            <Navigate to={redirectToGraph ? '/osrd/simulation' : '/osrd/settings'} replace />
          }
        />
      </Routes>
      <NotificationsState />
    </>
  );
}

export default HomeOSRD;
