import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import NavBarSNCF from './BootstrapSNCF/NavBarSNCF';
import logo from '../assets/pictures/views/projects.svg';
import { ModalProvider } from './BootstrapSNCF/ModalSNCF/ModalProvider';

export default function PageNotFound() {
  const { t } = useTranslation(['home/home', 'common/common']);
  const navigate = useNavigate();

  return (
    <ModalProvider>
      <NavBarSNCF appName="OSRD" logo={logo} />
      <main className="mastcontainer mastcontainer-no-mastnav d-flex align-items-center justify-content-center vh-100">
        <div className="p-3">
          <h1>{t('home/home:404')}</h1>
          <Link to="/">
            <button type="button" className="btn btn-primary btn-sm px-2 ml-2">
              {t('common/common:navigation.goHome')}
            </button>
          </Link>
          <button
            className="btn btn-primary btn-sm px-2 ml-2"
            type="button"
            onClick={() => navigate(-1)}
          >
            {t('common/common:navigation.goBack')}
          </button>
        </div>
      </main>
    </ModalProvider>
  );
}
