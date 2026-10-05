import type { ScheduleItem } from 'common/api/osrdEditoastApi';
import type { SimulationSummary } from 'modules/trainSchedule/types';
import type { Train } from 'reducers/osrdconf/types';
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
  const pathStepId = path[pathStepIndex].key;
  const schedule = scheduleByAt[pathStepId];
  const stepTheoreticalMarginInfo = theoreticalMargins?.[pathStepId];

  if (
    !margins ||
    pathStepIndex === path.length - 1 ||
    !stepTheoreticalMarginInfo ||
    !(schedule?.arrival || stepTheoreticalMarginInfo.isBoundary)
  )
    return null;

  const { theoreticalMargin: rawMargin, isBoundary } = stepTheoreticalMarginInfo;
  const theoreticalMargin = parseMarginValue(rawMargin);

  if (!pathItemTimes) return { theoreticalMargin, isBoundary };

  // find the next pathStep where constraints are defined
  let nextIndex = path.length - 1;

  for (let index = pathStepIndex + 1; index < path.length; index += 1) {
    const curStepId = path[index].key;
    if (theoreticalMargins?.[curStepId]?.isBoundary || scheduleByAt[curStepId]?.arrival) {
      nextIndex = index;
      break;
    }
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
  if (!pathItemTimes)
    return {
      theoreticalMargin: core.theoreticalMargin,
      isTheoreticalMarginBoundary: core.isBoundary,
      theoreticalMarginSeconds: undefined,
      calculatedMargin: undefined,
      diffMargins: undefined,
    };

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
