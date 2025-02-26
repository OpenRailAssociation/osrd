import { useEffect, useMemo, useState } from 'react';

import { keyBy } from 'lodash';
import { useTranslation } from 'react-i18next';

import { useScenarioContext } from 'applications/operationalStudies/hooks/useScenarioContext';
import type {
  PathPropertiesFormatted,
  SimulationResponseSuccess,
} from 'applications/operationalStudies/types';
import type { PathfindingResultSuccess, TrainScheduleResult } from 'common/api/osrdEditoastApi';
import { interpolateValue } from 'modules/simulationResult/SimulationResultExport/utils';
import type { TimetableItemWithDetails } from 'modules/trainschedule/components/Timetable/types';
import { dateToHHMMSS } from 'utils/date';
import { Duration } from 'utils/duration';

import { ARRIVAL_TIME_ACCEPTABLE_ERROR } from '../consts';
import { computeInputDatetimes } from '../helpers/arrivalTime';
import computeMargins, { getTheoreticalMargins } from '../helpers/computeMargins';
import { formatSchedule } from '../helpers/scheduleData';
import { type ScheduleEntry, type TimesStopsRow } from '../types';

const useOutputTableData = (
  simulatedTrain?: SimulationResponseSuccess['final_output'],
  trainSummary?: TimetableItemWithDetails,
  operationalPoints?: PathPropertiesFormatted['operationalPoints'],
  selectedTrainSchedule?: TrainScheduleResult,
  path?: PathfindingResultSuccess
): TimesStopsRow[] => {
  const { t } = useTranslation('timesStops');
  const { getTrackSectionsByIds } = useScenarioContext();

  const [rows, setRows] = useState<TimesStopsRow[]>([]);

  const scheduleByAt: Record<string, ScheduleEntry> = keyBy(selectedTrainSchedule?.schedule, 'at');
  const theoreticalMargins = selectedTrainSchedule && getTheoreticalMargins(selectedTrainSchedule);

  const startDatetime = selectedTrainSchedule
    ? new Date(selectedTrainSchedule.start_time)
    : undefined;

  const pathStepRows = useMemo(() => {
    const pathItemTimes = trainSummary?.pathItemTimes;
    if (!path || !selectedTrainSchedule || !pathItemTimes || !startDatetime) return [];

    let lastReferenceDate = startDatetime;

    return selectedTrainSchedule.path.map((pathStep, index) => {
      const schedule: ScheduleEntry | undefined = scheduleByAt[pathStep.id];

      const computedArrival = new Date(startDatetime.getTime() + pathItemTimes.final[index]);

      const { stopFor, shortSlipDistance, onStopSignal, calculatedDeparture } = formatSchedule(
        computedArrival,
        schedule
      );
      const {
        theoreticalMargin,
        isTheoreticalMarginBoundary,
        theoreticalMarginSeconds,
        calculatedMargin,
        diffMargins,
      } = computeMargins(
        theoreticalMargins,
        selectedTrainSchedule,
        scheduleByAt,
        index,
        pathItemTimes
      );

      const { theoreticalArrival, arrival, departure, refDate } = computeInputDatetimes(
        startDatetime,
        lastReferenceDate,
        schedule,
        {
          isDeparture: index === 0,
        }
      );
      lastReferenceDate = refDate;

      const isOnTime = theoreticalArrival
        ? Duration.subtractDate(theoreticalArrival, computedArrival).abs() <=
          ARRIVAL_TIME_ACCEPTABLE_ERROR
        : false;

      return {
        pathStepId: pathStep.id,
        name: t('waypoint', { id: pathStep.id }),
        ch: undefined,

        arrival,
        departure,
        stopFor,
        onStopSignal,
        shortSlipDistance,
        theoreticalMargin,
        isTheoreticalMarginBoundary,

        theoreticalMarginSeconds,
        calculatedMargin,
        diffMargins,
        calculatedArrival: dateToHHMMSS(isOnTime ? theoreticalArrival! : computedArrival),
        calculatedDeparture,
        positionOnPath: path.path_item_positions[index],
      };
    });
  }, [selectedTrainSchedule, path, trainSummary?.pathItemTimes]);

  useEffect(() => {
    const formatRows = async () => {
      if (!operationalPoints || !startDatetime || !simulatedTrain) {
        setRows([]);
        return;
      }

      const trackIds = operationalPoints.map((op) => op.part.track);
      const trackSections = await getTrackSectionsByIds(trackIds);

      const formattedRows = operationalPoints.map((op) => {
        const matchingPathStep = pathStepRows.find(
          (pathStepRow) => op.position === pathStepRow.positionOnPath
        );
        if (matchingPathStep) {
          return {
            ...matchingPathStep,
            opId: op.id,
            name: op.extensions?.identifier?.name,
            ch: op.extensions?.sncf?.ch,
            trackName: trackSections[op.part.track]?.extensions?.sncf?.track_name,
          };
        }

        // compute arrival time
        const matchingReportTrainIndex = simulatedTrain.positions.findIndex(
          (position) => position === op.position
        );

        const time =
          matchingReportTrainIndex === -1
            ? interpolateValue(simulatedTrain, op.position, 'times')
            : simulatedTrain.times[matchingReportTrainIndex];
        const calculatedArrival = new Date(startDatetime.getTime() + time);

        return {
          opId: op.id,
          name: op.extensions?.identifier?.name,
          ch: op.extensions?.sncf?.ch,
          calculatedArrival: dateToHHMMSS(calculatedArrival),
          trackName: trackSections[op.part.track]?.extensions?.sncf?.track_name,
        };
      });
      setRows(formattedRows);
    };

    formatRows();
  }, [operationalPoints, pathStepRows, simulatedTrain, getTrackSectionsByIds]);

  return rows;
};

export default useOutputTableData;
