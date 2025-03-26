import type { PathLevel, HoveredItem } from '@osrd-project/ui-charts';

import { PATH_COLORS } from 'modules/simulationResult/consts';
import type { OccurrenceId, TrainId } from 'reducers/osrdconf/types';
import { getPacedTrainIdFromOccurrenceId, isOccurrence } from 'utils/trainId';

const getPathStyle = (
  hovered: HoveredItem | null,
  path: { color: string; id: string },
  dragging: boolean,
  selectedPathId?: TrainId
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
  // Apply occurrence style if selectedPathId is an occurence from the same paced
  if (selectedPathId) {
    if (isOccurrence(selectedPathId)) {
      // Selected occurrence
      if (path.id === selectedPathId) {
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
        getPacedTrainIdFromOccurrenceId(path.id as OccurrenceId) ===
        getPacedTrainIdFromOccurrenceId(selectedPathId)
      ) {
        return {
          color: PATH_COLORS.SELECTED_OCCURRENCE_PATH,
          level: 2,
          border: {
            offset: 3,
            width: 1,
            color: PATH_COLORS.SELECTED_OCCURRENCE_PATH,
            backgroundColor: '#FAE6F6',
          },
        };
      }
    } else if (path.id === selectedPathId) {
      return { color: PATH_COLORS.SELECTED_PATH, level: 1 };
    }
  }
  // Apply path style if selectedPathId is a trainId

  return { color: path.color };
};

export default getPathStyle;
