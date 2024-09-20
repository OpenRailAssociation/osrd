import { useMemo } from 'react';

import { keyBy } from 'lodash';
import { useTranslation } from 'react-i18next';

import type { PathPropertiesFormatted } from 'applications/operationalStudies/types';
import type { PathfindingResultSuccess, TrainScheduleResult } from 'common/api/osrdEditoastApi';
import { ISO8601Duration2sec, secToHoursString } from 'utils/timeManipulation';

import { computeMarginsResults } from '../helpers/computeMargins';
import { formatSchedule } from '../helpers/scheduleData';
import { type ScheduleEntry, type TimeStopsRow, type TimeExtraDays } from '../types';
import type { TrainScheduleWithDetails } from 'modules/trainschedule/components/Timetable/types';
import { computeDayTimeFromStartTime } from '../helpers/arrivalTime';
import { isoDateWithTimezoneToSec } from 'utils/date';

const useOutputTableData = (
  trainSummary: TrainScheduleWithDetails,
  pathProperties: PathPropertiesFormatted,
  selectedTrainSchedule: TrainScheduleResult,
  path?: PathfindingResultSuccess
): TimeStopsRow[] => {
  const { t } = useTranslation('timesStops');

  const scheduleByAt: Record<string, ScheduleEntry> = keyBy(selectedTrainSchedule.schedule, 'at');

  const pathStepRows = useMemo(() => {
    if (!path || !selectedTrainSchedule || !trainSummary.pathItemTimes) return [];

    const result: (TimeStopsRow & { positionOnPath: number })[] = [];
    const startTime = isoDateWithTimezoneToSec(selectedTrainSchedule.start_time);
    let previousTime = startTime;

    for (let index = 0; index < selectedTrainSchedule.path.length; index++) {
      const pathStep = selectedTrainSchedule.path[index];
      const computedArrivalTime = trainSummary.pathItemTimes.final[index];

      const schedule = scheduleByAt[pathStep.id];
      const { stopFor, onStopSignal } = formatSchedule(schedule, computedArrivalTime);
      const { theoreticalMargin, theoreticalMarginSeconds, calculatedMargin, diffMargins } =
        computeMarginsResults(selectedTrainSchedule, index, trainSummary.pathItemTimes);

      let arrival: TimeExtraDays | undefined;
      if (schedule?.arrival) {
        const arrivalInSeconds = ISO8601Duration2sec(schedule.arrival); // duration from startTime
        const result = computeDayTimeFromStartTime(startTime, arrivalInSeconds, previousTime);
        arrival = result.timeExtraDay;
        previousTime = result.previousTime;
      }

      let departure: TimeExtraDays | undefined;
      if (schedule && schedule.arrival && schedule.stop_for) {
        const departureInSeconds =
          ISO8601Duration2sec(schedule.arrival) + ISO8601Duration2sec(schedule.stop_for);
        const result = computeDayTimeFromStartTime(startTime, departureInSeconds, previousTime);
        arrival = result.timeExtraDay;
        previousTime = result.previousTime;
      }

      // à checker:
      // - stopFor
      // - les marges
      // - les horaires
      result.push({
        opId: pathStep.id,
        name: t('waypoint', { id: pathStep.id }),
        ch: undefined,
        isWaypoint: true,

        arrival,
        departure,
        stopFor,
        onStopSignal,
        theoreticalMargin,

        theoreticalMarginSeconds,
        calculatedMargin,
        diffMargins,
        calculatedArrival: secToHoursString(computedArrivalTime, {
          withSeconds: true,
        }),
        positionOnPath: path.path_item_positions[index],
      });
    }

    return result;
  }, [selectedTrainSchedule, path]);

  const rows: TimeStopsRow[] = useMemo(
    () =>
      pathProperties.operationalPoints.map((op) => {
        const matchingPathStep = pathStepRows.find(
          (pathStepRow) => op.position === pathStepRow.positionOnPath
        );
        return {
          ...(matchingPathStep || {}),
          opId: op.id,
          name: op.extensions?.identifier?.name,
          ch: op.extensions?.sncf?.ch,
          isWaypoint: matchingPathStep !== undefined,
        };
      }),
    [pathProperties.operationalPoints]
  );

  return rows;
};

export default useOutputTableData;
