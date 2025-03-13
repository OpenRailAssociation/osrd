import { useEffect, useMemo, useState } from 'react';

import { useSelector } from 'react-redux';

import useLazyLoadTimetableItems from 'applications/operationalStudies/hooks/useLazyLoadTimetableItems';
import type { TrainSpaceTimeData } from 'applications/operationalStudies/types';
import type { StdcmSuccessResponse } from 'applications/stdcm/types';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import useLazyProjectTrains from 'modules/simulationResult/components/SpaceTimeChart/useLazyProjectTrains';
import type { TimetableItemWithDetails } from 'modules/trainschedule/components/Timetable/types';
import {
  getStdcmElectricalProfileSetId,
  getStdcmInfraID,
  getStdcmTimetableID,
} from 'reducers/osrdconf/stdcmConf/selectors';
import type { TimetableItemId, TrainScheduleResultWithTrainId } from 'reducers/osrdconf/types';
import { Duration, addDurationToDate } from 'utils/duration';
import { formatEditoastTrainIdToTrainScheduleId } from 'utils/trainId';

import formatStdcmTrainIntoSpaceTimeData from '../utils/formatStdcmIntoSpaceTimeData';

/**
 * Project only the trains which leave 1 hour max before the departure of the stdcm or
 * arrive 1 hour max after the arrival of the stdcm
 */
const keepTrainsRunningDuringStdcm = (
  stdcmResult: StdcmSuccessResponse,
  trainSchedules: Map<TimetableItemId, TimetableItemWithDetails>
) => {
  const relevantTrainScheduleIds = new Set<TimetableItemId>();

  const stdcmDepartureTime = new Date(stdcmResult.departure_time);
  const stdcmArrivalTime = addDurationToDate(
    new Date(stdcmResult.departure_time),
    new Duration({ milliseconds: stdcmResult.simulation.final_output.times.at(-1)! })
  );

  for (const trainSchedule of trainSchedules.values()) {
    if (trainSchedule.invalidReason || trainSchedule.pathItemTimes === undefined) {
      continue;
    }
    const departureTime = trainSchedule.startTime;
    const arrivalTime = addDurationToDate(
      trainSchedule.startTime,
      new Duration({ milliseconds: trainSchedule.pathItemTimes.final.at(-1)! })
    );

    if (
      arrivalTime < addDurationToDate(stdcmDepartureTime, new Duration({ hours: -1 })) ||
      departureTime > addDurationToDate(stdcmArrivalTime, new Duration({ hours: 1 }))
    ) {
      continue;
    }

    relevantTrainScheduleIds.add(trainSchedule.id);
  }

  return relevantTrainScheduleIds;
};

const useProjectedTrainsForStdcm = (stdcmResponse?: StdcmSuccessResponse) => {
  const infraId = useSelector(getStdcmInfraID);
  const timetableId = useSelector(getStdcmTimetableID);
  const electricalProfileSetId = useSelector(getStdcmElectricalProfileSetId);

  const [spaceTimeData, setSpaceTimeData] = useState<TrainSpaceTimeData[]>([]);
  const [timetableItemIdsToProject, setTimetableItemIdsToProject] = useState<Set<TimetableItemId>>(
    new Set()
  );

  const { data: timetable } = osrdEditoastApi.endpoints.getAllTimetableByIdTrainSchedules.useQuery({
    timetableId,
  });

  const trainIds = useMemo(() => timetable?.map((t) => t.id) || [], [timetable]);

  const formattedTrainIds = useMemo(
    () => trainIds.map((trainId) => formatEditoastTrainIdToTrainScheduleId(trainId)),
    [trainIds]
  );

  const formattedTrainSchedules: TrainScheduleResultWithTrainId[] | undefined = useMemo(
    () =>
      timetable?.map((trainSchedule) => ({
        ...trainSchedule,
        id: formatEditoastTrainIdToTrainScheduleId(trainSchedule.id),
      })),
    [timetable]
  );

  // Progressive loading of the trains
  const { timetableItemSummariesById } = useLazyLoadTimetableItems({
    infraId,
    electricalProfileSetId,
    timetableItemIdsToFetch: formattedTrainIds,
    timetableItems: formattedTrainSchedules,
  });

  // TODO Paced trains : update this in https://github.com/OpenRailAssociation/osrd/issues/10613
  // Progressive projection of the trains
  const { projectedTrainsById, allTrainsProjected } = useLazyProjectTrains({
    infraId,
    electricalProfileSetId,
    timetableItemIdsToProject,
    path: stdcmResponse?.path,
    timetableItems: formattedTrainSchedules,
    setTimetableItemIdsToProject,
  });

  useEffect(() => {
    if (stdcmResponse) {
      const relevantTrainScheduleIds = keepTrainsRunningDuringStdcm(
        stdcmResponse,
        timetableItemSummariesById
      );
      setTimetableItemIdsToProject((prev) => new Set([...prev, ...relevantTrainScheduleIds]));
    }
  }, [timetableItemSummariesById]);

  useEffect(() => {
    if (stdcmResponse) {
      // start again the projection when the stdcm response changes
      setSpaceTimeData([]);
      const relevantTrainScheduleIds = keepTrainsRunningDuringStdcm(
        stdcmResponse,
        timetableItemSummariesById
      );
      setTimetableItemIdsToProject(new Set(relevantTrainScheduleIds));
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

  if (!stdcmResponse) return null;

  return {
    spaceTimeData,
    projectionLoaderData: { allTrainsProjected, totalTrains: trainIds.length },
  };
};

export default useProjectedTrainsForStdcm;
