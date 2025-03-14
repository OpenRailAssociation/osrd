import { createContext } from 'react';

import {
  type CanvasContextType,
  type MouseContextType,
  type SpaceTimeChartContextType,
} from './types';

// There are three different contexts because they have very different lifecycles.

/**
 * This context exports everything necessary to draw the chart.
 * It is updated anytime the scales are updated.
 */
export const SpaceTimeChartContext = createContext<SpaceTimeChartContextType>(
  // That value should never be used, since the context should always be accessed within a provider
  undefined as unknown as SpaceTimeChartContextType
);

/**
 * This context only contains necessary helpers to (un)register drawing functions.
 * It is basically never updated.
 */
export const CanvasContext = createContext<CanvasContextType>(
  // That value should never be used, since the context should always be accessed within a provider
  undefined as unknown as CanvasContextType
);

/**
 * This context exports everything necessary to draw the chart.
 * It is updated anytime the scales are updated or the mouse moves.
 */
export const MouseContext = createContext<MouseContextType>(
  // That value should never be used, since the context should always be accessed within a provider
  undefined as unknown as MouseContextType
);
