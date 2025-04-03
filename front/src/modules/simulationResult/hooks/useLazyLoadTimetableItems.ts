/* eslint-disable no-restricted-syntax, no-await-in-loop */
import { useEffect, useState, type Dispatch, type SetStateAction, useMemo } from 'react';

import {
  osrdEditoastApi,
  type PostPacedTrainSimulationSummaryApiResponse,
  type PostTrainScheduleSimulationSummaryApiResponse,
  type SimulationSummaryResult,
} from 'common/api/osrdEditoastApi';
import type { TimetableItemWithDetails } from 'modules/trainschedule/components/Timetable/types';
import type { TimetableItemId, TimetableItemWithTimetableId } from 'reducers/osrdconf/types';
import { getBatchPackage } from 'utils/batch';
import {
  formatEditoastTrainIdToPacedTrainId,
  formatEditoastTrainIdToTrainScheduleId,
  formatPacedTrainIdToEditoastTrainId,
  formatTrainScheduleIdToEditoastTrainId,
  isTrainSchedule,
} from 'utils/trainId';
import { concatMap, mapBy } from 'utils/types';

import formatTimetableItemSummaries from '../helpers/formatTimetableItemSummaries';

const BATCH_SIZE = 10;

type useLazyLoadTimetableItemsParams = {
  infraId?: number;
  electricalProfileSetId?: number;
  timetableItemIdsToFetch?: TimetableItemId[];
  timetableItems?: TimetableItemWithTimetableId[];
  setTimetableItemIdsToProject?: Dispatch<SetStateAction<Set<TimetableItemId>>>;
};

/**
 * This hook gradually fetches and projects items of the timetable.
 *
 * It first fetches the simulation of 10 items at a time, then projects them on the path.
 * This optimizes the performance of the application and allows us to display the items as
 * soon as they are ready.
 */
const useLazyLoadTimetableItems = ({
  infraId,
  electricalProfileSetId,
  timetableItemIdsToFetch,
  timetableItems,
  setTimetableItemIdsToProject,
}: useLazyLoadTimetableItemsParams) => {
  const [timetableItemSummariesById, setTimetableItemSummariesById] = useState<
    Map<TimetableItemId, TimetableItemWithDetails>
  >(new Map());
  const [allTimetableItemsLoaded, setAllTimetableItemsLoaded] = useState(false);

  const [postTrainScheduleSimulationSummary] =
    osrdEditoastApi.endpoints.postTrainScheduleSimulationSummary.useLazyQuery();

  const [postPacedTrainSimulationSummary] =
    osrdEditoastApi.endpoints.postPacedTrainSimulationSummary.useLazyQuery();

  const { data: { results: rollingStocks } = { results: null } } =
    osrdEditoastApi.endpoints.getLightRollingStock.useQuery({ pageSize: 1000 });

  const timetableItemsById = useMemo(() => mapBy(timetableItems, 'id'), [timetableItems]);

  // gradually fetch the simulation of the timetable items
  useEffect(() => {
    const getTimetableItemSummaries = async (
      _infraId: number,
      _timetableItemIdsToFetch: TimetableItemId[]
    ) => {
      setAllTimetableItemsLoaded(false);

      for (let i = 0; i < _timetableItemIdsToFetch.length; i += BATCH_SIZE) {
        const packageToFetch = getBatchPackage(i, _timetableItemIdsToFetch, BATCH_SIZE);

        // Format timetable item ids back to editoast format
        const { editoastTrainScheduleIds, editoastPacedTrainIds } = packageToFetch.reduce<{
          editoastTrainScheduleIds: number[];
          editoastPacedTrainIds: number[];
        }>(
          (acc, id) => {
            if (isTrainSchedule(id)) {
              acc.editoastTrainScheduleIds.push(formatTrainScheduleIdToEditoastTrainId(id));
            } else {
              acc.editoastPacedTrainIds.push(formatPacedTrainIdToEditoastTrainId(id));
            }
            return acc;
          },
          { editoastTrainScheduleIds: [], editoastPacedTrainIds: [] }
        );

        const trainScheduleSummariesPromise: Promise<PostTrainScheduleSimulationSummaryApiResponse> =
          editoastTrainScheduleIds.length > 0
            ? postTrainScheduleSimulationSummary({
                body: {
                  infra_id: _infraId,
                  ids: editoastTrainScheduleIds,
                  electrical_profile_set_id: electricalProfileSetId,
                },
              }).unwrap()
            : Promise.resolve({});

        const pacedTrainSummariesPromise: Promise<PostPacedTrainSimulationSummaryApiResponse> =
          editoastPacedTrainIds.length > 0
            ? postPacedTrainSimulationSummary({
                body: {
                  infra_id: _infraId,
                  ids: editoastPacedTrainIds,
                  electrical_profile_set_id: electricalProfileSetId,
                },
              }).unwrap()
            : Promise.resolve({});

        const rawTrainScheduleSummaries = await trainScheduleSummariesPromise;
        const rawPacedTrainSummaries = await pacedTrainSummariesPromise;

        const formattedRawSummaries: Map<TimetableItemId, SimulationSummaryResult> = new Map();
        for (const [editoastTrainScheduleId, trainScheduleSummary] of Object.entries(
          rawTrainScheduleSummaries
        )) {
          const trainId = formatEditoastTrainIdToTrainScheduleId(Number(editoastTrainScheduleId));
          formattedRawSummaries.set(trainId, trainScheduleSummary);
        }

        for (const [editoastPacedTrainId, pacedTrainSummary] of Object.entries(
          rawPacedTrainSummaries
        )) {
          const trainId = formatEditoastTrainIdToPacedTrainId(Number(editoastPacedTrainId));
          formattedRawSummaries.set(trainId, pacedTrainSummary);
        }

        // the two rtk-query calls postTrainSchedule/postPacedTrain &
        // postTrainScheduleSimulationSummary/postPacedTrainSimulationSummary
        // do not happen during the same react cycle.
        // if we update a train, one is going to re-fetch first and the 2 are out of sync during a few cycles.
        // these cycles do not make sense to render.
        const outOfSync = [...timetableItemsById.values()].some((timetableItem) => {
          const summary = formattedRawSummaries.get(timetableItem.id);
          if (summary?.status === 'success') {
            return timetableItem.path.length !== summary.path_item_times_final.length;
          }
          return false;
        });

        if (!outOfSync) {
          // format the summaries to display them in the timetable
          const newFormattedSummaries = formatTimetableItemSummaries(
            packageToFetch,
            formattedRawSummaries,
            timetableItemsById,
            rollingStocks!
          );

          // TODO Paced trains : remove this filter when paced trains are handled in projection
          const filteredPackageToFetch = packageToFetch.filter((timetableItemId) =>
            isTrainSchedule(timetableItemId)
          );

          // launch the projection of the trains if needed
          setTimetableItemIdsToProject?.((prev) => new Set([...prev, ...filteredPackageToFetch]));

          // as formattedSummaries is a dictionary, we replace the previous values with the new ones
          setTimetableItemSummariesById((prev) => concatMap(prev, newFormattedSummaries));
        }
      }

      setAllTimetableItemsLoaded(true);
    };

    if (infraId && timetableItemIdsToFetch && rollingStocks && timetableItemIdsToFetch.length > 0) {
      getTimetableItemSummaries(infraId, timetableItemIdsToFetch);
    }
  }, [infraId, timetableItemIdsToFetch, rollingStocks]);

  return {
    timetableItemSummariesById,
    setTimetableItemSummariesById,
    allTimetableItemsLoaded,
  };
};

export default useLazyLoadTimetableItems;
