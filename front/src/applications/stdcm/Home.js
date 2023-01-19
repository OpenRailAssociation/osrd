import React from 'react';

import { Route, Routes } from 'react-router-dom';

import NavBarSNCF from 'common/BootstrapSNCF/NavBarSNCF';
import { NotificationsState } from 'common/Notifications';
import logo from 'assets/pictures/home/stdcm.svg';
import { useTranslation } from 'react-i18next';
import AboutOSRD from 'applications/osrd/About';
import OSRDSTDCM from './views/OSRDSTDCM';
import 'applications/osrd/osrd.scss';

export default function HomeStdcm() {
  const { t } = useTranslation(['home', 'translation']);
  return (
    <>
      <NavBarSNCF appName={t('home:stdcm')} logo={logo} />
      <Routes>
        <Route path="/about" element={<AboutOSRD />} />

        <Route path="" element={<OSRDSTDCM />} />
      </Routes>
      <NotificationsState />
    </>
  );
}
