import type { TFunction } from 'i18next';
import { round } from 'lodash';
import { keyColumn, createTextColumn } from 'react-datasheet-grid';

import { matchPathStepAndOp } from 'modules/pathfinding/utils';
import type { OperationalPointWithTimeAndSpeed } from 'modules/trainschedule/components/DriverTrainScheduleV2/types';
import type { SuggestedOP } from 'modules/trainschedule/components/ManageTrainSchedule/types';
import type { PathStep } from 'reducers/osrdconf/types';
import { extractHHMMSS } from 'utils/date';
import { NO_BREAK_SPACE } from 'utils/strings';

import { marginRegExValidation, MarginUnit } from '../consts';
import { TableType } from '../types';
import type { PathStepOpPointCorrespondance, PathWaypointRow } from '../types';

export const formatSuggestedViasToRowVias = (
  operationalPoints: SuggestedOP[],
  pathSteps: PathStep[],
  t: TFunction<'timesStops', undefined>,
  startTime?: string,
  tableType?: TableType
): PathWaypointRow[] => {
  const formattedOps = [...operationalPoints];
  const origin = pathSteps[0] as PathStep;
  if (origin && 'uic' in origin && 'ch' in origin) {
    const originIndexInOps = operationalPoints.findIndex(
      (op) => op.uic === origin.uic && op.ch === origin.ch && op.name === origin.name
    );
    // If the origin is in the ops and isn't the first operational point, we need to move it to the first position
    if (originIndexInOps !== (-1 || 0)) {
      [formattedOps[0], formattedOps[originIndexInOps]] = [
        formattedOps[originIndexInOps],
        formattedOps[0],
      ];
    }
  }
  return formattedOps.map((op, i) => {
    const pathStep = pathSteps.find((step) => matchPathStepAndOp(step, op));
    const { name } = pathStep || op;
    const objectToUse = tableType === TableType.Input ? pathStep : op;
    const { arrival, onStopSignal, stopFor, theoreticalMargin } = objectToUse || {};

    const isMarginValid = theoreticalMargin ? marginRegExValidation.test(theoreticalMargin) : true;

    return {
      ...op,
      isMarginValid,
      arrival: i === 0 ? extractHHMMSS(startTime) : arrival,
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
