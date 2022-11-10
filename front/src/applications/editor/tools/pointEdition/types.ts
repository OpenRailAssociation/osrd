import { Feature, Point } from 'geojson';

import { CommonToolState, LayerType } from '../types';
import { EditorEntity } from '../../../../types';

export type PointEditionState<E extends EditorEntity> = CommonToolState & {
  initialEntity: E;
  entity: E;
  objType: LayerType;
  isHoveringTarget?: boolean;
  nearestPoint: {
    feature: Feature<Point>;
    position: number;
    trackSectionID: string;
    angle: number;
  } | null;
};
