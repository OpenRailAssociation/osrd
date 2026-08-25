import type { ScheduleItem } from 'common/api/osrdEditoastApi';
import type { SimulationSummary } from 'modules/trainSchedule/types';
import type { Train } from 'reducers/osrdconf/types';
import { Duration } from 'utils/duration';
import { ms2sec } from 'utils/timeManipulation';

import { marginsUndefined, MarginUnit } from '../consts';
import type {
  Margins,
  MarginsCore,
  MarginsCoreComputed,
  MarginValue,
  TheoreticalMarginsRecord,
} from '../types';

type PathItemTimes = Extract<SimulationSummary, { isValid: true }>['pathItemTimes'];

function parseMarginValue(raw: string): MarginValue {
  if (raw.endsWith('%')) return { value: parseFloat(raw), unit: MarginUnit.percent };
  if (raw.endsWith('min/100km')) return { value: parseFloat(raw), unit: MarginUnit.minPer100km };
  return { value: parseFloat(raw), unit: MarginUnit.second };
}

function isCoreComputed(core: MarginsCore): core is MarginsCoreComputed {
  return core !== null && 'provisionalLostTime' in core;
}

const parseIsoToMs = (iso: string | null | undefined) => (iso ? Duration.parse(iso).ms : undefined);

function computeMarginsWithoutPathItemTimes(
  isOrigin: boolean,
  theoreticalMargin: MarginValue,
  nextSchedule?: ScheduleItem,
  schedule?: ScheduleItem
) {
  const refBaseArrival = isOrigin ? 0 : parseIsoToMs(schedule?.reference_base_arrival);
  const arrival = isOrigin ? 0 : parseIsoToMs(schedule?.arrival);
  const nextRefBaseArrival = parseIsoToMs(nextSchedule?.reference_base_arrival);
  const nextArrival = parseIsoToMs(nextSchedule?.arrival);

  if (refBaseArrival === undefined || nextRefBaseArrival === undefined) {
    return { provisionalLostTime: undefined, finalLostTime: undefined };
  }

  const refBaseDuration = nextRefBaseArrival - refBaseArrival;
  return {
    // TODO: handle min/100km margin
    provisionalLostTime: Math.round(ms2sec(refBaseDuration) * (theoreticalMargin.value / 100)),
    finalLostTime:
      arrival !== undefined && nextArrival !== undefined
        ? Math.round(ms2sec(nextArrival - arrival - refBaseDuration))
        : undefined,
  };
}

/** Extracts the theoretical margin for each path step in the train schedule,
 * and marks whether margins are repeated or correspond to a boundary between margin values */
export function getTheoreticalMargins(
  train: Pick<Train, 'margins' | 'path'>
): TheoreticalMarginsRecord | undefined {
  const { margins } = train;
  if (!margins) return undefined;

  const theoreticalMargins: TheoreticalMarginsRecord = {};
  let marginIndex = 0;

  train.path.forEach((step, index) => {
    let isBoundary = index === 0;
    if (step.key === margins.boundaries[marginIndex]) {
      marginIndex += 1;
      isBoundary = true;
    }
    theoreticalMargins[step.key] = {
      theoreticalMargin: margins.values[marginIndex],
      isBoundary,
    };
  });

  return theoreticalMargins;
}

/** Compute all margins to display for a given train schedule path step */
function computeMarginsCore(
  theoreticalMargins: TheoreticalMarginsRecord | undefined,
  train: Pick<Train, 'path' | 'margins'>,
  scheduleByAt: Record<string, ScheduleItem>,
  pathStepIndex: number,
  pathItemTimes: PathItemTimes | undefined
): MarginsCore {
  const { path, margins } = train;
  const pathStepKey = path[pathStepIndex].key;
  const schedule = scheduleByAt[pathStepKey];
  const stepTheoreticalMarginInfo = theoreticalMargins?.[pathStepKey];

  if (
    !margins ||
    pathStepIndex === path.length - 1 ||
    !stepTheoreticalMarginInfo ||
    !(schedule?.arrival || stepTheoreticalMarginInfo.isBoundary)
  )
    return null;

  const { theoreticalMargin: rawMargin, isBoundary } = stepTheoreticalMarginInfo;
  const theoreticalMargin = parseMarginValue(rawMargin);

  // find the next pathStep where constraints are defined
  let nextIndex = path.length - 1;

  for (let index = pathStepIndex + 1; index < path.length; index += 1) {
    const curStepKey = path[index].key;
    if (
      theoreticalMargins?.[curStepKey]?.isBoundary ||
      scheduleByAt[curStepKey]?.arrival ||
      scheduleByAt[curStepKey]?.reference_base_arrival
    ) {
      nextIndex = index;
      break;
    }
  }

  if (!pathItemTimes) {
    const nextPathStepKey = path[nextIndex].key;
    const nextSchedule = scheduleByAt[nextPathStepKey];

    const { provisionalLostTime, finalLostTime } = computeMarginsWithoutPathItemTimes(
      pathStepIndex === 0,
      theoreticalMargin,
      nextSchedule,
      schedule
    );

    return {
      finalLostTime,
      provisionalLostTime,
      theoreticalMargin,
      isBoundary,
    };
  }

  // durations to go from the last pathStep with theoretical margin to the next pathStep
  // base = no margin
  // provisional = margins
  // final = margins + requested arrival times
  const { base, provisional, final } = pathItemTimes;
  const baseDuration = ms2sec(base[nextIndex] - base[pathStepIndex]);
  const provisionalDuration = ms2sec(provisional[nextIndex] - provisional[pathStepIndex]);
  const finalDuration = ms2sec(final[nextIndex] - final[pathStepIndex]);

  // how much longer it took (s) with the margin than without
  const provisionalLostTime = Math.round(provisionalDuration - baseDuration);
  const finalLostTime = Math.round(finalDuration - baseDuration);

  return { theoreticalMargin, isBoundary, provisionalLostTime, finalLostTime };
}

export function computeMargins(
  theoreticalMargins: TheoreticalMarginsRecord | undefined,
  train: Pick<Train, 'path' | 'margins'>,
  scheduleByAt: Record<string, ScheduleItem>,
  pathStepIndex: number,
  pathItemTimes: PathItemTimes | undefined
): Margins {
  const core = computeMarginsCore(
    theoreticalMargins,
    train,
    scheduleByAt,
    pathStepIndex,
    pathItemTimes
  );
  if (!core) return marginsUndefined;

  if (!isCoreComputed(core)) return marginsUndefined;
  const { theoreticalMargin, isBoundary, provisionalLostTime, finalLostTime } = core;
  const diffMargins = finalLostTime - provisionalLostTime;

  return {
    theoreticalMargin,
    isTheoreticalMarginBoundary: isBoundary,
    theoreticalMarginSeconds: { value: provisionalLostTime, unit: MarginUnit.second },
    calculatedMargin: { value: finalLostTime, unit: MarginUnit.second },
    diffMargins: { value: diffMargins, unit: MarginUnit.second },
  };
}
