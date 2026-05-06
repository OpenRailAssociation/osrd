import { useMemo, useState, useCallback, useEffect } from 'react';

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
  getSearchDatetimeWindow,
  getStdcmInfraID,
  getStdcmTimetableID,
} from 'reducers/osrdconf/stdcmConf/selectors';
import { useAppDispatch } from 'store';
import { isArrivalDateInSearchTimeWindow, isEqualDate } from 'utils/date';
import { Duration } from 'utils/duration';
import { castErrorToFailure } from 'utils/error';

import type { StdcmLinkedTrainExtremity, StdcmLinkedTrainResult } from '../types';
import computeOpSchedules from '../utils/computeOpSchedules';

const toLinkedTrainExtremity = (
  op: SearchResultItemOperationalPoint,
  schedule: { date: string; time: string; arrivalDate: Date }
): StdcmLinkedTrainExtremity => {
  if (!op.uic) throw new Error(`Operational point ${op.obj_id} has no UIC`);
  if (!op.secondary_code) throw new Error(`Operational point ${op.obj_id} has no secondary code`);
  return { ...op, uic: op.uic, secondary_code: op.secondary_code, ...schedule };
};

const useLinkedTrainSearch = () => {
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
              ['=', ['secondary_code'], pathItem.location.operational_point.secondary_code],
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

  const launchTrainScheduleSearch = useCallback(async () => {
    setLinkedTrainResults(undefined);
    if (!trainNameInput) return;
    setDisplaySearchButton(false);
    setLinkedTrainResults([]);

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
          query: ['and', ['search', ['train_name'], trainNameInput], ['or', ...tssPayload]],
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
            origin: toLinkedTrainExtremity(originDetails, computedOpSchedules.origin),
            destination: toLinkedTrainExtremity(
              destinationDetails,
              computedOpSchedules.destination
            ),
          };
        })
      );
      setLinkedTrainResults(compact(newLinkedPathResults));
    } catch (error) {
      dispatch(setFailure(castErrorToFailure(error)));
      setDisplaySearchButton(true);
    }
  }, [
    postSearch,
    trainNameInput,
    timetableId,
    getTrainScheduleSets,
    linkedTrainDate,
    getExtremityDetails,
  ]);

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
