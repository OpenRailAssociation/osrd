import { createContext } from 'react';

import type { TrackOccupancyDiagramContextType } from './types';
import type { CanvasContextType } from '../../common/types';

// There are three different contexts because they have very different lifecycles:
// - MouseContext
// - TrackOccupancyDiagramContext
// - TrackOccupancyDiagramCanvasContext

/**
 * This context exports everything necessary to draw the chart.
 */
export const TrackOccupancyContext = createContext<TrackOccupancyDiagramContextType>(
  // That value should never be used, since the context should always be accessed within a provider
  undefined as unknown as TrackOccupancyDiagramContextType
);

export const TrackOccupancyCanvasContext = createContext<
  CanvasContextType<TrackOccupancyDiagramContextType>
>(
  // That value should never be used, since the context should always be accessed within a provider
  undefined as unknown as CanvasContextType<TrackOccupancyDiagramContextType>
);
