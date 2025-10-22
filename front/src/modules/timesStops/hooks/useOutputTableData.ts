import { useEffect, useState, useMemo } from 'react';

import { keyBy } from 'lodash';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import usePathOps from 'applications/operationalStudies/hooks/usePathOps';
import { useScenarioContext } from 'applications/operationalStudies/hooks/useScenarioContext';
import type { PathPropertiesFormatted } from 'applications/operationalStudies/types';
import { matchOpRefAndOp } from 'applications/operationalStudies/utils';
import type { SimulationResponseSuccess, TrackSection } from 'common/api/osrdEditoastApi';
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
import { getTrackReferenceLabel, getOperationalPointName } from '../helpers/utils';
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

  const pathStepOps = usePathOps(infraId, selectedTrain?.path);

  const trackIds = useMemo(() => {
    const path = selectedTrain?.path || [];
    const trackIdsInPathSteps = path.flatMap((step) => [
      ...('track' in step ? [step.track] : []),
      ...('track_reference' in step && step.track_reference && 'track_id' in step.track_reference
        ? [step.track_reference.track_id]
        : []),
    ]);
    const trackIdsOnPath = (operationalPointsOnPath || []).map((op) => op.part.track);
    return [...trackIdsInPathSteps, ...trackIdsOnPath];
  }, [selectedTrain?.path, operationalPointsOnPath]);

  const [trackSections, setTrackSections] = useState<Record<string, TrackSection>>({});
  useEffect(() => {
    const fetchTrackSections = async () => {
      const sections = await getTrackSectionsByIds(trackIds);
      setTrackSections(sections);
    };
    fetchTrackSections();
  }, [trackIds]);

  // Format input path step rows
  const rows = useMemo(() => {
    if (!selectedTrain) {
      return [];
    }

    // Extract common properties between valid and invalid trains
    const scheduleByAt: Record<string, ScheduleEntry> = keyBy(selectedTrain.schedule, 'at');
    const theoreticalMargins = selectedTrain && getTheoreticalMargins(selectedTrain);

    const startDatetime = new Date(selectedTrain.start_time);
    let lastReferenceDate = startDatetime;

    const pathStepRowsById = new Map(
      selectedTrain.path.map((pathStep, stepIndex) => {
        const matchingOperationalPoint = pathStepOps.find((op) => matchOpRefAndOp(pathStep, op));

        const name = getOperationalPointName(
          matchingOperationalPoint,
          pathStep,
          stepIndex,
          selectedTrain.path.length,
          t
        );
        const trackName =
          'track' in pathStep
            ? trackSections[pathStep.track]?.extensions?.sncf?.track_name
            : getTrackReferenceLabel(trackSections, pathStep.track_reference);

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
          selectedTrain,
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

    let formattedRows: TimesStopsRow[] = [];

    // For valid trains, complete the rows with the simulated path's operational points and tracks information
    if (isValid && simulatedTrain && operationalPointsOnPath) {
      for (const op of operationalPointsOnPath) {
        const trackName = trackSections[op.part.track]?.extensions?.sncf?.track_name;

        // early return if the op matches a pathStep (handled above)
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

    return formattedRows;
  }, [
    selectedTrain,
    pathStepOps,
    operationalPointsOnPath,
    simulatedTrain,
    getTrackSectionsByIds,
    displayOnlyPathSteps,
    trackSections,
  ]);

  return rows;
};

export default useOutputTableData;
