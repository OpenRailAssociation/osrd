import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Draft } from 'immer';

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

export type SearchJourneyState = {
  infraId?: number;
  timetableIds: number[];
  startTime?: SearchJourneyStartTime;
  origin?: SearchJourneyOperationalPoint;
  destination?: SearchJourneyOperationalPoint;
};

export const searchJourneyInitialState: SearchJourneyState = {
  infraId: undefined,
  timetableIds: [],
  startTime: undefined,
  origin: undefined,
  destination: undefined,
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
  resetSearchJourneyConfig,
} = searchJourneySlice.actions;

export type SearchJourneySlice = typeof searchJourneySlice;

export default searchJourneySlice.reducer;
