import React from 'react';

import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { Route, Routes } from 'react-router-dom';

import StdcmViewV1 from 'applications/stdcm/views/StdcmViewV1';
import StdcmViewV2 from 'applications/stdcmV2/views/StdcmViewV2';
import NavBarSNCF from 'common/BootstrapSNCF/NavBarSNCF';
import { getStdcmV2Activated } from 'reducers/user/userSelectors';

export default function HomeStdcm() {
  const stdcmV2Activated = useSelector(getStdcmV2Activated);
  const { t } = useTranslation('home/home');
  if (stdcmV2Activated) {
    return (
      <Routes>
        <Route path="" element={<StdcmViewV2 />} />
      </Routes>
    );
  }

  return (
    <>
      <NavBarSNCF appName={t('stdcm')} />
      <Routes>
        <Route path="" element={<StdcmViewV1 />} />
      </Routes>
    </>
  );
}
