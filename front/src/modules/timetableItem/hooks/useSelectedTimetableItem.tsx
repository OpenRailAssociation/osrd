import { skipToken } from '@reduxjs/toolkit/query';
import { useSelector } from 'react-redux';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import type { TimetableItem, TrainId } from 'reducers/osrdconf/types';
import { getSelectedTrainId } from 'reducers/simulationResults/selectors';
import { extractPacedTrainIdFromOccurrenceId, isOccurrenceId } from 'utils/trainId';

const extractTimetableItemId = (trainId?: TrainId) => {
  if (!trainId) return undefined;
  return isOccurrenceId(trainId) ? extractPacedTrainIdFromOccurrenceId(trainId) : trainId;
};

const useSelectedTimetableItem = (): TimetableItem | undefined => {
  const trainId = useSelector(getSelectedTrainId);

  const timetableItemId = extractTimetableItemId(trainId);

  const { currentData: timetableItem } = osrdEditoastApi.endpoints.getTimetableItemById.useQuery(
    timetableItemId
      ? {
          id: timetableItemId,
        }
      : skipToken
  );

  return timetableItem;
};

export default useSelectedTimetableItem;
