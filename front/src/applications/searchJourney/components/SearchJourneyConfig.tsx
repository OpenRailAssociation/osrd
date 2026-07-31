import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import StdcmCard from 'applications/stdcm/components/StdcmForm/StdcmCard';
import { getSearchJourneyDestination, getSearchJourneyOrigin } from 'reducers/searchJourney/selectors';

import SearchJourneyConsistOverlay from './SearchJourneyConsistOverlay';
import SearchJourneyMap from './SearchJourneyMap';
import SearchJourneyOperationalPoint from './SearchJourneyOperationalPoint';
import SearchJourneyStartTime from './SearchJourneyStartTime';

const SearchJourneyConfig = () => {
  const { t } = useTranslation('search-journey');
  const origin = useSelector(getSearchJourneyOrigin);
  const destination = useSelector(getSearchJourneyDestination);

  return (
    <div className="search-journey-config">
      <div className="search-journey-parameters">
        <div className="consist-wrapper">
          <StdcmCard name={t('consist.title')}>
            <SearchJourneyConsistOverlay />
          </StdcmCard>
        </div>
        <div className="search-journey__separator" />
        <div className="origin-destination-wrapper">
          <StdcmCard
            name={t('origin.title')}
            className="extremity"
            tip="bottom"
            testId="search-journey-card-origin"
          >
            <SearchJourneyOperationalPoint field="origin" operationalPoint={origin} />
            <SearchJourneyStartTime />
          </StdcmCard>
          <StdcmCard
            name={t('destination.title')}
            className="extremity"
            testId="search-journey-card-destination"
          >
            <SearchJourneyOperationalPoint field="destination" operationalPoint={destination} />
          </StdcmCard>
        </div>
      </div>
      <SearchJourneyMap />
    </div>
  );
};

export default SearchJourneyConfig;

