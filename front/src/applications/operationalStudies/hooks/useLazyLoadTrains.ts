/* eslint-disable no-restricted-syntax, no-await-in-loop */
import { useEffect, useState, type Dispatch, type SetStateAction, useMemo } from 'react';

import { useSelector } from 'react-redux';

import {
  osrdEditoastApi,
  type PathfindingResultSuccess,
  type TrainScheduleResult,
} from 'common/api/osrdEditoastApi';
import { useOsrdConfSelectors } from 'common/osrdContext';
import useLazyProjectTrains from 'modules/simulationResult/components/SpaceTimeChart/useLazyProjectTrains';
import type { TrainScheduleWithDetails } from 'modules/trainschedule/components/TimetableV2/types';
import { getBatchPackage } from 'utils/batch';
import { concatMap, mapBy } from 'utils/types';

import formatTrainScheduleSummaries from '../helpers/formatTrainScheduleSummaries';

const BATCH_SIZE = 10;

type UseLazyLoadTrainsProps = {
  infraId?: number;
  trainIdsToFetch?: number[];
  path?: PathfindingResultSuccess;
  trainSchedules?: TrainScheduleResult[];
  setTrainIdsToFetch: Dispatch<SetStateAction<number[] | undefined>>;
};

/**
 * This hook gradually fetches and projects trains of the timetable.
 *
 * It first fetches the simulation of 10 trains at a time, then projects them on the path.
 * This optimizes the performance of the application and allow us to display the trains as
 * soon as they are ready.
 */
const useLazyLoadTrains = ({
  infraId,
  trainIdsToFetch,
  path,
  trainSchedules,
  setTrainIdsToFetch,
}: UseLazyLoadTrainsProps) => {
  const { getElectricalProfileSetId } = useOsrdConfSelectors();
  const electricalProfileSetId = useSelector(getElectricalProfileSetId);

  const [trainScheduleSummariesById, setTrainScheduleSummariesById] = useState<
    Map<number, TrainScheduleWithDetails>
  >(new Map());
  const [trainIdsToProject, setTrainIdsToProject] = useState<number[]>([]);
  const [allTrainsLoaded, setAllTrainsLoaded] = useState(false);

  const [postV2TrainScheduleSimulationSummary] =
    osrdEditoastApi.endpoints.postV2TrainScheduleSimulationSummary.useLazyQuery();

  const { data: { results: rollingStocks } = { results: [] } } =
    osrdEditoastApi.endpoints.getLightRollingStock.useQuery({ pageSize: 1000 });

  const trainSchedulesById = useMemo(() => mapBy(trainSchedules, 'id'), [trainSchedules]);

  const { projectedTrainsById, setProjectedTrainsById } = useLazyProjectTrains({
    infraId,
    trainIdsToProject,
    path,
    trainSchedules,
    moreTrainsToCome: !allTrainsLoaded,
    setTrainIdsToProject,
  });

  // gradually fetch the simulation of the trains
  useEffect(() => {
    const getTrainScheduleSummaries = async (_infraId: number, _trainToFetchIds: number[]) => {
      setAllTrainsLoaded(false);

      for (let i = 0; i < _trainToFetchIds.length; i += BATCH_SIZE) {
        const packageToFetch = getBatchPackage(i, _trainToFetchIds, BATCH_SIZE);

        const rawSummaries = await postV2TrainScheduleSimulationSummary({
          body: {
            infra_id: _infraId,
            ids: packageToFetch,
            electrical_profile_set_id: electricalProfileSetId,
          },
        }).unwrap();

        // the two rtk-query calls postV2TrainSchedule & postV2TrainScheduleSimulationSummary
        // do not happen during the same react cycle.
        // if we update a train, one is going to re-fetch first and the 2 are out of sync during a few cycles.
        // these cycles do not make sense to render.
        const outOfSync = [...trainSchedulesById.values()].some((trainShedule) => {
          const summary = rawSummaries[trainShedule.id];
          if (summary?.status === 'success') {
            return trainShedule.path.length !== summary.path_item_times_final.length;
          }
          return false;
        });

        if (!outOfSync) {
          // launch the projection of the trains
          setTrainIdsToProject((prev) => [...prev, ...packageToFetch]);

          // format the summaries to display them in the timetable
          const newFormattedSummaries = formatTrainScheduleSummaries(
            packageToFetch,
            rawSummaries,
            trainSchedulesById,
            rollingStocks
          );

          // as formattedSummaries is a dictionary, we replace the previous values with the new ones
          setTrainScheduleSummariesById((prev) => concatMap(prev, newFormattedSummaries));
        }
      }

      setTrainIdsToFetch([]);
      setAllTrainsLoaded(true);
    };

    if (infraId && trainIdsToFetch && trainIdsToFetch.length > 0) {
      getTrainScheduleSummaries(infraId, trainIdsToFetch);
    }
  }, [infraId, trainIdsToFetch]);

  return {
    trainScheduleSummariesById,
    projectedTrainsById,
    setTrainScheduleSummariesById,
    setProjectedTrainsById,
  };
};

export default useLazyLoadTrains;
