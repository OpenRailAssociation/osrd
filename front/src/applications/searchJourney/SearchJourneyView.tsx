import { useTranslation } from 'react-i18next';

import logo from 'assets/logo-color-light-blue.svg';
import { ModalProvider } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import { Loader } from 'common/Loaders/Loader';

import SearchJourneyConfig from './components/SearchJourneyConfig';
import SearchJourneyEmptyConfigError from './components/SearchJourneyEmptyConfigError';
import useSearchJourneyEnv from './hooks/useSearchJourneyEnv';

const SearchJourneyView = () => {
  const { t } = useTranslation('search-journey');
  const { loading, error } = useSearchJourneyEnv();

  return (
    <>
      <div className="search-journey-header">
        <img src={logo} alt="OSRD Logo light blue variant" className="logo" />
        <div className="title">{t('appName')}</div>
      </div>
      <div className="search-journey-view">
        {loading && <Loader position="center" className="mt-5" />}
        {error !== null && <SearchJourneyEmptyConfigError />}
        {!loading && error === null && <SearchJourneyConfig />}
      </div>
    </>
  );
};

const SearchJourneyViewWrapper = () => (
  <ModalProvider>
    <SearchJourneyView />
  </ModalProvider>
);

export default SearchJourneyViewWrapper;
