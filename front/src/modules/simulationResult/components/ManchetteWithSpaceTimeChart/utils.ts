import type { PathLevel } from '@osrd-project/ui-spacetimechart';
import type { HoveredItem } from '@osrd-project/ui-spacetimechart/dist/lib/types';

import { PATH_COLORS } from 'modules/simulationResult/consts';
import type { TrainId } from 'reducers/osrdconf/types';
import { formatEditoastTrainIdToTrainScheduleId } from 'utils/trainId';

/* eslint-disable import/prefer-default-export */
export const getIdFromTrainPath = (trainPath: string): TrainId =>
  // TODO : Adapt this to handle paced train in space time chart in issue https://github.com/OpenRailAssociation/osrd/issues/10613
  formatEditoastTrainIdToTrainScheduleId(+trainPath.split('-')[0]);

export const getPathStyle = (
  hovered: HoveredItem | null,
  path: { color: string; id: string },
  dragging: boolean
): { color: string; level?: PathLevel } => {
  if (hovered && 'pathId' in hovered.element && path.id === hovered?.element.pathId && !dragging) {
    return { color: PATH_COLORS.HOVERED_PATH, level: 1 };
  }
  return { color: path.color };
};
