import { useMemo } from 'react';

import { useSelector } from 'react-redux';

import type { TimetableItem, TrainId } from 'reducers/osrdconf/types';
import { getSelectedTrainId } from 'reducers/simulationResults/selectors';
import {
  extractEditoastIdFromPacedTrainId,
  extractPacedTrainIdFromOccurrenceId,
  isOccurrenceId,
} from 'utils/trainId';

const extractTimetableItemId = (trainId?: TrainId) => {
  if (!trainId) return undefined;
  return extractEditoastIdFromPacedTrainId(
    isOccurrenceId(trainId) ? extractPacedTrainIdFromOccurrenceId(trainId) : trainId
  );
};

const useSelectedTimetableItem = (
  timetableItems: TimetableItem[] | undefined
): TimetableItem | undefined => {
  const trainId = useSelector(getSelectedTrainId);

  const timetableItemId = extractTimetableItemId(trainId);

  return useMemo(
    () => timetableItems?.find((item) => item.id === timetableItemId),
    [timetableItems, timetableItemId]
  );
};

export default useSelectedTimetableItem;
