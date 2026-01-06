import { createContext } from 'react';

import type { SpeedSpaceDiagramContextType } from './types';
import type { CanvasContextType } from '../common/types';

/**
 * This context exports everything necessary to draw the chart.
 * It is updated anytime the scales are updated.
 */
export const SpeedSpaceDiagramContext = createContext<SpeedSpaceDiagramContextType>(
  // That value should never be used, since the context should always be accessed within a provider
  undefined as unknown as SpeedSpaceDiagramContextType
);

export const SpeedSpaceDiagramCanvasContext = createContext<
  CanvasContextType<SpeedSpaceDiagramContextType>
>(
  // That value should never be used, since the context should always be accessed within a provider
  undefined as unknown as CanvasContextType<SpeedSpaceDiagramContextType>
);
