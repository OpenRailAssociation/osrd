import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import NavBarSNCF from 'common/BootstrapSNCF/NavBarSNCF';

const Error403 = () => {
  const { t } = useTranslation(['errors', 'common/common']);
  const navigate = useNavigate();
  return (
    <>
      <NavBarSNCF appName="OSRD" />
      <main className="mastcontainer mastcontainer-no-mastnav d-flex align-items-center justify-content-center vh-100">
        <div className="p-3 text-center">
          <h1>{t('403')}</h1>
          <button
            className="btn btn-primary btn-sm px-2 ml-2"
            type="button"
            onClick={() => navigate('/')}
          >
            {t('common/common:navigation.goHome')}
          </button>
        </div>
      </main>
    </>
  );
};

export default Error403;
