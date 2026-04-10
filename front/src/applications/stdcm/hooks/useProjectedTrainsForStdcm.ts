import { useEffect, useMemo, useState } from 'react';

import { useSelector } from 'react-redux';

import useLazySimulateTrains from 'applications/operationalStudies/hooks/useLazySimulateTrains';
import type { StdcmSuccessResponse } from 'applications/stdcm/types';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import useLazyProjectTrains from 'modules/simulationResult/components/SpaceTimeChartWrapper/useLazyProjectTrains';
import type { TrainSpaceTimeData } from 'modules/simulationResult/types';
import type { TrainScheduleWithDetails } from 'modules/timetableItem/types';
import {
  getStdcmElectricalProfileSetId,
  getStdcmInfraID,
  getStdcmTimetableID,
} from 'reducers/osrdconf/stdcmConf/selectors';
import type { TimetableItem } from 'reducers/osrdconf/types';
import { Duration, addDurationToDate } from 'utils/duration';
import { mapBy } from 'utils/types';

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
    new Duration({ milliseconds: stdcmResult.simulation.final_output.times.at(-1)! })
  );

  for (const trainSchedule of trainSchedules.values()) {
    if (!trainSchedule.summary?.isValid) {
      continue;
    }
    const departureTime = trainSchedule.startTime;
    const arrivalTime = addDurationToDate(
      trainSchedule.startTime,
      new Duration({ milliseconds: trainSchedule.summary.pathItemTimes.final.at(-1)! })
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

  const { data: trainSchedules = [] } =
    osrdEditoastApi.endpoints.getAllTimetableByIdTrainSchedules.useQuery({
      timetableId,
    });

  const { data: { results: rollingStocks } = { results: null } } =
    osrdEditoastApi.endpoints.getLightRollingStock.useQuery({ pageSize: 1000 });

  const trainSchedulesById: Map<number, TimetableItem> = useMemo(
    () => mapBy(trainSchedules, 'id'),
    [trainSchedules]
  );

  // Progressive projection of the trains
  const { projectedTrainsById, allTrainsProjected, projectTimetableItems } = useLazyProjectTrains({
    infraId,
    timetableId,
    electricalProfileSetId,
    path: stdcmResponse?.pathfinding_result.path,
  });

  // Progressive loading of the trains
  const { simulatedTrainsById, simulateTimetableItems } = useLazySimulateTrains({
    infraId,
    timetableId,
    electricalProfileSetId,
    rollingStocks,
    onProgress: (results) => {
      if (!stdcmResponse) return;
      const relevantTrainScheduleIds = keepTrainsRunningDuringStdcm(stdcmResponse, results);
      projectTimetableItems([...relevantTrainScheduleIds].map((id) => trainSchedulesById.get(id)!));
    },
  });

  useEffect(() => {
    simulateTimetableItems(trainSchedules);
  }, [trainSchedules]);

  useEffect(() => {
    if (stdcmResponse) {
      // start again the projection when the stdcm response changes
      setSpaceTimeData([]);
      const relevantTrainScheduleIds = keepTrainsRunningDuringStdcm(
        stdcmResponse,
        simulatedTrainsById
      );
      projectTimetableItems([...relevantTrainScheduleIds].map((id) => trainSchedulesById.get(id)!));
    }
  }, [stdcmResponse]);

  // Add the stdcm projected train to the space time data
  useEffect(() => {
    const newSpaceTimeData = Array.from(projectedTrainsById.values());
    if (stdcmResponse) {
      newSpaceTimeData.push(formatStdcmTrainIntoSpaceTimeData(stdcmResponse));
    }
    setSpaceTimeData(newSpaceTimeData);
  }, [projectedTrainsById, stdcmResponse]);

  if (!stdcmResponse) return null;

  return {
    spaceTimeData,
    projectionLoaderData: { allTrainsProjected, totalTrains: trainSchedules.length },
  };
};

export default useProjectedTrainsForStdcm;
