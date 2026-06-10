import { useState, useCallback, useMemo } from 'react';

import { compact } from 'lodash';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import type {
  PathItem,
  SearchQuery,
  SearchResultItemOperationalPoint,
  SearchResultItemTrainSchedule,
} from 'common/api/osrdEditoastApi';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { setFailure } from 'reducers/main';
import {
  updateLinkedTrainSearchTerm,
  updateLinkedTrainSearchDate,
  updateLinkedTrainSearchResults,
  selectLinkedTrainSearchResult,
  resetLinkedTrainSearch,
} from 'reducers/osrdconf/stdcmConf';
import {
  getLinkedTrainsSearchState,
  getSearchDatetimeWindow,
  getStdcmInfraID,
  getStdcmTimetableID,
} from 'reducers/osrdconf/stdcmConf/selectors';
import { useAppDispatch } from 'store';
import { isEqualDate } from 'utils/date';
import { Duration } from 'utils/duration';
import { castErrorToFailure } from 'utils/error';

import type { LinkedTrainType } from '../types';
import computeOpSchedules from '../utils/computeOpSchedules';

const useLinkedTrainSearch = (linkedTrainType: LinkedTrainType) => {
  const { t } = useTranslation('stdcm', { keyPrefix: 'trainPath.linkedTrain' });
  const dispatch = useAppDispatch();

  const [postSearch] = osrdEditoastApi.endpoints.postSearch.useLazyQuery();
  const [postTrainSchedulesSimulationSummary] =
    osrdEditoastApi.endpoints.postTrainSchedulesSimulationSummary.useLazyQuery();
  const [getTrainScheduleSets] =
    osrdEditoastApi.endpoints.getTimetableByIdTrainScheduleSets.useLazyQuery();

  const infraId = useSelector(getStdcmInfraID);
  const timetableId = useSelector(getStdcmTimetableID);
  const searchDatetimeWindow = useSelector(getSearchDatetimeWindow);

  const selectableDateSlot = useMemo(() => {
    const startDate = new Date(searchDatetimeWindow.begin); // TOCHECK: why do we need this for start, but not end?
    return {
      start: startDate,
      end: searchDatetimeWindow.end,
    };
  }, [searchDatetimeWindow]);

  const [loading, setLoading] = useState(false);
  const {
    searchTerm,
    date: searchDate,
    selectedIndex: selectedLinkedTrainIndex,
    results: searchedLinkedTrains,
  } = useSelector(getLinkedTrainsSearchState)[linkedTrainType];

  const setSearchTerm = (term: string) =>
    dispatch(updateLinkedTrainSearchTerm({ linkedTrainType, searchTerm: term }));
  const setSearchDate = (date: Date) =>
    dispatch(updateLinkedTrainSearchDate({ linkedTrainType, date }));
  const resetSearch = () => dispatch(resetLinkedTrainSearch({ linkedTrainType }));
  const selectLinkedTrain = (selectedIndex: number) =>
    dispatch(selectLinkedTrainSearchResult({ linkedTrainType, selectedIndex }));

  const getExtremityDetails = useCallback(
    async (pathItem: PathItem) => {
      if (
        pathItem.location.type === 'track_offset' ||
        (pathItem.location.operational_point.type !== 'id' &&
          pathItem.location.operational_point.type !== 'uic')
      )
        return undefined;

      const pathItemQuery =
        pathItem.location.operational_point.type === 'id'
          ? ['=', ['obj_id'], pathItem.location.operational_point.operational_point]
          : ([
              'and',
              ['=', ['uic'], pathItem.location.operational_point.uic],
              ['=', ['ch'], pathItem.location.operational_point.secondary_code],
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
      const trainsSummaries = await postTrainSchedulesSimulationSummary({
        body: {
          infra_id: infraId,
          timetable_id: timetableId,
          ids: trainsIds,
        },
      }).unwrap();
      return trainsSummaries;
    },
    [postTrainSchedulesSimulationSummary, infraId]
  );

  const launchSearch = useCallback(async () => {
    dispatch(updateLinkedTrainSearchResults({ linkedTrainType, results: [] }));
    if (!searchTerm || !searchDate) return;
    setLoading(true);

    try {
      // Fetch the train schedule sets linked to the timetable to search among them
      const trainScheduleSets = await getTrainScheduleSets({ id: timetableId }).unwrap();
      if (trainScheduleSets.length === 0) {
        // should not happen
        dispatch(setFailure({ name: t('error'), message: t('noTrainScheduleSetFound') }));
        return;
      }
      const tssPayload = trainScheduleSets.map((tss) => ['=', ['train_schedule_set_id'], tss.id]);

      const results = (await postSearch({
        searchPayload: {
          object: 'trainschedule',
          query: ['and', ['search', ['train_name'], searchTerm], ['or', ...tssPayload]],
        },
        pageSize: 25,
      }).unwrap()) as SearchResultItemTrainSchedule[];
      const filteredResults = results.filter((result) =>
        isEqualDate(searchDate, new Date(result.start_time))
      );

      if (!filteredResults.length) {
        dispatch(updateLinkedTrainSearchResults({ linkedTrainType, results: [] }));
        return;
      }

      const filteredResultsSummaries = await getTrainsSummaries(filteredResults.map((r) => r.id));

      const newLinkedPathResults = await Promise.all(
        filteredResults.map(async (result) => {
          if (!filteredResultsSummaries) return undefined;
          const resultSummary = filteredResultsSummaries[result.id].train_schedule;
          if (resultSummary.status !== 'success') return undefined;
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
      dispatch(
        updateLinkedTrainSearchResults({ linkedTrainType, results: compact(newLinkedPathResults) })
      );
    } catch (error) {
      dispatch(setFailure(castErrorToFailure(error)));
    } finally {
      setLoading(false);
    }
  }, [postSearch, searchTerm, timetableId, getTrainScheduleSets, searchDate, getExtremityDetails]);

  return {
    loading,
    // TODECIDE: Should we bother exposing pass through values + setters, with the hook acting as a single store entrypoint for the component,
    // or should we instead use the store selectors and reducers directly in the component instead?
    // Or perhaps should we move launchSearch in the store as a reducer too? -> currently we don't tend to put rtkqueries in the store, so I think not
    searchTerm,
    setSearchTerm,
    selectableDateSlot,
    searchDate,
    setSearchDate,
    searchedLinkedTrains,
    launchSearch,
    selectedLinkedTrainIndex,
    selectLinkedTrain,
    resetSearch,
  };
};

export default useLinkedTrainSearch;
