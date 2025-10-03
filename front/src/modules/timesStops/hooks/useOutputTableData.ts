import { useEffect, useState } from 'react';

import { keyBy } from 'lodash';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { useScenarioContext } from 'applications/operationalStudies/hooks/useScenarioContext';
import useTrainOps from 'applications/operationalStudies/hooks/useTrainOps';
import type { PathPropertiesFormatted } from 'applications/operationalStudies/types';
import type { SimulationResponseSuccess } from 'common/api/osrdEditoastApi';
import { matchPathStepAndOp } from 'modules/pathfinding/utils';
import { interpolateValue } from 'modules/simulationResult/helpers/utils';
import type { SimulationSummary } from 'modules/timetableItem/types';
import type { Train } from 'reducers/osrdconf/types';
import { getDisplayOnlyPathSteps } from 'reducers/simulationResults/selectors';
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
  simulatedPathItemTimes?: Extract<SimulationSummary, { isValid: true }>['pathItemTimes'],
  operationalPointsOnPath?: PathPropertiesFormatted['operationalPoints']
): TimesStopsRow[] => {
  const { t } = useTranslation('operational-studies');
  const { getTrackSectionsByIds } = useScenarioContext();
  const displayOnlyPathSteps = useSelector(getDisplayOnlyPathSteps);

  const pathStepOps = useTrainOps(infraId, selectedTrain);

  const [rows, setRows] = useState<TimesStopsRow[]>([]);

  // Extract common properties between valid and invalid trains
  const scheduleByAt: Record<string, ScheduleEntry> = keyBy(selectedTrain?.schedule, 'at');
  const theoreticalMargins = selectedTrain && getTheoreticalMargins(selectedTrain);

  // Format input path step rows
  useEffect(() => {
    const formatPathStepRows = async (train: Train): Promise<Map<string, TimesStopsRow>> => {
      const trackIds = train.path.reduce<string[]>((ids, step) => {
        if ('track' in step) ids.push(step.track);
        return ids;
      }, []);
      const trackSections = await getTrackSectionsByIds(trackIds);

      const startDatetime = new Date(train.start_time);
      let lastReferenceDate = startDatetime;

      return new Map(
        train.path.map((pathStep, stepIndex) => {
          const matchingOperationalPoint = pathStepOps.find((op) => matchOpRefAndOp(op, pathStep));

          const name = getOperationalPointName(
            matchingOperationalPoint,
            pathStep,
            stepIndex,
            train.path.length,
            t
          );
          const trackName =
            'track' in pathStep
              ? trackSections[pathStep.track]?.extensions?.sncf?.track_name
              : getTrackReferenceLabel(pathStep.track_reference);

          const schedule = scheduleByAt[pathStep.id];
          const computedArrival = simulatedPathItemTimes
            ? new Date(startDatetime.getTime() + simulatedPathItemTimes.final[stepIndex])
            : undefined;
          const { stopFor, shortSlipDistance, onStopSignal, calculatedDeparture } = formatSchedule(
            computedArrival,
            schedule
          );
          const { theoreticalArrival, arrival, departure, refDate } = computeInputDatetimes(
            startDatetime,
            lastReferenceDate,
            schedule,
            {
              isDeparture: stepIndex === 0,
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
            train,
            scheduleByAt,
            stepIndex,
            simulatedPathItemTimes
          );

          const isOnTime =
            theoreticalArrival && computedArrival
              ? Duration.subtractDate(theoreticalArrival, computedArrival).abs() <=
                ARRIVAL_TIME_ACCEPTABLE_ERROR
              : false;
          const calculatedArrival = computedArrival
            ? isOnTime
              ? theoreticalArrival!
              : computedArrival
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
      if (!selectedTrain) {
        setRows([]);
        return;
      }

      const pathStepRowsById = await formatPathStepRows(selectedTrain);

      let formattedRows: TimesStopsRow[] = [];

      // For valid trains, complete the rows with the simulated path's operational points and tracks information
      if (isValid && simulatedTrain && operationalPointsOnPath) {
        const trackIds = operationalPointsOnPath.map((op) => op.part.track);
        const trackSectionsOnPath = await getTrackSectionsByIds(trackIds);

        for (const op of operationalPointsOnPath) {
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
            formattedRows.push({
              ...matchingPathStepRow,
              trackName,
            });
          } else if (!displayOnlyPathSteps) {
            // Compute arrival time when the operational point comes from the simulation
            const matchingReportTrainIndex = simulatedTrain.positions.findIndex(
              (position) => position === op.position
            );
            const time =
              matchingReportTrainIndex === -1
                ? interpolateValue(simulatedTrain, op.position, 'times')
                : simulatedTrain.times[matchingReportTrainIndex];
            const calculatedArrival = new Date(new Date(selectedTrain.start_time).getTime() + time);

            formattedRows.push({
              opId: op.id,
              pathStepId: undefined,
              name: op.extensions?.identifier?.name,
              ch: op.extensions?.sncf?.ch,
              trackName,
              calculatedArrival,
            });
          }
        }
      } else {
        formattedRows = Array.from(pathStepRowsById.values());
      }

      setRows(formattedRows);
    };

    formatRows();
  }, [
    pathStepOps,
    operationalPointsOnPath,
    simulatedTrain,
    getTrackSectionsByIds,
    displayOnlyPathSteps,
  ]);

  return rows;
};

export default useOutputTableData;
