import React from 'react';

import { Route, Routes } from 'react-router-dom';

import NavBarSNCF from 'common/BootstrapSNCF/NavBarSNCF';
import logo from 'assets/pictures/home/stdcm.svg';
import { useTranslation } from 'react-i18next';
import OSRDSTDCM from './views/OSRDSTDCM';

export default function HomeStdcm() {
  const { t } = useTranslation(['home', 'translation']);
  return (
    <>
      <NavBarSNCF appName={t('home:stdcm')} logo={logo} />
      <Routes>
        <Route path="" element={<OSRDSTDCM />} />
      </Routes>
    </>
  );
}
