import React from 'react';
import PropTypes from 'prop-types';
import { Route, Routes } from 'react-router-dom';
import MastNavItemSNCF from 'common/BootstrapSNCF/MastNavItemSNCF';
import MastNavSNCF from 'common/BootstrapSNCF/MastNavSNCF';
import NavBarSNCF from 'common/BootstrapSNCF/NavBarSNCF';
import { Navigate } from 'react-router';
import { NotificationsState } from 'common/Notifications';
import logo from 'assets/pictures/home/timetable.svg';
import { useTranslation } from 'react-i18next';
import OSRDSimulationConfig from './views/OSDSimulationConfig';
import OSRDSimulation from './views/OSRDSimulation/OSRDSimulation';
import AboutOSRD from './About';
import 'applications/osrd/osrd.scss';

export default function HomeOSRD(props) {
  const { t } = useTranslation(['home', 'translation']);
  const { redirectToGraph } = props;
  return (
    <>
      <MastNavSNCF
        items={
          <>
            <MastNavItemSNCF
              link="/osrd/settings"
              linkname={t('translation:osrd.nav.home')}
              icon="icons-itinerary-train-station"
            />
            <MastNavItemSNCF
              link="/osrd/simulation"
              linkname={t('translation:osrd.nav.simulation')}
              icon="icons-itinerary-train"
            />
          </>
        }
        itemsBottom={
          <MastNavItemSNCF
            link="/osrd/contact"
            linkname={t('translation:osrd.nav.contact')}
            icon="icons-support"
            bottom
          />
        }
      />
      <NavBarSNCF appName={t('home:timetable')} logo={logo} />
      <Routes>
        <Route path="/settings" element={<OSRDSimulationConfig />} />
        <Route path="/about" element={<AboutOSRD />} />
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

HomeOSRD.defaultProps = {
  redirectToGraph: false,
};
HomeOSRD.propTypes = {
  redirectToGraph: PropTypes.bool,
};
