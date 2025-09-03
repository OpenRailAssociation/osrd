import { useEffect, useMemo, useState } from 'react';

import { keyBy } from 'lodash';
import { useTranslation } from 'react-i18next';

import { useScenarioContext } from 'applications/operationalStudies/hooks/useScenarioContext';
import useTrainOps from 'applications/operationalStudies/hooks/useTrainOps';
import type { PathPropertiesFormatted } from 'applications/operationalStudies/types';
import type {
  PathfindingResultSuccess,
  SimulationResponseSuccess,
} from 'common/api/osrdEditoastApi';
import { matchPathStepAndOp } from 'modules/pathfinding/utils';
import { interpolateValue } from 'modules/simulationResult/SimulationResultExport/utils';
import type { SimulationSummary } from 'modules/timetableItem/types';
import type { Train } from 'reducers/osrdconf/types';
import { useDateTimeLocale } from 'utils/date';
import { Duration } from 'utils/duration';

import { ARRIVAL_TIME_ACCEPTABLE_ERROR } from '../consts';
import { computeInputDatetimes } from '../helpers/arrivalTime';
import computeMargins, { getTheoreticalMargins } from '../helpers/computeMargins';
import { formatSchedule } from '../helpers/scheduleData';
import { matchOpRefAndOp, getTrackReferenceLabel, getOperationalPointName } from '../helpers/utils';
import { type ScheduleEntry, type TimesStopsRow } from '../types';

const useOutputTableData = (
  infraId: number,
  isValid: boolean,
  selectedTrain?: Train,
  simulatedTrain?: SimulationResponseSuccess['final_output'],
  simulatedPath?: PathfindingResultSuccess,
  simulatedPathItemTimes?: Extract<SimulationSummary, { isValid: true }>['pathItemTimes'],
  simulatedOperationalPoints?: PathPropertiesFormatted['operationalPoints']
): TimesStopsRow[] => {
  const { t } = useTranslation('operational-studies');
  const dateTimeLocale = useDateTimeLocale();
  const { getTrackSectionsByIds } = useScenarioContext();

  const [rows, setRows] = useState<TimesStopsRow[]>([]);

  const trainOperationalPoints = useTrainOps(infraId, selectedTrain);

  // Extract common properties between valid and invalid trains
  const scheduleByAt: Record<string, ScheduleEntry> = keyBy(selectedTrain?.schedule, 'at');
  const theoreticalMargins = selectedTrain && getTheoreticalMargins(selectedTrain);
  const operationalPoints = useMemo(
    () => simulatedOperationalPoints ?? trainOperationalPoints,
    [simulatedOperationalPoints, trainOperationalPoints]
  );

  // Format input path step rows
  useEffect(() => {
    const formatPathStepRows = async (): Promise<Map<string, Partial<TimesStopsRow>>> => {
      if (!selectedTrain || !operationalPoints || operationalPoints.length === 0) return new Map();

      const trackIds = selectedTrain.path.reduce<string[]>((ids, step) => {
        if ('track' in step) ids.push(step.track);
        return ids;
      }, []);
      const trackSections = await getTrackSectionsByIds(trackIds);

      const startDatetime = new Date(selectedTrain.start_time);
      let lastReferenceDate = startDatetime;
      let mapWaypointCount = 0;

      return new Map(
        selectedTrain.path.map((pathStep, index) => {
          const opPositionOnPath = simulatedPath?.path_item_positions[index];
          const matchingOperationalPoint = operationalPoints.find((op) =>
            opPositionOnPath ? op.position === opPositionOnPath : matchOpRefAndOp(op, pathStep)
          );

          if ('track' in pathStep) mapWaypointCount += 1;
          const name = getOperationalPointName(
            matchingOperationalPoint,
            pathStep,
            mapWaypointCount,
            t
          );
          const trackName =
            'track' in pathStep
              ? trackSections[pathStep.track]?.extensions?.sncf?.track_name
              : getTrackReferenceLabel(pathStep.track_reference);

          const schedule = scheduleByAt[pathStep.id];
          const computedArrival = simulatedPathItemTimes
            ? new Date(startDatetime.getTime() + simulatedPathItemTimes.final[index])
            : undefined;
          const { stopFor, shortSlipDistance, onStopSignal, calculatedDeparture } = formatSchedule(
            computedArrival,
            schedule,
            dateTimeLocale
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

          const isOnTime =
            theoreticalArrival && computedArrival
              ? Duration.subtractDate(theoreticalArrival, computedArrival).abs() <=
                ARRIVAL_TIME_ACCEPTABLE_ERROR
              : false;
          const calculatedArrival = computedArrival
            ? (isOnTime ? theoreticalArrival! : computedArrival).toLocaleTimeString(dateTimeLocale)
            : undefined;

          const pathStepRow = {
            pathStepId: pathStep.id,
            opId: matchingOperationalPoint?.id,
            name,
            ch: matchingOperationalPoint?.extensions?.sncf?.ch,
            trackName,

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
            calculatedArrival,
            calculatedDeparture,
          };

          return [pathStepRow.pathStepId, pathStepRow];
        })
      );
    };

    const formatRows = async () => {
      if (!selectedTrain || !operationalPoints) {
        setRows([]);
        return;
      }

      const pathStepRowsById = await formatPathStepRows();

      let formattedRows = Array.from(pathStepRowsById.values());

      // For valid trains, complete the rows with the simulated path's operational points and tracks information
      if (isValid && simulatedTrain) {
        const trackIds = operationalPoints.map((op) => op.part.track);
        const trackSectionsOnPath = await getTrackSectionsByIds(trackIds);

        formattedRows = operationalPoints.map((op) => {
          const trackName = trackSectionsOnPath[op.part.track]?.extensions?.sncf?.track_name;

          // early return if the op matches a pathStep (handled in formatPathStepRows)
          // only add the trackName which has been found by the pathfinding (if not precised in the pathStep)
          const matchingPathStep = selectedTrain.path.find((pathStep) =>
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

          // Compute arrival time when the operational point comes from the simulation
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
            trackName,
            calculatedArrival: calculatedArrival.toLocaleTimeString(dateTimeLocale),
          };
        });
      }

      setRows(formattedRows);
    };

    formatRows();
  }, [operationalPoints, simulatedTrain, getTrackSectionsByIds]);

  return rows;
};

export default useOutputTableData;
