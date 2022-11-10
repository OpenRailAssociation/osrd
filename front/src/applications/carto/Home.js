import React from 'react';
import PropTypes from 'prop-types';
import { withTranslation } from 'react-i18next';
import { Route, Routes } from 'react-router-dom';
import config from 'config/config';
import NavBarSNCF from 'common/BootstrapSNCF/NavBarSNCF';
import logo from 'assets/logo_osrd_seul_blanc.svg';
import Map from './Map';

class HomeCartoLegacy extends React.Component {
  static propTypes = {
    t: PropTypes.func.isRequired,
  };

  render() {
    const { t } = this.props;
    return (
      <>
        <NavBarSNCF appName={t('Home.map')} logo={logo} />
        <div className="no-mastnav">
          <Routes>
            <Route path="/" element={<Map urlmap={config.proxy} />} />
            <Route
              path="/:urlLat/:urlLon/:urlZoom/:urlBearing/:urlPitch"
              element={<Map urlmap={config.proxy} />}
            />
          </Routes>
        </div>
      </>
    );
  }
}

const HomeCarto = withTranslation()(HomeCartoLegacy);

export default HomeCarto;
