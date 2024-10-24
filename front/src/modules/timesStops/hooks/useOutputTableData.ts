import { useMemo } from 'react';

import { keyBy } from 'lodash';
import { useTranslation } from 'react-i18next';

import type {
  OperationalPointWithTimeAndSpeed,
  PathPropertiesFormatted,
  SimulationResponseSuccess,
} from 'applications/operationalStudies/types';
import type { PathfindingResultSuccess, TrainScheduleResult } from 'common/api/osrdEditoastApi';
import { formatSuggestedOperationalPoints } from 'modules/pathfinding/utils';
import type { SuggestedOP } from 'modules/trainschedule/components/ManageTrainSchedule/types';
import { convertIsoUtcToLocalTime } from 'utils/date';
import { secToHoursString } from 'utils/timeManipulation';

import { checkAndFormatCalculatedArrival } from '../helpers/arrivalTime';
import computeMargins from '../helpers/computeMargins';
import { computeScheduleData, formatScheduleData } from '../helpers/scheduleData';
import {
  findNextScheduledOpPoint,
  formatSuggestedViasToRowVias,
  updateDaySinceDeparture,
} from '../helpers/utils';
import {
  type TrainScheduleBasePathWithUic,
  type ScheduleEntry,
  type TimeStopsRow,
  TableType,
} from '../types';

function useOutputTableData(
  simulatedTrain: SimulationResponseSuccess,
  pathProperties: PathPropertiesFormatted,
  operationalPoints: OperationalPointWithTimeAndSpeed[],
  selectedTrainSchedule: TrainScheduleResult,
  path?: PathfindingResultSuccess
): TimeStopsRow[] {
  const { t } = useTranslation('timesStops');

  const scheduleByAt: Record<string, ScheduleEntry> = keyBy(selectedTrainSchedule.schedule, 'at');
  const suggestedOperationalPoints: SuggestedOP[] = useMemo(
    () =>
      path?.length
        ? formatSuggestedOperationalPoints(
            pathProperties.operationalPoints,
            pathProperties.geometry,
            path.length
          )
        : [],
    [pathProperties.operationalPoints, pathProperties.geometry]
  );

  const pathStepsWithPositionOnPath = useMemo(() => {
    if (!path || !selectedTrainSchedule) return [];
    return selectedTrainSchedule.path.map((pathStep, index) => ({
      ...pathStep,
      positionOnPath: path.path_item_positions[index],
    }));
  }, [path, selectedTrainSchedule]);

  const pathStepsWithOpPointIndices = useMemo(
    () =>
      selectedTrainSchedule.path
        .filter((pathStep): pathStep is TrainScheduleBasePathWithUic => 'uic' in pathStep)
        .map((pathStep) => {
          const correspondingOpPointIndex = suggestedOperationalPoints.findIndex(
            (sugOpPoint) =>
              'uic' in pathStep &&
              sugOpPoint.uic === pathStep.uic &&
              sugOpPoint.ch === pathStep.secondary_code
          );
          return {
            ...pathStep,
            correspondingOpPointIndex,
          };
        }),
    [selectedTrainSchedule, suggestedOperationalPoints]
  );
  const pathStepsByUic = keyBy(
    pathStepsWithOpPointIndices,
    (pathStep) => `${pathStep.uic}-${pathStep.secondary_code}`
  );

  const outputTableData = useMemo(() => {
    const pathStepRows = pathStepsWithPositionOnPath.map((pathStep) => {
      const schedule = scheduleByAt[pathStep.id];
      const scheduleData = computeScheduleData(schedule);
      return { ...pathStep, ...formatScheduleData(scheduleData) };
    });

    const suggestedOpRows = suggestedOperationalPoints.map((sugOpPoint, sugOpIndex) => {
      const opPoint = operationalPoints.find((op) => op.id === sugOpPoint.opId);
      if (!opPoint) {
        return sugOpPoint;
      }
      const nextOpPoint = findNextScheduledOpPoint(
        operationalPoints,
        pathStepsWithOpPointIndices,
        sugOpIndex
      );
      const pathStepKey = `${sugOpPoint.uic}-${sugOpPoint.ch}`;

      if (pathStepKey in pathStepsByUic) {
        const pathStepId = pathStepsByUic[pathStepKey].id || '';
        const schedule = scheduleByAt[pathStepId];
        const scheduleData = computeScheduleData(schedule);
        const formattedScheduleData = formatScheduleData(scheduleData);
        const marginsData = nextOpPoint
          ? computeMargins(simulatedTrain, opPoint, nextOpPoint, selectedTrainSchedule, pathStepId)
          : null;
        const calculatedArrival = checkAndFormatCalculatedArrival(scheduleData, opPoint.time);
        return {
          ...sugOpPoint,
          ...formattedScheduleData,
          receptionSignal: schedule?.reception_signal,
          calculatedArrival,
          calculatedDeparture:
            opPoint.duration > 0
              ? secToHoursString(opPoint.time + opPoint.duration, { withSeconds: true })
              : '',
          ...marginsData,
        };
      }

      return {
        ...sugOpPoint,
        calculatedArrival: secToHoursString(opPoint.time, { withSeconds: true }),
      };
    });

    const allWaypoints = suggestedOpRows.map((sugOpPoint) => {
      const matchingPathStep = pathStepRows.find(
        (pathStepRow) => sugOpPoint.positionOnPath === pathStepRow.positionOnPath
      );
      return {
        ...sugOpPoint,
        ...(matchingPathStep || {}),
        isWaypoint: matchingPathStep !== undefined,
      };
    });

    const startTime = convertIsoUtcToLocalTime(selectedTrainSchedule.start_time);
    const formattedWaypoints = formatSuggestedViasToRowVias(
      allWaypoints,
      [],
      t,
      startTime,
      TableType.Output
    );
    return updateDaySinceDeparture(formattedWaypoints, startTime, { keepFirstIndexArrival: true });
  }, [simulatedTrain, operationalPoints, selectedTrainSchedule, pathStepsWithOpPointIndices]);

  return outputTableData;
}

export default useOutputTableData;
