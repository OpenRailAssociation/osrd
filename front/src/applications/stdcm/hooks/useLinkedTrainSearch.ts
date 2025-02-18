import { useMemo, useState, useCallback, useEffect } from 'react';

import { compact } from 'lodash';
import { useSelector } from 'react-redux';

import type {
  PathItem,
  SearchQuery,
  SearchResultItemOperationalPoint,
  SearchResultItemTrainSchedule,
} from 'common/api/osrdEditoastApi';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import {
  getSearchDatetimeWindow,
  getStdcmInfraID,
  getStdcmTimetableID,
} from 'reducers/osrdconf/stdcmConf/selectors';
import { isArrivalDateInSearchTimeWindow, isEqualDate } from 'utils/date';
import { Duration } from 'utils/duration';

import type { StdcmLinkedTrainResult } from '../types';
import computeOpSchedules from '../utils/computeOpSchedules';

const useLinkedTrainSearch = () => {
  const [postSearch] = osrdEditoastApi.endpoints.postSearch.useMutation();
  const [postTrainScheduleSimulationSummary] =
    osrdEditoastApi.endpoints.postTrainScheduleSimulationSummary.useLazyQuery();

  const infraId = useSelector(getStdcmInfraID);
  const timetableId = useSelector(getStdcmTimetableID);
  const searchDatetimeWindow = useSelector(getSearchDatetimeWindow);

  const selectableSlot = useMemo(() => {
    const startDate = new Date(searchDatetimeWindow.begin);
    return {
      start: startDate,
      end: searchDatetimeWindow.end,
    };
  }, [searchDatetimeWindow]);

  const [displaySearchButton, setDisplaySearchButton] = useState(true);
  const [trainNameInput, setTrainNameInput] = useState('');
  const [linkedTrainDate, setLinkedTrainDate] = useState(selectableSlot.start);
  const [linkedTrainResults, setLinkedTrainResults] = useState<StdcmLinkedTrainResult[]>();

  const getExtremityDetails = useCallback(
    async (pathItem: PathItem) => {
      if (!('operational_point' in pathItem) && !('uic' in pathItem)) return undefined;

      const pathItemQuery =
        'operational_point' in pathItem
          ? ['=', ['obj_id'], pathItem.operational_point]
          : ([
              'and',
              ['=', ['uic'], pathItem.uic],
              ['=', ['ch'], pathItem.secondary_code],
            ] as SearchQuery);

      try {
        const payloadOP = {
          object: 'operationalpoint',
          query: pathItemQuery,
        };
        const opDetails = (await postSearch({
          searchPayload: payloadOP,
          pageSize: 25,
        }).unwrap()) as SearchResultItemOperationalPoint[];
        return opDetails[0];
      } catch (error) {
        console.error('Failed to fetch operational point:', error);
        return undefined;
      }
    },
    [postSearch]
  );

  const getTrainsSummaries = useCallback(
    async (trainsIds: number[]) => {
      const trainsSummaries = await postTrainScheduleSimulationSummary({
        body: {
          infra_id: infraId,
          ids: trainsIds,
        },
      }).unwrap();
      return trainsSummaries;
    },
    [postTrainScheduleSimulationSummary, infraId]
  );

  const launchTrainScheduleSearch = useCallback(async () => {
    setLinkedTrainResults(undefined);
    if (!trainNameInput) return;
    setDisplaySearchButton(false);
    setLinkedTrainResults([]);
    try {
      const results = (await postSearch({
        searchPayload: {
          object: 'trainschedule',
          query: [
            'and',
            ['search', ['train_name'], trainNameInput],
            ['=', ['timetable_id'], timetableId],
          ],
        },
        pageSize: 25,
      }).unwrap()) as SearchResultItemTrainSchedule[];
      const filteredResults = results.filter((result) =>
        isEqualDate(linkedTrainDate, new Date(result.start_time))
      );

      if (!filteredResults.length) {
        setDisplaySearchButton(true);
        setLinkedTrainResults([]);
        return;
      }

      const filteredResultsSummaries = await getTrainsSummaries(filteredResults.map((r) => r.id));

      const newLinkedPathResults = await Promise.all(
        filteredResults.map(async (result) => {
          const resultSummary = filteredResultsSummaries && filteredResultsSummaries[result.id];
          if (!resultSummary || resultSummary.status !== 'success') return undefined;
          const durationFromStartTime = new Duration({
            milliseconds: resultSummary.path_item_times_final.at(-1)!,
          });

          const originDetails = await getExtremityDetails(result.path.at(0)!);
          const destinationDetails = await getExtremityDetails(result.path.at(-1)!);
          const computedOpSchedules = computeOpSchedules(
            new Date(result.start_time),
            durationFromStartTime
          );

          if (!originDetails || !destinationDetails) return undefined;
          return {
            trainName: result.train_name,
            origin: { ...originDetails, ...computedOpSchedules.origin },
            destination: {
              ...destinationDetails,
              ...computedOpSchedules.destination,
            },
          };
        })
      );
      setLinkedTrainResults(compact(newLinkedPathResults));
    } catch (error) {
      console.error('Train schedule search failed:', error);
      setDisplaySearchButton(true);
    }
  }, [postSearch, trainNameInput, timetableId, linkedTrainDate, getExtremityDetails]);

  const resetLinkedTrainSearch = () => {
    setDisplaySearchButton(true);
    setLinkedTrainResults(undefined);
    setTrainNameInput('');
  };

  useEffect(() => {
    if (!isArrivalDateInSearchTimeWindow(linkedTrainDate, searchDatetimeWindow)) {
      setLinkedTrainDate(selectableSlot.start);
      resetLinkedTrainSearch();
    }
  }, [selectableSlot]);

  return {
    displaySearchButton,
    launchTrainScheduleSearch,
    linkedTrainDate,
    linkedTrainResults,
    resetLinkedTrainSearch,
    selectableSlot,
    setDisplaySearchButton,
    setLinkedTrainDate,
    setTrainNameInput,
    trainNameInput,
  };
};

export default useLinkedTrainSearch;
