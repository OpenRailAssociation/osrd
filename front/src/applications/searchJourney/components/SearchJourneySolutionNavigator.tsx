import cx from 'classnames';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { useAppDispatch } from 'store/hooks';

import { selectSearchJourneySolution } from 'reducers/searchJourney';
import {
  getSearchJourneyJourneys,
  getSearchJourneySelectedSolutionIndex,
} from 'reducers/searchJourney/selectors';
import { msSinceMidnightToTime } from 'utils/date';

const SOLUTION_TITLE_KEYS = [
  'results.solutionTitles.closestDeparture',
  'results.solutionTitles.fastest',
  'results.solutionTitles.fewestTransfers',
] as const;

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
            {index < SOLUTION_TITLE_KEYS.length
              ? t(SOLUTION_TITLE_KEYS[index])
              : t('results.solution', { number: index + 1 })}
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
