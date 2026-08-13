import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import {
  getSearchJourneyJourneys,
  getSearchJourneySelectedSolution,
} from 'reducers/searchJourney/selectors';

import SearchJourneySolutionNavigator from './SearchJourneySolutionNavigator';
import SolutionSegmentCard from './SolutionSegmentCard';

type SearchJourneyResultsProps = {
  trainNames: Record<number, string>;
  operationalPointNames: Record<string, string>;
};

const SearchJourneyResults = ({ trainNames, operationalPointNames }: SearchJourneyResultsProps) => {
  const { t } = useTranslation('search-journey');
  const journeys = useSelector(getSearchJourneyJourneys);
  const selectedSolution = useSelector(getSearchJourneySelectedSolution);

  if (!journeys) return null;

  if (journeys.length === 0) {
    return (
      <div className="search-journey-results search-journey-results--empty">
        {t('results.noResult')}
      </div>
    );
  }

  return (
    <div className="search-journey-results">
      <SearchJourneySolutionNavigator />
      <div className="search-journey-results__segments">
        {selectedSolution?.map((part, index) => (
          <SolutionSegmentCard
            key={`${part.train_schedule_id}-${part.from.path_step_index}-${part.to.path_step_index}`}
            index={index + 1}
            isFirst={index === 0}
            isLast={index === selectedSolution.length - 1}
            part={part}
            trainName={trainNames[part.train_schedule_id]}
            fromOperationalPointName={operationalPointNames[part.from.op_id]}
            toOperationalPointName={operationalPointNames[part.to.op_id]}
          />
        ))}
      </div>
    </div>
  );
};

export default SearchJourneyResults;
