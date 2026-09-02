import type { RootState } from 'reducers';
import { searchJourneySlice, type SearchJourneyState } from 'reducers/searchJourney';
import { makeSubSelector } from 'utils/selectors';

export const getSearchJourneyConf = (state: RootState) => state[searchJourneySlice.name];

const makeSearchJourneySelector = makeSubSelector<SearchJourneyState>(getSearchJourneyConf);

export const getSearchJourneyInfraId = makeSearchJourneySelector('infraId');
export const getSearchJourneyTimetableIds = makeSearchJourneySelector('timetableIds');
export const getSearchJourneyStartTime = makeSearchJourneySelector('startTime');
export const getSearchJourneyOrigin = makeSearchJourneySelector('origin');
export const getSearchJourneyDestination = makeSearchJourneySelector('destination');
export const getSearchJourneyJourneys = makeSearchJourneySelector('journeys');
export const getSearchJourneySelectedSolutionIndex =
  makeSearchJourneySelector('selectedSolutionIndex');

export const getSearchJourneySelectedSolution = (state: RootState) => {
  const journeys = getSearchJourneyJourneys(state);
  const selectedSolutionIndex = getSearchJourneySelectedSolutionIndex(state);
  return selectedSolutionIndex !== undefined ? journeys?.[selectedSolutionIndex] : undefined;
};

const selectors = {
  getSearchJourneyConf,
  getSearchJourneyInfraId,
  getSearchJourneyTimetableIds,
  getSearchJourneyStartTime,
  getSearchJourneyOrigin,
  getSearchJourneyDestination,
  getSearchJourneyJourneys,
  getSearchJourneySelectedSolutionIndex,
  getSearchJourneySelectedSolution,
};

export type SearchJourneySelectors = typeof selectors;

export default selectors;
