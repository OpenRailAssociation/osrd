import { useEffect, useState, useMemo } from 'react';

import { keyBy } from 'lodash';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import usePathOps from 'applications/operationalStudies/hooks/usePathOps';
import { useScenarioContext } from 'applications/operationalStudies/hooks/useScenarioContext';
import type { PathPropertiesFormatted } from 'applications/operationalStudies/types';
import { matchOpRefAndOp } from 'applications/operationalStudies/utils';
import type {
  SimulationResponseSuccess,
  TrackSection,
  ScheduleItem,
} from 'common/api/osrdEditoastApi';
import { matchPathStepAndOp } from 'modules/pathfinding/utils';
import { interpolateValue } from 'modules/simulationResult/helpers/utils';
import type { SimulationSummary } from 'modules/timetableItem/types';
import type { Train } from 'reducers/osrdconf/types';
import { getDisplayOnlyPathSteps } from 'reducers/simulationResults/selectors';
import { Duration } from 'utils/duration';

import { getOperationalPointName } from '../helpers/utils';
import type { TimesStopsRowNew } from '../types';

type BuildTableRowParams = {
  id: string;
  opOnPathIndex: number;
  name?: string;
  secondaryCode?: string;
  trackName?: string;
  startDate: Date;
  schedule?: ScheduleItem;
  computedArrival?: Duration;
  invalidPathStep?: boolean;
  scheduleNotHonored?: boolean;
  marginNotHonored?: boolean;
  isPathStep?: boolean;
};

const buildTableRow = ({
  id,
  opOnPathIndex,
  name,
  secondaryCode,
  trackName,
  startDate,
  schedule,
  computedArrival,
  invalidPathStep,
  scheduleNotHonored,
  marginNotHonored,
  isPathStep,
}: BuildTableRowParams): TimesStopsRowNew => {
  const requestedArrival = schedule?.arrival
    ? new Date(startDate.getTime() + Duration.parse(schedule.arrival).ms)
    : null;

  // computedArrival is offset from startDate
  const computedArrivalDate =
    computedArrival !== undefined ? new Date(startDate.getTime() + computedArrival.ms) : null;

  // schedule.stop_for is ISO 8601 duration
  const stopDuration = schedule?.stop_for ? Duration.parse(schedule.stop_for) : null;

  // requestedDeparture = requestedArrival + stopDuration
  const requestedDeparture =
    requestedArrival && stopDuration !== null
      ? new Date(requestedArrival.getTime() + stopDuration.ms)
      : null;

  // computedDeparture = computedArrival + stopDuration
  const computedDeparture =
    computedArrivalDate && stopDuration !== null
      ? new Date(computedArrivalDate.getTime() + stopDuration.ms)
      : null;

  return {
    id,
    opOnPathIndex,
    name: name ?? '',
    secondaryCode: secondaryCode ?? '',
    track: trackName ?? '',
    requestedArrival,
    computedArrival: computedArrivalDate,
    stopDuration,
    requestedDeparture,
    computedDeparture,
    invalidPathStep,
    scheduleNotHonored,
    marginNotHonored,
    isPathStep,
  };
};

/**
 * Hook to build TableRow[] for the new Times & Stops table (TimesStopsTableNew).
 * This is separate from useOutputTableData to keep the legacy and new logic independent.
 * Once the new table is fully validated, useOutputTableData can be removed.
 */
const useTimesStopsTableData = (
  infraId: number,
  isValid: boolean,
  selectedTrain: Train,
  simulatedTrain?: SimulationResponseSuccess['final_output'],
  simulatedPathItemTimes?: Extract<SimulationSummary, { isValid: true }>['pathItemTimes'],
  simulatedPathItemRespect?: Extract<SimulationSummary, { isValid: true }>['pathItemRespect'],
  operationalPointsOnPath?: PathPropertiesFormatted['operationalPoints']
): TimesStopsRowNew[] => {
  const { t } = useTranslation('operational-studies');
  const { getTrackSectionsByIds } = useScenarioContext();
  const displayOnlyPathSteps = useSelector(getDisplayOnlyPathSteps);

  const pathStepOps = usePathOps(infraId, selectedTrain.path);

  const trackIds = useMemo(() => {
    const trackIdsInPathSteps: string[] = [];
    for (const { location } of selectedTrain.path) {
      if ('track' in location) trackIdsInPathSteps.push(location.track);
    }
    const trackIdsOnPath = (operationalPointsOnPath || []).map((op) => op.part.track);
    return [...trackIdsInPathSteps, ...trackIdsOnPath];
  }, [selectedTrain.path, operationalPointsOnPath]);

  const [trackSections, setTrackSections] = useState<Record<string, TrackSection>>({});
  useEffect(() => {
    const fetchTrackSections = async () => {
      const sections = await getTrackSectionsByIds(trackIds);
      setTrackSections(sections);
    };
    fetchTrackSections();
  }, [trackIds]);

  const rows = useMemo(() => {
    const startDate = new Date(selectedTrain.start_time);
    const scheduleByAt = keyBy(selectedTrain.schedule, 'at');

    const pathStepRowsById = new Map(
      selectedTrain.path.map((pathStep, stepIndex) => {
        const matchingOp = pathStepOps.find((op) => matchOpRefAndOp(pathStep.location, op));

        const name = getOperationalPointName(
          matchingOp,
          pathStep.location,
          stepIndex,
          selectedTrain.path.length,
          t
        );

        const pathStepLocation = pathStep.location;

        const trackName =
          'track' in pathStepLocation
            ? matchingOp?.parts.find((part) => part.track === pathStepLocation.track)
                ?.local_track_name
            : (pathStepLocation.local_track_name ?? undefined);

        const schedule = scheduleByAt[pathStep.id];
        const computedArrival =
          simulatedPathItemTimes?.final[stepIndex] !== undefined
            ? new Duration({ milliseconds: simulatedPathItemTimes.final[stepIndex] })
            : undefined;
        const scheduleNotHonored = isValid && !simulatedPathItemRespect?.times[stepIndex];
        // The back end returns the status at the end of the interval but we want to display the information at the beginning of the interval so we check the next path items status
        const marginNotHonored =
          isValid &&
          stepIndex < selectedTrain.path.length - 1 &&
          !simulatedPathItemRespect?.margins[stepIndex + 1];

        const row = buildTableRow({
          id: pathStep.id,
          // opOnPathIndex is a placeholder here (-1), it will be replaced by opIndex when matching with operationalPointsOnPath
          opOnPathIndex: -1,
          name,
          secondaryCode: matchingOp?.extensions?.sncf?.ch,
          trackName,
          startDate,
          schedule,
          computedArrival,
          invalidPathStep: !matchingOp,
          scheduleNotHonored,
          marginNotHonored,
          isPathStep: true,
        });

        return [pathStep.id, row];
      })
    );

    let formattedRows: TimesStopsRowNew[] = [];

    // Case 1: Valid train with simulation results
    if (isValid && simulatedTrain && operationalPointsOnPath) {
      operationalPointsOnPath.forEach((op, opIndex) => {
        const trackName = op.part.local_track_name;

        const matchingPathStep = selectedTrain.path.find((pathStep) =>
          matchPathStepAndOp(pathStep.location, {
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
            track: trackName,
            opOnPathIndex: opIndex,
          });
        } else if (!displayOnlyPathSteps) {
          const matchingReportTrainIndex = simulatedTrain.positions.findIndex(
            (position) => position === op.position
          );
          const computedArrivalMs =
            matchingReportTrainIndex === -1
              ? interpolateValue(simulatedTrain, op.position, 'times')
              : simulatedTrain.times[matchingReportTrainIndex];
          const computedArrival =
            computedArrivalMs !== undefined
              ? new Duration({ milliseconds: computedArrivalMs })
              : undefined;

          formattedRows.push(
            buildTableRow({
              id: op.id,
              opOnPathIndex: opIndex,
              name: op.extensions?.identifier?.name,
              secondaryCode: op.extensions?.sncf?.ch,
              trackName,
              startDate,
              computedArrival,
              isPathStep: false,
            })
          );
        }
      });
    } else {
      formattedRows = Array.from(pathStepRowsById.values()).map((row, rowIndex) => ({
        ...row,
        opOnPathIndex: rowIndex,
      }));
    }

    // The first row has no schedule.arrival, so we set requestedArrival to startDate.
    if (formattedRows.length > 0 && !formattedRows[0].requestedArrival) {
      formattedRows[0] = { ...formattedRows[0], requestedArrival: startDate };
    }

    return formattedRows;
  }, [
    selectedTrain,
    isValid,
    simulatedTrain,
    operationalPointsOnPath,
    simulatedPathItemTimes,
    trackSections,
    pathStepOps,
    displayOnlyPathSteps,
    t,
  ]);

  return rows;
};

export default useTimesStopsTableData;
