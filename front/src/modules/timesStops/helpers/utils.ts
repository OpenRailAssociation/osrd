import type { TFunction } from 'i18next';
import { round } from 'lodash';
import { keyColumn, createTextColumn } from 'react-datasheet-grid';

import { matchPathStepAndOp } from 'modules/pathfinding/utils';
import type { OperationalPointWithTimeAndSpeed } from 'modules/trainschedule/components/DriverTrainScheduleV2/types';
import type { SuggestedOP } from 'modules/trainschedule/components/ManageTrainSchedule/types';
import type { PathStep } from 'reducers/osrdconf/types';
import { extractHHMMSS } from 'utils/date';
import { NO_BREAK_SPACE } from 'utils/strings';
import { datetime2sec, secToHoursString, time2sec } from 'utils/timeManipulation';

import { marginRegExValidation, MarginUnit } from '../consts';
import type { PathStepOpPointCorrespondance, PathWaypointRow } from '../types';

export const formatSuggestedViasToRowVias = (
  operationalPoints: SuggestedOP[],
  pathSteps: PathStep[],
  t: TFunction<'timesStops', undefined>,
  startTime?: string
): PathWaypointRow[] => {
  const formattedOps = [...operationalPoints];

  // If the origin is in the ops and isn't the first operational point, we need
  // to move it to the first position
  const origin = pathSteps[0];
  const originIndexInOps = origin
    ? operationalPoints.findIndex((op) => matchPathStepAndOp(origin, op))
    : -1;
  if (originIndexInOps !== -1) {
    [formattedOps[0], formattedOps[originIndexInOps]] = [
      formattedOps[originIndexInOps],
      formattedOps[0],
    ];
  }

  // Ditto: destination should be last
  const dest = pathSteps[pathSteps.length - 1];
  const destIndexInOps = dest
    ? operationalPoints.findIndex((op) => matchPathStepAndOp(dest, op))
    : -1;
  if (destIndexInOps !== -1) {
    const lastOpIndex = formattedOps.length - 1;
    [formattedOps[lastOpIndex], formattedOps[destIndexInOps]] = [
      formattedOps[destIndexInOps],
      formattedOps[lastOpIndex],
    ];
  }

  return formattedOps.map((op, i) => {
    const pathStep = pathSteps.find((step) => matchPathStepAndOp(step, op));
    const { name } = pathStep || op;
    const { arrival, onStopSignal, stopFor, theoreticalMargin } = pathStep || {};

    const isMarginValid = theoreticalMargin ? marginRegExValidation.test(theoreticalMargin) : true;
    let departure: string | undefined;
    if (stopFor) {
      if (i === 0) {
        departure = startTime
          ? secToHoursString(datetime2sec(new Date(startTime)) + Number(stopFor), true)
          : undefined;
      } else if (arrival) {
        departure = secToHoursString(time2sec(arrival) + Number(stopFor), true);
      }
    }
    return {
      ...op,
      isMarginValid,
      arrival: i === 0 ? extractHHMMSS(startTime) : arrival,
      departure,
      onStopSignal: onStopSignal || false,
      name: name || t('waypoint', { id: op.opId }),
      stopFor,
      theoreticalMargin,
    };
  });
};

export function findNextScheduledOpPoint(
  operationalPoints: OperationalPointWithTimeAndSpeed[],
  pathStepsWithOpPointIndex: PathStepOpPointCorrespondance[],
  sugOpIndex: number
) {
  const pathStepIndex = pathStepsWithOpPointIndex.findIndex(
    (pathStep) => pathStep.correspondingOpPointIndex === sugOpIndex
  );
  if (pathStepIndex >= 0) {
    const nextPathStep = pathStepsWithOpPointIndex[pathStepIndex + 1];
    return operationalPoints[nextPathStep?.correspondingOpPointIndex];
  }
  return null;
}

const getDigits = (unit: string | undefined) =>
  unit === MarginUnit.second || unit === MarginUnit.percent ? 0 : 1;

export function formatDigitsAndUnit(fullValue: string | number | undefined, unit?: string) {
  if (fullValue === undefined || fullValue === '0%') {
    return '';
  }
  if (typeof fullValue === 'number') {
    return `${round(Number(fullValue), getDigits(unit))}${NO_BREAK_SPACE}${unit}`;
  }
  const splitValue = fullValue.match(marginRegExValidation);
  if (!splitValue) {
    return '';
  }
  const extractedValue = Number(splitValue[1]);
  const extractedUnit = splitValue[3];
  const digits = getDigits(extractedUnit);
  return `${round(extractedValue, digits)}${NO_BREAK_SPACE}${extractedUnit}`;
}

export function disabledTextColumn(
  key: string,
  title: string,
  options?: Parameters<typeof createTextColumn>[0]
) {
  return {
    ...keyColumn(key, createTextColumn(options)),
    title,
    disabled: true,
  };
}
