import React from 'react';

import { useTranslation } from 'react-i18next';
import { Route, Routes } from 'react-router-dom';

import NavBarSNCF from 'common/BootstrapSNCF/NavBarSNCF';

import StdcmView from './views/StdcmView';

export default function HomeStdcm() {
  const { t } = useTranslation('home/home');
  return (
    <>
      <NavBarSNCF appName={t('stdcm')} />
      <Routes>
        <Route path="" element={<StdcmView />} />
      </Routes>
    </>
  );
}
