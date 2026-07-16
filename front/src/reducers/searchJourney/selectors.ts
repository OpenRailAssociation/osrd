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

const selectors = {
  getSearchJourneyConf,
  getSearchJourneyInfraId,
  getSearchJourneyTimetableIds,
  getSearchJourneyStartTime,
  getSearchJourneyOrigin,
  getSearchJourneyDestination,
};

export type SearchJourneySelectors = typeof selectors;

export default selectors;
