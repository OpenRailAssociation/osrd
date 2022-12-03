import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import MastNavItemSNCF from 'common/BootstrapSNCF/MastNavItemSNCF';
import MastNavSNCF from 'common/BootstrapSNCF/MastNavSNCF';
import NavBarSNCF from 'common/BootstrapSNCF/NavBarSNCF';
import { NotificationsState } from 'common/Notifications';
import { useTranslation } from 'react-i18next';
import { MdMoreTime } from 'react-icons/md';
import logo from './graou-logo.png';
import './graou.scss';
import GraouImport from './GraouImport';

export default function HomeGraou() {
  const { t } = useTranslation(['graou']);
  return (
    <>
      <MastNavSNCF
        items={
          <MastNavItemSNCF link="/graou/import" linkname={t('import')} icon={<MdMoreTime />} />
        }
      />
      <NavBarSNCF appName="GRAOU" logo={logo} />
      <Routes>
        <Route path="/import" element={<GraouImport />} />
        <Route path="" element={<Navigate to="/graou/import" replace />} />
      </Routes>
      <NotificationsState />
    </>
  );
}
