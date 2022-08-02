import 'applications/osrd/osrd.scss';

import { Route, Routes } from 'react-router-dom';

import AboutOSRD from '../osrd/About';
import MastNavItemSNCF from 'common/BootstrapSNCF/MastNavItemSNCF';
import MastNavSNCF from 'common/BootstrapSNCF/MastNavSNCF';
import NavBarSNCF from 'common/BootstrapSNCF/NavBarSNCF';
import { Navigate } from 'react-router';
import { NotificationsState } from 'common/Notifications.tsx';
import OSRDSTDCM from './views/OSRDSTDCM';
import PropTypes from 'prop-types';
import React from 'react';
import { connect } from 'react-redux';
import logo from 'assets/logo_osrd_seul_blanc.svg';
import { withTranslation } from 'react-i18next';

class HomeStdcm extends React.Component {
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
                link="/stdcm"
                linkname={t('osrd.nav.home')}
                icon="icons-itinerary-train-station"
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

          <Route path="/about" element={<AboutOSRD />} />

          <Route path="" element={<OSRDSTDCM />} />



        </Routes>
        <NotificationsState />
      </>
    );
  }
}

const mapStateToProps = (state) => ({
  osrdsimulation: state.osrdsimulation,
});

export default connect(mapStateToProps)(withTranslation()(HomeStdcm));
