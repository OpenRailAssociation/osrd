import React from 'react';
import PropTypes from 'prop-types';
import { withTranslation } from 'react-i18next';
import { connect } from 'react-redux';
import { Navigate } from 'react-router';
import { Route, Routes } from 'react-router-dom';
import MastNavSNCF from 'common/BootstrapSNCF/MastNavSNCF';
import MastNavItemSNCF from 'common/BootstrapSNCF/MastNavItemSNCF';
import NavBarSNCF from 'common/BootstrapSNCF/NavBarSNCF';
import logo from 'assets/logo_osrd_seul_blanc.svg';
import { NotificationsState } from 'common/Notifications.tsx';
import AboutOSRD from './About';
import OSRDSimulation from './views/OSRDSimulation/OSRDSimulation';
import OSRDConfig from './views/OSRDConfig/OSRDConfig';
import 'applications/osrd/osrd.scss';

class HomeOSRD extends React.Component {
  static propTypes = {
    t: PropTypes.func.isRequired,
    osrdsimulation: PropTypes.object.isRequired,
  };

  render() {
    const { t, osrdsimulation } = this.props;
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
          <Route path="/settings" element={<OSRDConfig />} />
          <Route path="/about" element={<AboutOSRD />} />
          <Route path="/simulation" element={<OSRDSimulation />} />
          <Route
            path=""
            element={
              <Navigate
                to={osrdsimulation.redirectToGraph ? '/osrd/simulation' : '/osrd/settings'}
                replace
              />
            }
          />
        </Routes>
        <NotificationsState />
      </>
    );
  }
}

const mapStateToProps = (state) => ({
  osrdsimulation: state.osrdsimulation,
});

export default connect(mapStateToProps)(withTranslation()(HomeOSRD));
