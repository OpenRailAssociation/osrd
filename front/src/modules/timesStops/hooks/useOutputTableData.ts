import { useEffect, useMemo, useState } from 'react';

import { keyBy } from 'lodash';

import { useScenarioContext } from 'applications/operationalStudies/hooks/useScenarioContext';
import type { PathPropertiesFormatted } from 'applications/operationalStudies/types';
import type {
  PathfindingResultSuccess,
  SimulationResponseSuccess,
} from 'common/api/osrdEditoastApi';
import { matchPathStepAndOp } from 'modules/pathfinding/utils';
import { interpolateValue } from 'modules/simulationResult/SimulationResultExport/utils';
import type { SimulationSummary } from 'modules/timetableItem/components/Timetable/types';
import type { Train } from 'reducers/osrdconf/types';
import { dateToHHMMSS } from 'utils/date';
import { Duration } from 'utils/duration';

import { ARRIVAL_TIME_ACCEPTABLE_ERROR } from '../consts';
import { computeInputDatetimes } from '../helpers/arrivalTime';
import computeMargins, { getTheoreticalMargins } from '../helpers/computeMargins';
import { formatSchedule } from '../helpers/scheduleData';
import { type ScheduleEntry, type TimesStopsRow } from '../types';

const useOutputTableData = (
  isValid: boolean,
  selectedTrain?: Train,
  simulatedTrain?: SimulationResponseSuccess['final_output'],
  simulatedPath?: PathfindingResultSuccess,
  simulatedPathItemTimes?: Extract<SimulationSummary, { isValid: true }>['pathItemTimes'],
  simulatedOperationalPoints?: PathPropertiesFormatted['operationalPoints']
): TimesStopsRow[] => {
  const { getTrackSectionsByIds } = useScenarioContext();

  const [rows, setRows] = useState<TimesStopsRow[]>([]);

  const scheduleByAt: Record<string, ScheduleEntry> = keyBy(selectedTrain?.schedule, 'at');
  const theoreticalMargins = selectedTrain && getTheoreticalMargins(selectedTrain);

  const pathStepRowsById: Map<string, Partial<TimesStopsRow>> = useMemo(() => {
    if (
      !selectedTrain ||
      !isValid ||
      !simulatedPathItemTimes ||
      !simulatedPath ||
      !simulatedOperationalPoints
    )
      return new Map();

    const startDatetime = new Date(selectedTrain.start_time);
    let lastReferenceDate = startDatetime;

    return new Map(
      selectedTrain.path.map((pathStep, index) => {
        const opPositionOnPath = simulatedPath?.path_item_positions[index];
        const matchingOperationalPoint = simulatedOperationalPoints.find(
          (op) => op.position === opPositionOnPath
        );

        const schedule: ScheduleEntry | undefined = scheduleByAt[pathStep.id];
        const computedArrival = new Date(
          startDatetime.getTime() + simulatedPathItemTimes.final[index]
        );
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
          selectedTrain,
          scheduleByAt,
          index,
          simulatedPathItemTimes
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

        const pathStepRow = {
          pathStepId: pathStep.id,
          opId: matchingOperationalPoint?.id,
          name: matchingOperationalPoint?.extensions?.identifier?.name,
          ch: matchingOperationalPoint?.extensions?.sncf?.ch,

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
        };

        return [pathStepRow.pathStepId, pathStepRow];
      })
    );
  }, [selectedTrain, simulatedPathItemTimes]);

  useEffect(() => {
    const formatRows = async () => {
      if (!simulatedOperationalPoints || !selectedTrain || !simulatedTrain || !isValid) {
        setRows([]);
        return;
      }

      const trackIds = simulatedOperationalPoints.map((op) => op.part.track);
      const trackSections = await getTrackSectionsByIds(trackIds);

      const formattedRows = simulatedOperationalPoints.map((op) => {
        const trackName = trackSections[op.part.track]?.extensions?.sncf?.track_name;
        const matchingPathStep = selectedTrain?.path.find((pathStep) =>
          matchPathStepAndOp(pathStep, {
            opId: op.id,
            uic: op.extensions?.identifier?.uic,
            ch: op.extensions?.sncf?.ch,
            trigram: op.extensions?.sncf?.trigram,
            track: op.part.track,
            offsetOnTrack: op.part.position,
          })
        );

        const matchingPathStepRow = matchingPathStep
          ? pathStepRowsById.get(matchingPathStep.id)
          : undefined;

        if (matchingPathStepRow) {
          return {
            ...matchingPathStepRow,
            trackName,
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
        const calculatedArrival = new Date(new Date(selectedTrain.start_time).getTime() + time);

        return {
          opId: op.id,
          name: op.extensions?.identifier?.name,
          ch: op.extensions?.sncf?.ch,
          calculatedArrival: dateToHHMMSS(calculatedArrival),
          trackName,
        };
      });
      setRows(formattedRows);
    };

    formatRows();
  }, [simulatedOperationalPoints, pathStepRowsById, simulatedTrain, getTrackSectionsByIds]);

  return rows;
};

export default useOutputTableData;
