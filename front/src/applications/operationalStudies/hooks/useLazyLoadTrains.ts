/* eslint-disable no-restricted-syntax, no-await-in-loop */
import { useState } from 'react';

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
  path?: PathfindingResultSuccess;
  trainSchedules?: TrainScheduleResult[];
};

/**
 * This hook gradually fetches and projects trains of the timetable.
 *
 * It first fetches the simulation of 10 trains at a time, then projects them on the path.
 * This optimizes the performance of the application and allow us to display the trains as
 * soon as they are ready.
 */
const useLazyLoadTrains = ({ infraId, path, trainSchedules }: UseLazyLoadTrainsProps) => {
  const { getElectricalProfileSetId } = useOsrdConfSelectors();
  const electricalProfileSetId = useSelector(getElectricalProfileSetId);

  const [trainScheduleSummariesById, setTrainScheduleSummariesById] = useState<
    Map<number, TrainScheduleWithDetails>
  >(new Map());
  const [allTrainsLoaded, setAllTrainsLoaded] = useState(false);

  const [postTrainScheduleSimulationSummary] =
    osrdEditoastApi.endpoints.postTrainScheduleSimulationSummary.useLazyQuery();

  const { data: { results: rollingStocks } = { results: [] } } =
    osrdEditoastApi.endpoints.getLightRollingStock.useQuery({ pageSize: 1000 });

  const { projectedTrainsById, setProjectedTrainsById, projectTrains } = useLazyProjectTrains({
    infraId,
    path,
    trainSchedules,
    moreTrainsToCome: !allTrainsLoaded,
  });

  const loadTrains = async (_trainSchedules: TrainScheduleResult[]) => {
    if (!infraId) {
      return;
    }

    const trainIds = _trainSchedules.map((trainSchedule) => trainSchedule.id);

    setAllTrainsLoaded(false);

    for (let i = 0; i < trainIds.length; i += BATCH_SIZE) {
      const packageToFetch = getBatchPackage(i, trainIds, BATCH_SIZE);

      const rawSummaries = await postTrainScheduleSimulationSummary({
        body: {
          infra_id: infraId,
          ids: packageToFetch,
          electrical_profile_set_id: electricalProfileSetId,
        },
      }).unwrap();

      // launch the projection of the trains
      projectTrains(packageToFetch);

      // format the summaries to display them in the timetable
      const newFormattedSummaries = formatTrainScheduleSummaries(
        packageToFetch,
        rawSummaries,
        mapBy(_trainSchedules, 'id'),
        rollingStocks
      );

      // as formattedSummaries is a dictionary, we replace the previous values with the new ones
      setTrainScheduleSummariesById((prev) => concatMap(prev, newFormattedSummaries));
    }

    setAllTrainsLoaded(true);
  };

  return {
    trainScheduleSummariesById,
    projectedTrainsById,
    setTrainScheduleSummariesById,
    setProjectedTrainsById,
    loadTrains,
  };
};

export default useLazyLoadTrains;
