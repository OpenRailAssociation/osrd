import React from 'react';
import { useTranslation } from 'react-i18next';
import { Route, Routes } from 'react-router-dom';

import config from 'config/config';
import logo from 'assets/pictures/home/editor.svg';
import NavBarSNCF from 'common/BootstrapSNCF/NavBarSNCF';
import Editor from './Editor';

export default function HomeEditorUnplugged() {
  const { t } = useTranslation('home');
  return (
    <>
      <NavBarSNCF appName={t('editor')} logo={logo} />
      <div className="no-mastnav">
        <Routes>
          <Route path="/" element={<Editor urlmap={config.proxy} />} />
          <Route path="/:infra" element={<Editor urlmap={config.proxy} />} />
        </Routes>
      </div>
    </>
  );
}
