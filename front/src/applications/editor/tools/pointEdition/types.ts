import { Feature, Point } from 'geojson';

import { EditorEntity } from '../../../../types';
import { CommonToolState } from '../commonToolState';
import { LayerType } from '../types';

export type PointEditionState<E extends EditorEntity> = CommonToolState & {
  initialEntity: E;
  entity: E;
  objType: LayerType;
  isHoveringTarget?: boolean;
  nearestPoint: {
    feature: Feature<Point>;
    trackSectionID: string;
    angle: number;
  } | null;
};
