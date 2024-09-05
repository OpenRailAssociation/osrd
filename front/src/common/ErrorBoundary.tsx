import type { SerializedError } from '@reduxjs/toolkit';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useRouteError } from 'react-router-dom';

import type { ApiError } from 'common/api/baseGeneratedApis';
import { ModalProvider } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import NavBarSNCF from 'common/BootstrapSNCF/NavBarSNCF';
import { getErrorMessage } from 'utils/error';

export default function ErrorBoundary() {
  const error = useRouteError() as ApiError | SerializedError;
  const { t } = useTranslation(['errors', 'common/common']);
  const navigate = useNavigate();
  return (
    <ModalProvider>
      <NavBarSNCF appName="OSRD" />
      <main className="mastcontainer mastcontainer-no-mastnav d-flex align-items-center justify-content-center vh-100">
        <div className="p-3">
          {error ? (
            <>
              <h1>
                {t(`errors:${(error as ApiError).status ? (error as ApiError).status : 'default'}`)}
              </h1>
              <p>{getErrorMessage(error)}</p>
            </>
          ) : (
            <h1>{t('errors:pageNotFound')}</h1>
          )}

          <Link to="/">
            <button type="button" className="btn btn-primary btn-sm px-2">
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
