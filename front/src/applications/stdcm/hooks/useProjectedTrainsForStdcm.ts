import { useEffect, useMemo, useState } from 'react';

import { useSelector } from 'react-redux';

import useLazyLoadTrains from 'applications/operationalStudies/hooks/useLazyLoadTrains';
import type { TrainSpaceTimeData } from 'applications/operationalStudies/types';
import type { StdcmSuccessResponse } from 'applications/stdcm/types';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { useInfraID, useOsrdConfSelectors } from 'common/osrdContext';
import useLazyProjectTrains from 'modules/simulationResult/components/SpaceTimeChart/useLazyProjectTrains';
import type { TrainScheduleWithDetails } from 'modules/trainschedule/components/Timetable/types';
import { addDurationToDate, subtractDurationFromDate } from 'utils/date';

import formatStdcmTrainIntoSpaceTimeData from '../utils/formatStdcmIntoSpaceTimeData';

/**
 * Project only the trains which leave 1 hour max before the departure of the stdcm or
 * arrive 1 hour max after the arrival of the stdcm
 */
const keepTrainsRunningDuringStdcm = (
  stdcmResult: StdcmSuccessResponse,
  trainSchedules: Map<number, TrainScheduleWithDetails>
) => {
  const relevantTrainScheduleIds = new Set<number>();

  const stdcmDepartureTime = new Date(stdcmResult.departure_time);
  const stdcmArrivalTime = addDurationToDate(
    new Date(stdcmResult.departure_time),
    stdcmResult.simulation.final_output.times.at(-1)!,
    'millisecond'
  );

  for (const trainSchedule of trainSchedules.values()) {
    if (trainSchedule.invalidReason || trainSchedule.pathItemTimes === undefined) {
      continue;
    }
    const departureTime = trainSchedule.startTime;
    const arrivalTime = addDurationToDate(
      trainSchedule.startTime,
      trainSchedule.pathItemTimes.final.at(-1)!,
      'millisecond'
    );

    if (
      arrivalTime < subtractDurationFromDate(stdcmDepartureTime, 1, 'hour') ||
      departureTime > addDurationToDate(stdcmArrivalTime, 1, 'hour')
    ) {
      continue;
    }

    relevantTrainScheduleIds.add(trainSchedule.id);
  }

  return relevantTrainScheduleIds;
};

const useProjectedTrainsForStdcm = (stdcmResponse?: StdcmSuccessResponse) => {
  const infraId = useInfraID();
  const { getTimetableID } = useOsrdConfSelectors();
  const timetableId = useSelector(getTimetableID);

  const [spaceTimeData, setSpaceTimeData] = useState<TrainSpaceTimeData[]>([]);
  const [trainIdsToProject, setTrainIdsToProject] = useState<Set<number>>(new Set());

  const { data: timetable } = osrdEditoastApi.endpoints.getTimetableById.useQuery(
    { id: timetableId! },
    {
      skip: !timetableId,
    }
  );
  const trainIds = useMemo(() => timetable?.train_ids || [], [timetable]);

  const { currentData: trainSchedules } = osrdEditoastApi.endpoints.postTrainSchedule.useQuery(
    {
      body: {
        ids: trainIds,
      },
    },
    {
      skip: !trainIds.length,
    }
  );

  // Progressive loading of the trains
  const { trainScheduleSummariesById } = useLazyLoadTrains({
    infraId,
    trainIdsToFetch: trainIds,
    trainSchedules,
  });

  // Progressive projection of the trains
  const { projectedTrainsById, allTrainsProjected } = useLazyProjectTrains({
    infraId,
    trainIdsToProject,
    path: stdcmResponse?.path,
    trainSchedules,
    setTrainIdsToProject,
  });

  useEffect(() => {
    if (stdcmResponse) {
      const relevantTrainScheduleIds = keepTrainsRunningDuringStdcm(
        stdcmResponse,
        trainScheduleSummariesById
      );
      setTrainIdsToProject((prev) => new Set([...prev, ...relevantTrainScheduleIds]));
    }
  }, [trainScheduleSummariesById]);

  useEffect(() => {
    if (stdcmResponse) {
      // start again the projection when the stdcm response changes
      setSpaceTimeData([]);
      const relevantTrainScheduleIds = keepTrainsRunningDuringStdcm(
        stdcmResponse,
        trainScheduleSummariesById
      );
      setTrainIdsToProject(new Set(relevantTrainScheduleIds));
    }
  }, [stdcmResponse]);

  // Add the stdcm projected train to the space time data
  useEffect(() => {
    const newSpaceTimeData = Array.from(projectedTrainsById.values());
    if (stdcmResponse) {
      newSpaceTimeData.push(formatStdcmTrainIntoSpaceTimeData(stdcmResponse));
    }
    setSpaceTimeData(newSpaceTimeData);
  }, [projectedTrainsById]);

  if (!infraId || !stdcmResponse) return null;

  return {
    spaceTimeData,
    projectionLoaderData: { allTrainsProjected, totalTrains: trainIds.length },
  };
};

export default useProjectedTrainsForStdcm;
