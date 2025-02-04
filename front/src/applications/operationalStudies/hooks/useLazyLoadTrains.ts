/* eslint-disable no-restricted-syntax, no-await-in-loop */
import { useEffect, useState, type Dispatch, type SetStateAction, useMemo } from 'react';

import { useSelector } from 'react-redux';

import { osrdEditoastApi, type SimulationSummaryResult } from 'common/api/osrdEditoastApi';
import { useOsrdConfSelectors } from 'common/osrdContext';
import type { TrainScheduleWithDetails } from 'modules/trainschedule/components/Timetable/types';
import type {
  TrainId,
  TrainScheduleId,
  TrainScheduleResultWithTrainId,
} from 'reducers/osrdconf/types';
import { getBatchPackage } from 'utils/batch';
import {
  formatEditoastTrainIdToTrainScheduleId,
  formatTrainScheduleIdToEditoastTrainId,
} from 'utils/trainId';
import { concatMap, mapBy } from 'utils/types';

import formatTrainScheduleSummaries from '../helpers/formatTrainScheduleSummaries';

const BATCH_SIZE = 10;

type UseLazyLoadTrainsProps = {
  infraId?: number;
  trainIdsToFetch?: TrainId[];
  trainSchedules?: TrainScheduleResultWithTrainId[];
  setTrainIdsToFetch?: Dispatch<SetStateAction<TrainId[] | undefined>>;
  setTrainIdsToProject?: Dispatch<SetStateAction<Set<TrainId>>>;
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
  trainSchedules,
  setTrainIdsToProject,
}: UseLazyLoadTrainsProps) => {
  const { getElectricalProfileSetId } = useOsrdConfSelectors();
  const electricalProfileSetId = useSelector(getElectricalProfileSetId);

  const [trainScheduleSummariesById, setTrainScheduleSummariesById] = useState<
    Map<TrainId, TrainScheduleWithDetails>
  >(new Map());
  const [allTrainsLoaded, setAllTrainsLoaded] = useState(false);

  const [postTrainScheduleSimulationSummary] =
    osrdEditoastApi.endpoints.postTrainScheduleSimulationSummary.useLazyQuery();

  const { data: { results: rollingStocks } = { results: null } } =
    osrdEditoastApi.endpoints.getLightRollingStock.useQuery({ pageSize: 1000 });

  const trainSchedulesById = useMemo(() => mapBy(trainSchedules, 'id'), [trainSchedules]);

  // gradually fetch the simulation of the trains
  useEffect(() => {
    const getTrainScheduleSummaries = async (_infraId: number, _trainToFetchIds: TrainId[]) => {
      setAllTrainsLoaded(false);

      for (let i = 0; i < _trainToFetchIds.length; i += BATCH_SIZE) {
        const packageToFetch = getBatchPackage(i, _trainToFetchIds, BATCH_SIZE);

        // Format train ids back to editoast format
        const editoastTrainIds = packageToFetch.map((trainId) =>
          formatTrainScheduleIdToEditoastTrainId(trainId as TrainScheduleId)
        );

        const rawSummaries = await postTrainScheduleSimulationSummary({
          body: {
            infra_id: _infraId,
            ids: editoastTrainIds,
            electrical_profile_set_id: electricalProfileSetId,
          },
        }).unwrap();

        // TODO Paced train : Adapt this for the add paced train issue : https://github.com/OpenRailAssociation/osrd/issues/10615
        const formattedRawSummaries: { [key: TrainScheduleId]: SimulationSummaryResult } = {};
        for (const [editoastTrainId, trainSummary] of Object.entries(rawSummaries)) {
          const trainId = formatEditoastTrainIdToTrainScheduleId(Number(editoastTrainId));
          formattedRawSummaries[trainId] = trainSummary;
        }

        // the two rtk-query calls postTrainSchedule & postTrainScheduleSimulationSummary
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
          // format the summaries to display them in the timetable
          const newFormattedSummaries = formatTrainScheduleSummaries(
            packageToFetch,
            formattedRawSummaries,
            trainSchedulesById,
            rollingStocks!
          );

          // launch the projection of the trains if needed
          setTrainIdsToProject?.((prev) => new Set([...prev, ...packageToFetch]));

          // as formattedSummaries is a dictionary, we replace the previous values with the new ones
          setTrainScheduleSummariesById((prev) => concatMap(prev, newFormattedSummaries));
        }
      }

      setAllTrainsLoaded(true);
    };

    if (infraId && trainIdsToFetch && rollingStocks && trainIdsToFetch.length > 0) {
      getTrainScheduleSummaries(infraId, trainIdsToFetch);
    }
  }, [infraId, trainIdsToFetch, rollingStocks]);

  return {
    trainScheduleSummariesById,
    setTrainScheduleSummariesById,
    allTrainsLoaded,
  };
};

export default useLazyLoadTrains;
