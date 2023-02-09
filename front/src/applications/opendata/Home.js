import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import MastNavItemSNCF from 'common/BootstrapSNCF/MastNavItemSNCF';
import MastNavSNCF from 'common/BootstrapSNCF/MastNavSNCF';
import NavBarSNCF from 'common/BootstrapSNCF/NavBarSNCF';
import { useTranslation } from 'react-i18next';
import { MdMoreTime } from 'react-icons/md';
import logo from 'assets/pictures/home/opendata.svg';
import './opendata.scss';
import OpenDataImport from './OpenDataImport';

export default function HomeOpenData() {
  const { t } = useTranslation(['opendata', 'home']);
  return (
    <>
      <MastNavSNCF
        items={
          <MastNavItemSNCF
            link="/opendata/import"
            linkname={t('opendata:import')}
            icon={<MdMoreTime />}
          />
        }
      />
      <NavBarSNCF appName={t('home:opendataimport')} logo={logo} />
      <Routes>
        <Route path="/import" element={<OpenDataImport />} />
        <Route path="" element={<Navigate to="/opendata/import" replace />} />
      </Routes>
    </>
  );
}
