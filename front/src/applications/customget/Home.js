import 'applications/osrd/osrd.scss';

import { Route, Routes } from 'react-router-dom';

import MastNavItemSNCF from 'common/BootstrapSNCF/MastNavItemSNCF';
import MastNavSNCF from 'common/BootstrapSNCF/MastNavSNCF';
import NavBarSNCF from 'common/BootstrapSNCF/NavBarSNCF';
import { NotificationsState } from 'common/Notifications';
import React from 'react';
import logo from 'assets/logo_osrd_seul_blanc.svg';
import { useTranslation } from 'react-i18next';

import CustomGET from 'applications/customget/views/CustomGET';

import './Home.scss';

function HomeCustomGET() {
  const { t } = useTranslation('customget');

  return (
    <div className="customget-home">
      <MastNavSNCF
        items={
          <div className="mast-nav-sncf-items">
            <MastNavItemSNCF
              link="/customget/"
              linkname={t('results')}
              icon="icons-itinerary-train-station"
            />
            <li>
              <button
                type="button"
                className="mastnav-item"
                data-toggle="modal"
                data-target="#add-file-modal"
              >
                <i className="icons-add icons-size-1x5" aria-hidden="true" />
                <span className="font-weight-medium">{t('uploadFile')}</span>
              </button>
            </li>
          </div>
        }
      />
      <NavBarSNCF appName="OSRD" logo={logo} />
      <Routes>
        <Route path="" element={<CustomGET />} />
      </Routes>
      <NotificationsState />
    </div>
  );
}

export default HomeCustomGET;
