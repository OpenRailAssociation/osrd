import { useEffect, useState, useMemo, useRef } from 'react';

import { keyBy } from 'lodash';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import usePathOps from 'applications/operationalStudies/hooks/usePathOps';
import { useScenarioContext } from 'applications/operationalStudies/hooks/useScenarioContext';
import type { PathPropertiesFormatted } from 'applications/operationalStudies/types';
import type {
  PathItemLocation,
  PowerRestrictionItem,
  SimulationResponseSuccess,
  TrackSection,
  ScheduleItem,
} from 'common/api/osrdEditoastApi';
import { matchPathStepAndOp } from 'modules/pathfinding/utils';
import { interpolateValue } from 'modules/simulationResult/helpers/utils';
import type { SimulationSummary } from 'modules/trainSchedule/types';
import type { Train } from 'reducers/osrdconf/types';
import { getDisplayOnlyPathSteps } from 'reducers/simulationResults/selectors';
import { Duration } from 'utils/duration';

import { ARRIVAL_TIME_ACCEPTABLE_ERROR, marginsUndefined } from '../consts';
import { computeMargins, getTheoreticalMargins } from '../helpers/computeMargins';
import {
  buildOpMatchParams,
  getOperationalPointName,
  receptionSignalToSignalBooleans,
} from '../helpers/utils';
import { type Margins, type StepStatus, type TimesStopsRowNew } from '../types';

/**
 * Returns the power restriction code that explicitly STARTS at a given path step index,
 * or null if no restriction starts here (even if one is active from a previous step).
 */
const getPowerRestrictionForPathStep = (
  stepIndex: number,
  pathIdToIndex: Map<string, number>,
  powerRestrictions: PowerRestrictionItem[] | undefined
): string | null => {
  if (!powerRestrictions) return null;
  for (const restriction of powerRestrictions) {
    const fromIndex = pathIdToIndex.get(restriction.from);
    if (fromIndex === stepIndex) return restriction.value;
  }
  return null;
};

type BuildTableRowParams = {
  id: string;
  pathStepId: string | null;
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
  powerRestriction?: string | null;
  location: PathItemLocation;
  shortSlipDistance?: boolean;
  closedSignal?: boolean;
  margins?: Margins;
};

const buildTableRow = ({
  id,
  pathStepId,
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
  powerRestriction = null,
  location,
  shortSlipDistance,
  closedSignal,
  margins,
}: BuildTableRowParams): TimesStopsRowNew => {
  const requestedArrival = schedule?.arrival
    ? new Date(startDate.getTime() + Duration.parse(schedule.arrival).ms)
    : null;

  // computedArrival is offset from startDate
  const rawComputedArrivalDate =
    computedArrival !== undefined ? new Date(startDate.getTime() + computedArrival.ms) : null;

  // Snap to requested arrival when within tolerance, consistent with the legacy table behavior.
  const isOnTime =
    requestedArrival && rawComputedArrivalDate
      ? Duration.subtractDate(requestedArrival, rawComputedArrivalDate).abs() <=
        ARRIVAL_TIME_ACCEPTABLE_ERROR
      : false;
  const computedArrivalDate = isOnTime ? requestedArrival : rawComputedArrivalDate;

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

  const {
    theoreticalMargin,
    isTheoreticalMarginBoundary,
    theoreticalMarginSeconds,
    calculatedMargin,
    diffMargins,
  } = margins ?? marginsUndefined;

  let stepStatus: StepStatus = 'allHonored';

  if (invalidPathStep) {
    stepStatus = 'invalidPathStep';
  } else if (scheduleNotHonored) {
    stepStatus = 'scheduleNotHonored';
  } else if (marginNotHonored) {
    stepStatus = 'marginNotHonored';
  }

  return {
    id,
    pathStepId,
    stepStatus,
    opOnPathIndex,
    name: name ?? '',
    secondaryCode: secondaryCode ?? '',
    track: trackName ?? '',
    requestedArrival,
    computedArrival: computedArrivalDate,
    stopDuration,
    requestedDeparture,
    computedDeparture,
    hasRequestedTrack,
    location,
    closedSignal,
    shortSlipDistance,
    powerRestriction,
    requestedTheoreticalMargin: theoreticalMargin,
    isTheoreticalMarginBoundary: isTheoreticalMarginBoundary,
    computedTheoreticalMarginSeconds: theoreticalMarginSeconds,
    realMargin: calculatedMargin,
    marginsDifference: diffMargins,
    timeFromPreviousOp: null, // TODO : Idem
    totalTravelTime: null, // TODO : Idem
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
      if (location.type === 'track_offset') trackIdsInPathSteps.push(location.track);
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

  const allRows = useMemo(() => {
    const startDate = new Date(selectedTrain.start_time);
    const scheduleByAt = keyBy(selectedTrain.schedule, 'at');
    const pathIdToIndex = new Map(selectedTrain.path.map((step, idx) => [step.id, idx]));

    const pathStepRowsById = new Map(
      selectedTrain.path.map((pathStep, stepIndex) => {
        const pathStepOp = pathStepOps.get(pathStep.id)?.at(0);

        const matchingOp =
          pathStepOp ??
          ('operational_point' in pathStep.location && stableOPs
            ? stableOPs.find((op) => matchPathStepAndOp(pathStep.location, buildOpMatchParams(op)))
            : undefined);

        const name =
          matchingOp?.extensions?.identifier?.name ??
          getOperationalPointName(
            pathStepOp,
            pathStep.location,
            stepIndex,
            selectedTrain.path.length,
            t
          );

        const pathStepLocation = pathStep.location;

        // pathStepOp?.parts is only valid for RelatedOperationalPoint (track-offset steps);
        // the stableOPs fallback never applies for those since it requires 'operational_point' in location.
        const trackName =
          pathStepLocation.type === 'track_offset'
            ? trackSections[pathStepLocation.track]?.extensions?.sncf?.track_name
            : (pathStepLocation.local_track_name ?? undefined);

        const hasRequestedTrack =
          pathStepLocation.type === 'track_offset' || !!pathStepLocation.local_track_name;

        const schedule = { ...scheduleByAt[pathStep.id] };
        if (stepIndex === 0) schedule.arrival = 'PT0S'; // The first step has no stored scheduled arrival as redundant with start date
        const computedArrival =
          stablePathItemTimes?.final[stepIndex] !== undefined
            ? new Duration({
                milliseconds: stablePathItemTimes.final[stepIndex],
              })
            : undefined;
        const scheduleNotHonored = stableIsValid && !stablePathItemRespect?.times[stepIndex];
        const marginNotHonored = stableIsValid && !stablePathItemRespect?.margins[stepIndex];
        const margins = computeMargins(
          getTheoreticalMargins(selectedTrain),
          selectedTrain,
          scheduleByAt,
          stepIndex,
          stablePathItemTimes
        );

        const { shortSlipDistance, onStopSignal } = receptionSignalToSignalBooleans(
          schedule?.reception_signal
        );

        const powerRestriction = getPowerRestrictionForPathStep(
          stepIndex,
          pathIdToIndex,
          selectedTrain.power_restrictions
        );

        const row = buildTableRow({
          id: `path-step-${pathStep.id}`,
          pathStepId: pathStep.id,
          // opOnPathIndex is a placeholder here (-1), it will be replaced by opIndex when matching with operationalPointsOnPath
          opOnPathIndex: -1,
          name,
          secondaryCode: matchingOp?.extensions?.sncf?.ch,
          trackName,
          hasRequestedTrack,
          startDate,
          schedule,
          computedArrival,
          invalidPathStep:
            !matchingOp && pathStepLocation.type === 'operational_point_part_reference',
          scheduleNotHonored,
          marginNotHonored,
          powerRestriction,
          location: pathStep.location,
          shortSlipDistance,
          closedSignal: onStopSignal,
          margins,
        });

        return [pathStep.id, row];
      })
    );

    let formattedRows: TimesStopsRowNew[] = [];

    // Case 1: Path is known show all OPs on path (intermediate OPs included).
    // Computed arrival times are only filled in when simulation results are available.
    if (stableOPs) {
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
        } else {
          let computedArrival: Duration | undefined;
          if (stableTrain) {
            const matchingReportTrainIndex = stableTrain.positions.findIndex(
              (position) => position === op.position
            );
            const computedArrivalMs =
              matchingReportTrainIndex === -1
                ? interpolateValue(stableTrain, op.position, 'times')
                : stableTrain.times[matchingReportTrainIndex];
            computedArrival =
              computedArrivalMs !== undefined
                ? new Duration({ milliseconds: computedArrivalMs })
                : undefined;
          }

          const receptionSignal = scheduleByAt[op.id]?.reception_signal;

          const { shortSlipDistance, onStopSignal } =
            receptionSignalToSignalBooleans(receptionSignal);

          formattedRows.push({
            ...buildTableRow({
              id: `op-${op.id}-${op.position}`,
              pathStepId: null,
              opOnPathIndex: opIndex,
              name: op.extensions?.identifier?.name,
              secondaryCode: op.extensions?.sncf?.ch,
              trackName,
              startDate,
              computedArrival,
              shortSlipDistance,
              closedSignal: onStopSignal,
              // Build location from OP data for creating a new PathItem if user edits this row
              // OPs on path always have a UIC identifier
              location: {
                type: 'operational_point_part_reference',
                operational_point: {
                  type: 'uic',
                  uic: op.extensions!.identifier!.uic,
                  secondary_code: op.extensions?.sncf?.ch ?? null,
                },
                local_track_name: op.part.local_track_name,
              },
            }),
          });
        }
      });
    } else {
      formattedRows = Array.from(pathStepRowsById.values()).map((row, rowIndex) => ({
        ...row,
        opOnPathIndex: rowIndex,
      }));
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
    t,
  ]);

  const filteredRows = useMemo(
    () => (displayOnlyPathSteps ? allRows.filter((row) => row.pathStepId) : allRows),
    [allRows, displayOnlyPathSteps]
  );

  return { rows: filteredRows, stableIsValid };
};

export default useTimesStopsTableData;
