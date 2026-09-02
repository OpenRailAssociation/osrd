import { TimePicker } from '@osrd-project/ui-core';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { updateSearchJourneyStartTime } from 'reducers/searchJourney';
import { getSearchJourneyStartTime } from 'reducers/searchJourney/selectors';
import { useAppDispatch } from 'store';

type SearchJourneyStartTimeProps = {
  disabled?: boolean;
};

const SearchJourneyStartTime = ({ disabled = false }: SearchJourneyStartTimeProps) => {
  const { t } = useTranslation('search-journey');
  const dispatch = useAppDispatch();
  const startTime = useSelector(getSearchJourneyStartTime);

  return (
    <div className="search-journey-start-time">
      <TimePicker
        testIdPrefix="search-journey-start-time"
        id="search-journey-start-time"
        label={t('trainPath.time')}
        hours={startTime?.hours}
        minutes={startTime?.minutes}
        onTimeChange={({ hours, minutes }) => {
          dispatch(updateSearchJourneyStartTime({ hours, minutes }));
        }}
        disabled={disabled}
        readOnly={false}
        narrow
      />
    </div>
  );
};

export default SearchJourneyStartTime;
