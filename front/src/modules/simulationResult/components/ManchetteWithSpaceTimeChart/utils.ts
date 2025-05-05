/* eslint-disable import/prefer-default-export */
import type { PathLevel, HoveredItem } from '@osrd-project/ui-charts';

import { PATH_COLORS } from 'modules/simulationResult/consts';
import type { TrainId } from 'reducers/osrdconf/types';
import { extractPacedTrainIdFromOccurenceId, isOccurrenceId } from 'utils/trainId';

const getPathStyle = (
  hovered: HoveredItem | null,
  path: { color: string; id: string },
  dragging: boolean,
  selectedTrainId?: TrainId
): {
  color: string;
  level?: PathLevel;
  border?: {
    offset: number;
    color: string;
    width?: number;
    backgroundColor?: string;
  };
} => {
  if (hovered && 'pathId' in hovered.element && path.id === hovered?.element.pathId && !dragging) {
    return { color: PATH_COLORS.HOVERED_PATH, level: 1 };
  }
  // Apply occurrence style if selectedTrainId is an occurrence from the same paced
  if (selectedTrainId) {
    if (isOccurrenceId(selectedTrainId)) {
      // Selected occurrence
      if (path.id === selectedTrainId) {
        return {
          color: PATH_COLORS.SELECTED_OCCURRENCE_PATH,
          level: 1,
          border: {
            offset: 3.5,
            color: 'transparent',
            backgroundColor: '#FAE6F6',
          },
        };
      }
      // Other occurrences from the same paced
      if (
        isOccurrenceId(path.id) &&
        extractPacedTrainIdFromOccurenceId(path.id) ===
          extractPacedTrainIdFromOccurenceId(selectedTrainId)
      ) {
        return {
          color: PATH_COLORS.SELECTED_OCCURRENCE_PATH,
          level: 2,
          border: {
            offset: 3,
            width: 0.5,
            color: PATH_COLORS.SELECTED_OCCURRENCE_PATH,
            backgroundColor: '#FAE6F6',
          },
        };
      }
    } else if (path.id === selectedTrainId) {
      return { color: PATH_COLORS.SELECTED_PATH, level: 1 };
    }
  }
  return { color: path.color };
};

export default getPathStyle;
