import { useEffect, useState, useMemo, useRef } from 'react';

import { keyBy } from 'lodash';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import usePathOps from 'applications/operationalStudies/hooks/usePathOps';
import { useScenarioContext } from 'applications/operationalStudies/hooks/useScenarioContext';
import type { PathPropertiesFormatted } from 'applications/operationalStudies/types';
import type {
  PathItemLocation,
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

import { buildOpMatchParams, getOperationalPointName } from '../helpers/utils';
import type { TimesStopsRowNew } from '../types';

type BuildTableRowParams = {
  id: string;
  opOnPathIndex: number;
  name?: string;
  secondaryCode?: string;
  trackName?: string;
  hasRequestedTrack?: boolean;
  startDate: Date;
  schedule?: ScheduleItem;
  computedArrival?: Duration;
  invalidPathStep?: boolean;
  scheduleNotHonored?: boolean;
  marginNotHonored?: boolean;
  location: PathItemLocation;
};

const buildTableRow = ({
  id,
  opOnPathIndex,
  name,
  secondaryCode,
  trackName,
  hasRequestedTrack = false,
  startDate,
  schedule,
  computedArrival,
  invalidPathStep,
  scheduleNotHonored,
  marginNotHonored,
  location,
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
    isPathStep: true,
    hasRequestedTrack,
    location,
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
  isSimulationDataLoading: boolean,
  selectedTrain: Train,
  simulatedTrain?: SimulationResponseSuccess['final_output'],
  simulatedPathItemTimes?: Extract<SimulationSummary, { isValid: true }>['pathItemTimes'],
  simulatedPathItemRespect?: Extract<SimulationSummary, { isValid: true }>['pathItemRespect'],
  operationalPointsOnPath?: PathPropertiesFormatted['operationalPoints']
): { rows: TimesStopsRowNew[]; stableIsValid: boolean } => {
  const { t } = useTranslation('operational-studies');
  const { getTrackSectionsByIds } = useScenarioContext();
  const displayOnlyPathSteps = useSelector(getDisplayOnlyPathSteps);

  // Stale-while-revalidate: keep the last known-good simulation props in a ref so the table
  // doesn't flash back to path-step-only view during the brief window where RTK Query sets
  // currentData = undefined while refetching (e.g. operationalPointsOnPath goes undefined
  // between a path change and the new response arriving).
  // Three cases:
  //   isValid=true              → snapshot the props (they are consistent)
  //   isValid=false, fetching   → use the snapshot (transitional, data is reloading)
  //   isValid=false, not fetching → clear the snapshot (genuinely invalid simulation)
  const lastSimRef = useRef<{
    simulatedTrain: typeof simulatedTrain;
    simulatedPathItemTimes: typeof simulatedPathItemTimes;
    simulatedPathItemRespect: typeof simulatedPathItemRespect;
    operationalPointsOnPath: typeof operationalPointsOnPath;
  } | null>(null);

  // Invalidate the snapshot on train switch to avoid briefly showing the previous train's data.
  const prevTrainIdRef = useRef(selectedTrain.id);
  if (prevTrainIdRef.current !== selectedTrain.id) {
    prevTrainIdRef.current = selectedTrain.id;
    lastSimRef.current = null;
  }

  if (isValid) {
    lastSimRef.current = {
      simulatedTrain,
      simulatedPathItemTimes,
      simulatedPathItemRespect,
      operationalPointsOnPath,
    };
  } else if (!isSimulationDataLoading) {
    // Not fetching and not valid — the simulation is genuinely invalid, discard stale data.
    lastSimRef.current = null;
  }

  // Only use the snapshot while a fetch is in progress (transitional invalid state).
  const snapshot = isSimulationDataLoading ? lastSimRef.current : undefined;
  const stableIsValid = isValid || !!snapshot;

  const stableTrain = simulatedTrain ?? snapshot?.simulatedTrain;
  const stablePathItemTimes = simulatedPathItemTimes ?? snapshot?.simulatedPathItemTimes;
  const stablePathItemRespect = simulatedPathItemRespect ?? snapshot?.simulatedPathItemRespect;
  const stableOPs = operationalPointsOnPath ?? snapshot?.operationalPointsOnPath;

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
        const matchingOp = pathStepOps.get(pathStep.id)?.at(0);

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

        const hasRequestedTrack =
          'track' in pathStepLocation || !!pathStepLocation.local_track_name;

        const schedule = scheduleByAt[pathStep.id];
        const computedArrival =
          stablePathItemTimes?.final[stepIndex] !== undefined
            ? new Duration({ milliseconds: stablePathItemTimes.final[stepIndex] })
            : undefined;
        const scheduleNotHonored = stableIsValid && !stablePathItemRespect?.times[stepIndex];
        // The back end returns the status at the end of the interval but we want to display the information at the beginning of the interval so we check the next path items status
        const marginNotHonored =
          stableIsValid &&
          stepIndex < selectedTrain.path.length - 1 &&
          !stablePathItemRespect?.margins[stepIndex + 1];

        const row = buildTableRow({
          id: pathStep.id,
          // opOnPathIndex is a placeholder here (-1), it will be replaced by opIndex when matching with operationalPointsOnPath
          opOnPathIndex: -1,
          name,
          secondaryCode: matchingOp?.extensions?.sncf?.ch,
          trackName,
          hasRequestedTrack,
          startDate,
          schedule,
          computedArrival,
          invalidPathStep: !matchingOp,
          scheduleNotHonored,
          marginNotHonored,
          location: pathStep.location,
        });

        return [pathStep.id, row];
      })
    );

    let formattedRows: TimesStopsRowNew[] = [];

    // Case 1: Valid train with simulation results
    if (stableIsValid && stableTrain && stableOPs) {
      stableOPs.forEach((op, opIndex) => {
        const trackName = op.part.local_track_name;

        const matchingPathStep = selectedTrain.path.find((pathStep) =>
          matchPathStepAndOp(pathStep.location, buildOpMatchParams(op))
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
          const matchingReportTrainIndex = stableTrain.positions.findIndex(
            (position) => position === op.position
          );
          const computedArrivalMs =
            matchingReportTrainIndex === -1
              ? interpolateValue(stableTrain, op.position, 'times')
              : stableTrain.times[matchingReportTrainIndex];
          const computedArrival =
            computedArrivalMs !== undefined
              ? new Duration({ milliseconds: computedArrivalMs })
              : undefined;

          formattedRows.push({
            ...buildTableRow({
              id: op.id,
              opOnPathIndex: opIndex,
              name: op.extensions?.identifier?.name,
              secondaryCode: op.extensions?.sncf?.ch,
              trackName,
              startDate,
              computedArrival,
              // Build location from OP data for creating a new PathItem if user edits this row
              // OPs on path always have a UIC identifier
              location: {
                operational_point: {
                  type: 'uic',
                  uic: op.extensions!.identifier!.uic,
                  secondary_code: op.extensions?.sncf?.ch ?? null,
                },
                local_track_name: op.part.local_track_name,
              },
            }),
            isPathStep: false,
          });
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
    stableIsValid,
    stableTrain,
    stableOPs,
    stablePathItemTimes,
    stablePathItemRespect,
    trackSections,
    pathStepOps,
    displayOnlyPathSteps,
    t,
  ]);

  return { rows, stableIsValid };
};

export default useTimesStopsTableData;
