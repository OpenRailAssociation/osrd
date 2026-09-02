import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Draft } from 'immer';

import type { TrainSchedulePart } from 'common/api/osrdEditoastApi';

export type SearchJourneyOperationalPoint = {
  id: string;
  mainCode: string;
  countryCode: string;
  uic: number;
  secondaryCode?: string | null;
  name: string;
  coordinates: [number, number];
};

/** Time of day only (no date), matching the `start_ms` (ms since midnight) expected by the back-end. */
export type SearchJourneyStartTime = {
  hours: number;
  minutes: number;
};

/** A single journey proposal: an ordered list of train schedule segments. */
export type SearchJourneySolution = TrainSchedulePart[];

export type SearchJourneyState = {
  infraId?: number;
  timetableIds: number[];
  startTime?: SearchJourneyStartTime;
  origin?: SearchJourneyOperationalPoint;
  destination?: SearchJourneyOperationalPoint;
  journeys?: SearchJourneySolution[];
  selectedSolutionIndex?: number;
};

export const searchJourneyInitialState: SearchJourneyState = {
  infraId: undefined,
  timetableIds: [],
  startTime: undefined,
  origin: undefined,
  destination: undefined,
  journeys: undefined,
  selectedSolutionIndex: undefined,
};

export const searchJourneySlice = createSlice({
  name: 'searchJourney',
  initialState: searchJourneyInitialState,
  reducers: {
    /** Set the environment (infra + timetables) returned by GET /search_journeys/search_environment */
    setSearchJourneyEnv(
      state: Draft<SearchJourneyState>,
      action: PayloadAction<{ infraId: number; timetableIds: number[] }>
    ) {
      state.infraId = action.payload.infraId;
      state.timetableIds = action.payload.timetableIds;
    },
    updateSearchJourneyStartTime(
      state: Draft<SearchJourneyState>,
      action: PayloadAction<SearchJourneyState['startTime']>
    ) {
      state.startTime = action.payload;
    },
    updateSearchJourneyOrigin(
      state: Draft<SearchJourneyState>,
      action: PayloadAction<SearchJourneyState['origin']>
    ) {
      state.origin = action.payload;
    },
    updateSearchJourneyDestination(
      state: Draft<SearchJourneyState>,
      action: PayloadAction<SearchJourneyState['destination']>
    ) {
      state.destination = action.payload;
    },
    /** Set the journeys returned by POST /search_journeys, selecting the first one by default. */
    setSearchJourneyResults(
      state: Draft<SearchJourneyState>,
      action: PayloadAction<SearchJourneySolution[]>
    ) {
      state.journeys = action.payload;
      state.selectedSolutionIndex = action.payload.length > 0 ? 0 : undefined;
    },
    selectSearchJourneySolution(state: Draft<SearchJourneyState>, action: PayloadAction<number>) {
      state.selectedSolutionIndex = action.payload;
    },
    clearSearchJourneyResults(state: Draft<SearchJourneyState>) {
      state.journeys = undefined;
      state.selectedSolutionIndex = undefined;
    },
    resetSearchJourneyConfig() {
      return searchJourneyInitialState;
    },
  },
});

export const {
  setSearchJourneyEnv,
  updateSearchJourneyStartTime,
  updateSearchJourneyOrigin,
  updateSearchJourneyDestination,
  setSearchJourneyResults,
  selectSearchJourneySolution,
  clearSearchJourneyResults,
  resetSearchJourneyConfig,
} = searchJourneySlice.actions;

export type SearchJourneySlice = typeof searchJourneySlice;

export default searchJourneySlice.reducer;
