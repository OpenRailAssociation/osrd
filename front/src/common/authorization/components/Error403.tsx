import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import NavBar from 'common/NavBar';

const Error403 = () => {
  const { t } = useTranslation(['errors', 'translation']);
  const navigate = useNavigate();
  return (
    <>
      <NavBar appName="OSRD" />

      <main className="error403">
        <h1>{t('403')}</h1>
        <button
          className="btn btn-primary btn-sm px-2 ml-2"
          type="button"
          onClick={() => navigate('/')}
        >
          {t('translation:common.navigation.goHome')}
        </button>
      </main>
    </>
  );
};

export default Error403;
