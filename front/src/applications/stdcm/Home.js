import React from 'react';

import { Route, Routes } from 'react-router-dom';

import MastNavItemSNCF from 'common/BootstrapSNCF/MastNavItemSNCF';
import MastNavSNCF from 'common/BootstrapSNCF/MastNavSNCF';
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
      <MastNavSNCF
        items={
          <MastNavItemSNCF
            link="/stdcm"
            linkname={t('translation:osrd.nav.home')}
            icon="icons-itinerary-train-station"
          />
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
      <NavBarSNCF appName={t('home:stdcm')} logo={logo} />
      <Routes>
        <Route path="/about" element={<AboutOSRD />} />

        <Route path="" element={<OSRDSTDCM />} />
      </Routes>
      <NotificationsState />
    </>
  );
}
