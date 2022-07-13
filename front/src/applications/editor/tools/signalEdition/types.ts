import { Feature, Point } from 'geojson';

import { CommonToolState, MakeOptional } from '../types';
import { SignalEntity } from '../../../../types';

export type SignalEditionState = CommonToolState & {
  initialSignal: MakeOptional<SignalEntity, 'geometry'>;
  signal: MakeOptional<SignalEntity, 'geometry'>;
  isHoveringTarget?: boolean;
  nearestPoint: { feature: Feature<Point>; trackSectionID: string; angle: number } | null;
};
