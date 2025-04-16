/* eslint-disable import/prefer-default-export */
import type { PathLevel, HoveredItem } from '@osrd-project/ui-charts';

import { PATH_COLORS } from 'modules/simulationResult/consts';
import type { TrainId } from 'reducers/osrdconf/types';

export const getPathStyle = (
  selectedTrainId: TrainId | undefined,
  hovered: HoveredItem | null,
  path: { color: string; id: string },
  dragging: boolean
): { color: string; level?: PathLevel } => {
  if (path.id === selectedTrainId) {
    return { color: path.color, level: 1 };
  }
  if (hovered && 'pathId' in hovered.element && path.id === hovered?.element.pathId && !dragging) {
    return { color: PATH_COLORS.HOVERED_PATH, level: 1 };
  }
  return { color: path.color };
};
