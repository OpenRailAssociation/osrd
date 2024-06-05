import { isEmpty, keyBy, sortBy } from 'lodash';

import type { PowerRestrictionV2 } from 'applications/operationalStudies/types';
import type { IntervalItem } from 'common/IntervalsEditor/types';
import type { PathStep } from 'reducers/osrdconf/types';
import { mmToM } from 'utils/physics';

const addNoPowerRestrictions = (
  acc: IntervalItem[],
  from: number,
  to: number,
  changePoints: number[]
): void => {
  if (changePoints.length === 0) {
    acc.push({ begin: from, end: to, value: 'NO_POWER_RESTRICTION' });
    return;
  }

  changePoints.forEach((changePoint, idx) => {
    if (idx === 0) {
      acc.push({ begin: from, end: changePoint, value: 'NO_POWER_RESTRICTION' });
    }
    acc.push({
      begin: changePoint,
      end: idx === changePoints.length - 1 ? to : changePoints[idx + 1],
      value: 'NO_POWER_RESTRICTION',
    });
  });
};

const appendFinalNoPowerRestriction = (
  ranges: IntervalItem[],
  pathLength: number,
  electrificationChangePoints: number[]
): void => {
  const lastEnd = ranges.length ? ranges[ranges.length - 1].end : 0;
  if (lastEnd < pathLength) {
    const finalChangePoints = electrificationChangePoints.filter((cp) => cp > lastEnd);
    if (finalChangePoints.length > 0) {
      addNoPowerRestrictions(ranges, lastEnd, pathLength, finalChangePoints);
    } else {
      ranges.push({ begin: lastEnd, end: pathLength, value: 'NO_POWER_RESTRICTION' });
    }
  }
};

const reducePowerRestrictions =
  (pathStepById: Record<string, PathStep>, electrificationChangePoints: number[]) =>
  (acc: IntervalItem[], restriction: PowerRestrictionV2, index: number): IntervalItem[] => {
    const fromPathStep = pathStepById[restriction.from];
    const toPathStep = pathStepById[restriction.to];
    const from =
      fromPathStep?.positionOnPath !== undefined ? mmToM(fromPathStep?.positionOnPath) : undefined;
    const to = toPathStep?.positionOnPath ? mmToM(toPathStep?.positionOnPath) : undefined;
    const prevEnd = isEmpty(acc) ? 0 : acc[acc.length - 1].end;

    if (from !== undefined && to !== undefined) {
      if (index === 0 || from > prevEnd) {
        const gapChangePoints = electrificationChangePoints.filter(
          (cp) => cp > prevEnd && cp < from
        );
        if (gapChangePoints.length > 0) {
          addNoPowerRestrictions(acc, prevEnd, from, gapChangePoints);
        } else {
          acc.push({ begin: prevEnd, end: from, value: 'NO_POWER_RESTRICTION' });
        }
      }
      acc.push({ begin: from, end: to, value: restriction.value });
    }
    return acc;
  };

const formatPowerRestrictions = (
  powerRestrictionRanges: PowerRestrictionV2[],
  changePoints: number[],
  pathSteps: PathStep[],
  pathLength: number
): IntervalItem[] => {
  const pathStepById = keyBy(pathSteps, 'id');
  const electrificationChangePoints = sortBy(changePoints, (position) => position);
  const formattedPowerRestrictionRanges = powerRestrictionRanges.reduce(
    reducePowerRestrictions(pathStepById, electrificationChangePoints),
    [] as IntervalItem[]
  );
  appendFinalNoPowerRestriction(
    formattedPowerRestrictionRanges,
    pathLength,
    electrificationChangePoints
  );
  return formattedPowerRestrictionRanges;
};

export default formatPowerRestrictions;
