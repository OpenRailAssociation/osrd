import { useMemo } from 'react';

import dayjs from 'dayjs';
import { useSelector } from 'react-redux';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import type { Train } from 'reducers/osrdconf/types';
import { getSelectedTrainId } from 'reducers/simulationResults/selectors';
import { Duration } from 'utils/duration';
import {
  extractOccurrenceIndexFromOccurrenceId,
  extractPacedTrainIdFromOccurrenceId,
  isOccurrenceId,
  isPacedTrainResponseWithPacedTrainId,
  isTrainScheduleId,
} from 'utils/trainId';

const useSelectedTrain = (): Train | undefined => {
  const trainId = useSelector(getSelectedTrainId);

  const timetableItemId = useMemo(() => {
    if (!trainId) return undefined;
    return isOccurrenceId(trainId) ? extractPacedTrainIdFromOccurrenceId(trainId) : trainId;
  }, [trainId]);

  const { data: timetableItem } = osrdEditoastApi.endpoints.getTimetableItemById.useQuery(
    {
      id: timetableItemId!,
    },
    { skip: !timetableItemId }
  );

  return useMemo(() => {
    if (!trainId || !timetableItem) return undefined;
    if (isTrainScheduleId(trainId)) {
      if (isPacedTrainResponseWithPacedTrainId(timetableItem) || trainId !== timetableItem.id)
        return undefined;
      return timetableItem;
    }

    if (
      !isPacedTrainResponseWithPacedTrainId(timetableItem) ||
      extractPacedTrainIdFromOccurrenceId(trainId) !== timetableItem.id
    )
      return undefined;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, exceptions, paced, ...trainProps } = timetableItem;

    const occurrenceIndex = extractOccurrenceIndexFromOccurrenceId(trainId);
    const pacedTrainIntervalInMs = Duration.parse(timetableItem.paced.interval).ms;

    const occurrenceStartTime: string = dayjs(timetableItem.start_time)
      .add(occurrenceIndex * pacedTrainIntervalInMs, 'ms')
      .toISOString();
    return { ...trainProps, id: trainId, start_time: occurrenceStartTime };
  }, [trainId, timetableItem]);
};

export default useSelectedTrain;
