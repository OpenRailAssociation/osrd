import { useEffect, useMemo } from 'react';

import { skipToken } from '@reduxjs/toolkit/query';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { useInfraID } from 'common/osrdContext';
import type { TrainScheduleWithDetails } from 'modules/trainSchedule/types';
import { setFailure } from 'reducers/main';
import { useAppDispatch } from 'store';
import { startTimeToDate } from 'utils/duration';
import { castErrorToFailure } from 'utils/error';

import { formatLevelCrossingOccupanciesForChronogram } from './buildOccupancyBlocks';

type UseLevelCrossingsWithChronogramProps = {
  trains: TrainScheduleWithDetails[];
};

const useLevelCrossingsWithChronogram = (
  timetableId: number,
  { trains }: UseLevelCrossingsWithChronogramProps
) => {
  const infraId = useInfraID();
  const dispatch = useAppDispatch();

  // TODO Hourly timetables: use the actual start time instead of a fictive date
  const timeOrigin = useMemo(() => startTimeToDate(trains[0].startTime).getTime(), [trains]);

  const trainIds = useMemo(() => trains.map((train) => train.id), [trains]);

  const trainNameById = useMemo(
    () => new Map(trains.map((train) => [train.id, train.name])),
    [trains]
  );

  const { currentData: levelCrossingsIds } =
    osrdEditoastApi.endpoints.getInfraByInfraIdObjectsAndObjectTypeIds.useQuery(
      infraId
        ? {
            infraId,
            objectType: 'LevelCrossing',
          }
        : skipToken
    );

  const { currentData: levelCrossings } =
    osrdEditoastApi.endpoints.postInfraByInfraIdObjectsAndObjectType.useQuery(
      infraId && levelCrossingsIds && levelCrossingsIds.ids.length
        ? {
            infraId,
            objectType: 'LevelCrossing',
            body: levelCrossingsIds.ids,
          }
        : skipToken
    );

  const { data: levelCrossingOccupancies, error } =
    osrdEditoastApi.endpoints.postLevelCrossingOccupancy.useQuery(
      infraId && trainIds.length && levelCrossingsIds && levelCrossingsIds.ids.length
        ? {
            body: {
              infra_id: infraId,
              train_ids: trainIds,
              timetable_id: timetableId,
              level_crossing_ids: levelCrossingsIds.ids,
            },
          }
        : skipToken
    );

  const levelCrossingData = useMemo(() => {
    if (!levelCrossingOccupancies || !levelCrossings) return [];
    return formatLevelCrossingOccupanciesForChronogram(
      levelCrossingOccupancies,
      levelCrossings,
      trainNameById
    );
  }, [levelCrossingOccupancies, levelCrossings, trainNameById]);

  useEffect(() => {
    if (error) {
      dispatch(setFailure(castErrorToFailure(error)));
    }
  }, [error, dispatch]);

  return { levelCrossingData, timeOrigin };
};

export default useLevelCrossingsWithChronogram;
