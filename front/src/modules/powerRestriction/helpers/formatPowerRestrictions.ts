import { keyBy, sortBy } from 'lodash';

import type { PowerRestriction } from 'applications/operationalStudies/types';
import type { IntervalItem } from 'common/IntervalsEditor/types';
import type { PathStep } from 'reducers/osrdconf/types';
import { mmToM } from 'utils/physics';

/**
 * Given a list of change points and 2 points, add empty ranges to fill the gap between the 2 points
 * based on the electrification change points.
 */
const addEmptyRangesUsingElectrificationChangePoints = (
  ranges: IntervalItem[],
  from: number,
  to: number,
  changePoints: number[]
): void => {
  const relevantChangePoints = changePoints.filter((cp) => from < cp && cp < to);
  if (relevantChangePoints.length === 0) {
    ranges.push({ begin: from, end: to, value: 'NO_POWER_RESTRICTION' });
    return;
  }

  relevantChangePoints.forEach((changePoint, idx) => {
    if (idx === 0) {
      ranges.push({ begin: from, end: changePoint, value: 'NO_POWER_RESTRICTION' });
    }
    ranges.push({
      begin: changePoint,
      end: idx === relevantChangePoints.length - 1 ? to : relevantChangePoints[idx + 1],
      value: 'NO_POWER_RESTRICTION',
    });
  });

  const lastEnd = ranges.at(-1)!.end;
  if (lastEnd < to) {
    ranges.push({ begin: lastEnd, end: to, value: 'NO_POWER_RESTRICTION' });
  }
};

/**
 * Insert empty ranges between 2 points (prevEnd and nextBegin), based on electrification change points
 * and custom ranges.
 *
 * - fill first with the custom ranges
 * - fill the gaps between custom ranges with empty ranges based on electrification change points
 */
const fillWithNoPowerRestrictions = (
  ranges: IntervalItem[],
  customRanges: IntervalItem[],
  electrificationChangePoints: number[],
  initialPrevEnd: number,
  nextBegin: number
): void => {
  const relevantCustomRanges = customRanges.filter(
    (range) => initialPrevEnd <= range.begin && range.end <= nextBegin
  );

  if (relevantCustomRanges.length === 0) {
    addEmptyRangesUsingElectrificationChangePoints(
      ranges,
      initialPrevEnd,
      nextBegin,
      electrificationChangePoints
    );
    return;
  }

  let prevEnd = initialPrevEnd;
  const relevantChangePoints = electrificationChangePoints.filter(
    (cp) => initialPrevEnd < cp && cp < nextBegin
  );

  for (const customRange of relevantCustomRanges) {
    // before adding the custom range, check if there is a gap between the previous end
    // and the begin of the current custom range.
    // if there is a gap, fill it with new empty ranges(using electrification change points)
    if (prevEnd < customRange.begin) {
      addEmptyRangesUsingElectrificationChangePoints(
        ranges,
        prevEnd,
        customRange.begin,
        relevantChangePoints
      );
    }

    ranges.push(customRange);
    prevEnd = customRange.end;
  }

  // if needed, add empty ranges after the last custom range, using electrification change points
  if (prevEnd < nextBegin) {
    addEmptyRangesUsingElectrificationChangePoints(
      ranges,
      prevEnd,
      nextBegin,
      relevantChangePoints
    );
  }
};

const formatPowerRestrictions = (
  powerRestrictionRanges: PowerRestriction[],
  pathSteps: PathStep[],
  customRanges: IntervalItem[],
  changePoints: number[], // in m
  pathLength: number // in m
): IntervalItem[] => {
  const pathStepById = keyBy(pathSteps, 'id');
  const electrificationChangePoints = sortBy(changePoints, (position) => position);

  const results = powerRestrictionRanges.reduce(
    (acc: IntervalItem[], restriction: PowerRestriction): IntervalItem[] => {
      const fromPathStep = pathStepById[restriction.from];
      if (!fromPathStep)
        throw new Error(
          `Impossible to locate the path step ${restriction.from} while formatting the power restrictions`
        );
      const toPathStep = pathStepById[restriction.to];
      if (!toPathStep)
        throw new Error(
          `Impossible to locate the path step ${restriction.to} while formatting the power restrictions`
        );

      if (fromPathStep.positionOnPath === undefined || toPathStep.positionOnPath === undefined) {
        throw new Error('Impossible to locate a path step while formatting the power restrictions');
      }

      const from = mmToM(fromPathStep.positionOnPath);
      const to = mmToM(toPathStep.positionOnPath);

      // before adding the power restriction range, check if there is a gap between the previous end
      // and the begin of the current power restriction.
      // if there is a gap, fill it with new empty ranges
      const prevEnd = acc.length ? acc.at(-1)!.end : 0;
      if (prevEnd < from) {
        fillWithNoPowerRestrictions(acc, customRanges, electrificationChangePoints, prevEnd, from);
      }

      acc.push({ begin: from, end: to, value: restriction.value });
      return acc;
    },
    [] as IntervalItem[]
  );

  // if needed, add no power restriction ranges after the last power restriction range
  const lastEnd = results.length ? results.at(-1)!.end : 0;
  if (!results.length || lastEnd < pathLength)
    fillWithNoPowerRestrictions(
      results,
      customRanges,
      electrificationChangePoints,
      lastEnd,
      pathLength
    );

  return results;
};

export default formatPowerRestrictions;
