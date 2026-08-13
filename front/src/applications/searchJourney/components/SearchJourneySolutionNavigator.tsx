import cx from 'classnames';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { selectSearchJourneySolution } from 'reducers/searchJourney';
import {
  getSearchJourneyJourneys,
  getSearchJourneySelectedSolutionIndex,
} from 'reducers/searchJourney/selectors';
import { useAppDispatch } from 'store';
import { msSinceMidnightToTime } from 'utils/date';

const SearchJourneySolutionNavigator = () => {
  const { t } = useTranslation('search-journey');
  const dispatch = useAppDispatch();
  const journeys = useSelector(getSearchJourneyJourneys);
  const selectedSolutionIndex = useSelector(getSearchJourneySelectedSolutionIndex);

  return (
    <div className="search-journey-solution-navigator">
      {(journeys ?? []).map((journey, index) => (
        <button
          key={index}
          type="button"
          data-testid="search-journey-solution-tab"
          className={cx('search-journey-solution-navigator__tab', {
            selected: selectedSolutionIndex === index,
          })}
          onClick={() => dispatch(selectSearchJourneySolution(index))}
        >
          <span className="search-journey-solution-navigator__tab-title">
            {t('results.solution', { number: index + 1 })}
          </span>
          <span className="search-journey-solution-navigator__tab-departure">
            {msSinceMidnightToTime(journey[0].from.time_ms)}
          </span>
        </button>
      ))}
    </div>
  );
};

export default SearchJourneySolutionNavigator;
