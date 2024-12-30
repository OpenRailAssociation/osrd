import type { PayloadAction } from '@reduxjs/toolkit';
import type { Draft } from 'immer';

import type { OperationalStudiesConfState } from '.';

const itineraryReducer = {
  // update path steps without changing the itinerary (only add vias on the existing pathfinding,
  // add schedules, margins or power restrictions)
  updatePathSteps(
    state: Draft<OperationalStudiesConfState>,
    action: PayloadAction<OperationalStudiesConfState['pathSteps']>
  ) {
    state.pathSteps = action.payload;
  },
  deleteItinerary(state: Draft<OperationalStudiesConfState>) {
    state.pathSteps = [null, null];
    state.powerRestriction = [];
  },
  replaceItinerary(
    state: Draft<OperationalStudiesConfState>,
    action: PayloadAction<OperationalStudiesConfState['pathSteps']>
  ) {
    state.pathSteps = action.payload;
    state.powerRestriction = [];
  },
};

export default itineraryReducer;
