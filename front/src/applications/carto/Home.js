import React from 'react';
import { useTranslation } from 'react-i18next';
import { Route, Routes } from 'react-router-dom';
import config from 'config/config';
import NavBarSNCF from 'common/BootstrapSNCF/NavBarSNCF';
import logo from 'assets/pictures/home/map.svg';
import Map from './Map';

export default function HomeCartoLegacy() {
  const { t } = useTranslation('home');
  return (
    <>
      <NavBarSNCF appName={t('map')} logo={logo} />
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
