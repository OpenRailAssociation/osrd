import { Feature, Point } from 'geojson';

import { CommonToolState } from '../types';
import { SignalEntity } from '../../../../types';

export type SignalEditionState = CommonToolState & {
  initialSignal: SignalEntity;
  signal: SignalEntity;
  isDragging?: boolean;
  isHoveringTarget?: boolean;
  nearestPoint: { feature: Feature<Point>; trackSectionID: string } | null;
};
