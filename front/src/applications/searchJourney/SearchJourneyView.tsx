import { useEffect, useRef } from 'react';

import cx from 'classnames';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import logo from 'assets/logo-color-light-blue.svg';
import { ModalProvider } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import { Loader } from 'common/Loaders/Loader';
import {
  getSearchJourneyJourneys,
  getSearchJourneySelectedSolution,
} from 'reducers/searchJourney/selectors';

import SearchJourneyConfig from './components/SearchJourneyConfig';
import SearchJourneyEmptyConfigError from './components/SearchJourneyEmptyConfigError';
import SearchJourneyMap from './components/SearchJourneyMap';
import SearchJourneyResults from './components/SearchJourneyResults';
import SearchJourneyResultsMap from './components/SearchJourneyResultsMap';
import useSearchJourneyEnv from './hooks/useSearchJourneyEnv';
import useSearchJourneySolutionDetails from './hooks/useSearchJourneySolutionDetails';

const SearchJourneyView = () => {
  const { t } = useTranslation('search-journey');
  const { loading, error } = useSearchJourneyEnv();
  const journeys = useSelector(getSearchJourneyJourneys);
  const selectedSolution = useSelector(getSearchJourneySelectedSolution);
  const {
    geometry,
    markers,
    trainNames,
    operationalPointNames,
    loading: solutionDetailsLoading,
  } = useSearchJourneySolutionDetails(selectedSolution);

  const resultsSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (journeys && journeys.length > 0 && resultsSectionRef.current) {
      resultsSectionRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [journeys?.length]);

  return (
    <>
      <div className="search-journey-header">
        <img src={logo} alt="OSRD Logo light blue variant" className="logo" />
        <div className="title">{t('appName')}</div>
      </div>
      <div className="search-journey-view">
        {loading && <Loader position="center" className="mt-5" />}
        {error !== null && <SearchJourneyEmptyConfigError />}
        {!loading && error === null && (
          <div
            className={cx('search-journey-content-grid', {
              'search-journey-content-grid--with-results': journeys && journeys.length > 0,
            })}
          >
            <SearchJourneyConfig />
            <SearchJourneyMap />
            {journeys && (
              <div ref={resultsSectionRef} className="search-journey-results-section">
                {solutionDetailsLoading ? (
                  <Loader position="center" className="mt-5" />
                ) : (
                  <SearchJourneyResults
                    trainNames={trainNames}
                    operationalPointNames={operationalPointNames}
                  />
                )}
              </div>
            )}
            {selectedSolution && <SearchJourneyResultsMap geometry={geometry} markers={markers} />}
          </div>
        )}
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
