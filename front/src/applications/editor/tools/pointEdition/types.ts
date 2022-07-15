import { Feature, Point } from 'geojson';

import { CommonToolState, MakeOptional } from '../types';
import { EditorEntity } from '../../../../types';

export type PointEditionState<E extends EditorEntity> = CommonToolState & {
  initialEntity: MakeOptional<E, 'geometry'>;
  entity: MakeOptional<E, 'geometry'>;
  isHoveringTarget?: boolean;
  nearestPoint: { feature: Feature<Point>; trackSectionID: string; angle: number } | null;
};
