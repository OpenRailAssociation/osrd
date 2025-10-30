/* eslint-disable @typescript-eslint/no-use-before-define */
import { keyColumn, createTextColumn } from '@sdziadkowiec/react-datasheet-grid';
import dayjs from 'dayjs';
import type { TFunction } from 'i18next';
import { round, isEqual, isNil } from 'lodash';

import {
  getInvalidStepLabel,
  isOperationalPointReference,
} from 'applications/operationalStudies/utils';
import type {
  OperationalPoint,
  PathItemLocation,
  ReceptionSignal,
  TrackReference,
  TrackSection,
} from 'common/api/osrdEditoastApi';
import type { TimeString } from 'common/types';
import { matchPathStepAndOp } from 'modules/pathfinding/utils';
import type { SuggestedOP } from 'modules/timetableItem/types';
import type { PathStep } from 'reducers/osrdconf/types';
import { Duration } from 'utils/duration';
import { msToS } from 'utils/physics';
import { NO_BREAK_SPACE } from 'utils/strings';
import {
  durationInSeconds,
  SECONDS_IN_A_DAY,
  secToHoursString,
  time2sec,
} from 'utils/timeManipulation';

import { marginRegExValidation, MarginUnit } from '../consts';
import { TableType, type TimeExtraDays, type TimesStopsInputRow } from '../types';

const matchPathStepAndOpWithKP = (step: PathStep, op: SuggestedOP) => {
  if (!matchPathStepAndOp(step.location, op)) {
    return step.id === op.pathStepId;
  }
  // We match the kp in case two OPs have the same uic+ch (can happen when the
  // infra is imported)
  if ('uic' in step.location || 'trigram' in step.location) {
    return step.kp === op.kp;
  }
  return true;
};

export const formatSuggestedViasToRowVias = (
  operationalPoints: SuggestedOP[],
  pathSteps: PathStep[],
  t: TFunction<'translation', undefined>,
  startTime?: Date,
  tableType?: TableType
): TimesStopsInputRow[] => {
  const formattedOps = [...operationalPoints];

  // If the origin is in the ops and isn't the first operational point, we need
  // to move it to the first position
  const origin = pathSteps[0];
  const originIndexInOps = origin
    ? operationalPoints.findIndex((op) => matchPathStepAndOpWithKP(origin, op))
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
    ? operationalPoints.findIndex((op) => matchPathStepAndOpWithKP(dest, op))
    : -1;
  if (destIndexInOps !== -1) {
    const lastOpIndex = formattedOps.length - 1;
    [formattedOps[lastOpIndex], formattedOps[destIndexInOps]] = [
      formattedOps[destIndexInOps],
      formattedOps[lastOpIndex],
    ];
  }

  return formattedOps.map((op, i) => {
    const pathStep = pathSteps.find((step) => matchPathStepAndOpWithKP(step, op));
    const name = pathStep?.name || op.name;
    const objectToUse = tableType === TableType.Input ? pathStep : op;

    const { arrival, receptionSignal, stopFor, theoreticalMargin } = objectToUse || {};

    const stopForSeconds = stopFor ? stopFor.total('second') : undefined;

    const isMarginValid = theoreticalMargin ? marginRegExValidation.test(theoreticalMargin) : true;
    const arrivalDuration = i === 0 ? Duration.zero : arrival;
    const arrivalInSeconds = arrivalDuration ? msToS(arrivalDuration.ms) : null;

    const formattedArrival = calculateStepTimeAndDays(startTime, arrivalDuration);

    const departureTime =
      stopForSeconds !== undefined && arrivalInSeconds
        ? secToHoursString(arrivalInSeconds + stopForSeconds)
        : undefined;
    const formattedDeparture: TimeExtraDays | undefined = departureTime
      ? { time: departureTime }
      : undefined;
    const { receptionSignal: _opReceptionSignal, ...filteredOp } = op;
    const { shortSlipDistance, onStopSignal } = receptionSignalToSignalBooleans(receptionSignal);
    return {
      ...filteredOp,
      isMarginValid,
      arrival: formattedArrival,
      departure: formattedDeparture,
      onStopSignal,
      name: name || t('timeStopTable.waypoint', { id: filteredOp.pathStepId }),
      shortSlipDistance,
      stopFor,
      theoreticalMargin,
    };
  });
};

const getDigits = (unit: string | undefined) =>
  unit === MarginUnit.second || unit === MarginUnit.percent ? 0 : 1;

export function formatDigitsAndUnit(fullValue: string | number | undefined, unit?: string) {
  if (fullValue === undefined) {
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

/**
 * Synchronizes arrival, departure and stop times.
 * updates onStopSignal
 * updates isMarginValid and theoreticalMargin
 */
export function updateRowTimesAndMargin(
  rowData: TimesStopsInputRow,
  previousRowData: TimesStopsInputRow,
  op: { fromRowIndex: number },
  allWaypointsLength: number
): TimesStopsInputRow {
  const newRowData = { ...rowData };
  if (
    !isEqual(newRowData.arrival, previousRowData.arrival) ||
    !isEqual(newRowData.departure, previousRowData.departure)
  ) {
    if (newRowData.departure?.time && newRowData.arrival?.time) {
      newRowData.stopFor = new Duration({
        seconds: durationInSeconds(
          time2sec(newRowData.arrival.time),
          time2sec(newRowData.departure.time)
        ),
      });
    } else if (newRowData.departure) {
      if (!previousRowData.departure) {
        newRowData.arrival = {
          time: secToHoursString(
            time2sec(newRowData.departure.time) - (newRowData.stopFor?.total('second') ?? 0)
          ),
        };
      } else {
        newRowData.departure = undefined;
      }
    } else if (newRowData.arrival && previousRowData.departure) {
      // we just erased departure value
      newRowData.stopFor = undefined;
    }
  }
  if (
    !newRowData.stopFor &&
    newRowData.onStopSignal &&
    op.fromRowIndex !== allWaypointsLength - 1
  ) {
    newRowData.onStopSignal = false;
  }
  newRowData.isMarginValid = !(
    newRowData.theoreticalMargin && !marginRegExValidation.test(newRowData.theoreticalMargin)
  );
  if (newRowData.isMarginValid && op.fromRowIndex === 0) {
    newRowData.arrival = undefined;
    // As we put 0% by default for origin's margin, if the user removes a margin without
    // replacing it to 0% (undefined), we change it to 0%
    if (!newRowData.theoreticalMargin) {
      newRowData.theoreticalMargin = '0%';
    }
  }
  return newRowData;
}

/**
 * This function is called before comparing rows to prevent a change from undefined to null (or the reverse)
 * from being treated as an actual update of a row (otherwise changes would occur on deletion of an undefined field)
 */
export function normalizeNullablesInRow(row: TimesStopsInputRow): TimesStopsInputRow {
  const normalizedRow = { ...row };
  if (normalizedRow.stopFor === null) {
    normalizedRow.stopFor = undefined;
  }
  if (normalizedRow.theoreticalMargin === null) {
    normalizedRow.theoreticalMargin = undefined;
  }
  return normalizedRow;
}

/**
 * This function goes through the whole array of path waypoints
 * and updates the number of days since departure.
 */
export function updateDaySinceDeparture(
  pathWaypointRows: TimesStopsInputRow[],
  { keepFirstIndexArrival = false } = {}
): TimesStopsInputRow[] {
  let currentDaySinceDeparture = 0;
  let previousTime = Number.NEGATIVE_INFINITY;

  return pathWaypointRows.map((pathWaypoint, index) => {
    const { arrival, stopFor } = pathWaypoint;
    const arrivalInSeconds = arrival?.time ? time2sec(arrival.time) : null;
    let formattedArrival: TimeExtraDays | undefined;

    if (arrivalInSeconds !== null) {
      const isMidnight = arrival?.time === '00:00:00';

      if ((arrivalInSeconds < previousTime || isMidnight) && !(isMidnight && index === 0)) {
        currentDaySinceDeparture += 1;
        formattedArrival = {
          time: arrival!.time,
          daySinceDeparture: currentDaySinceDeparture,
          dayDisplayed: true,
        };
      } else {
        formattedArrival = {
          time: arrival!.time,
          daySinceDeparture: currentDaySinceDeparture,
        };
      }
      previousTime = isMidnight ? 0 : arrivalInSeconds;
    }

    let formattedDeparture: TimeExtraDays | undefined;

    if (stopFor && arrivalInSeconds !== null) {
      const departureInSeconds = (arrivalInSeconds + stopFor.total('second')) % SECONDS_IN_A_DAY;
      const isAfterMidnight = departureInSeconds < previousTime;
      const isDepartureMidnight = departureInSeconds === 0;

      if (isAfterMidnight || isDepartureMidnight) {
        currentDaySinceDeparture += 1;
        formattedDeparture = {
          time: secToHoursString(departureInSeconds),
          daySinceDeparture: currentDaySinceDeparture,
          dayDisplayed: true,
        };
      } else {
        formattedDeparture = {
          time: secToHoursString(departureInSeconds),
          daySinceDeparture: currentDaySinceDeparture,
        };
      }
      previousTime = departureInSeconds;
    }
    return {
      ...pathWaypoint,
      arrival: keepFirstIndexArrival || index > 0 ? formattedArrival : undefined,
      departure: formattedDeparture,
    };
  });
}

export function durationSinceStartTime(
  startTime?: Date,
  stepTimeDays?: TimeExtraDays
): Duration | null {
  if (!startTime || !stepTimeDays?.time || stepTimeDays?.daySinceDeparture === undefined) {
    return null;
  }
  const start = dayjs(startTime);
  const step = dayjs(`${start.format('YYYY-MM-DD')}T${stepTimeDays.time}`).add(
    stepTimeDays.daySinceDeparture,
    'day'
  );
  return Duration.subtractDate(step.toDate(), startTime);
}

export function calculateStepTimeAndDays(
  startTime?: Date | null,
  duration?: Duration | null
): TimeExtraDays | undefined {
  if (!startTime || !duration) {
    return undefined;
  }

  const start = dayjs(startTime);
  const dur = dayjs.duration(duration.ms);

  const waypointArrivalTime = start.add(dur);
  const daySinceDeparture = waypointArrivalTime.diff(start, 'day');
  const time: TimeString = waypointArrivalTime.format('HH:mm:ss');

  return {
    time,
    daySinceDeparture,
  };
}

/** Convert onStopSignal boolean to receptionSignal enum */
export function onStopSignalToReceptionSignal(
  onStopSignal?: boolean,
  shortSlipDistance?: boolean
): ReceptionSignal | undefined {
  if (isNil(onStopSignal)) {
    return undefined;
  }
  if (onStopSignal === true) {
    return shortSlipDistance ? 'SHORT_SLIP_STOP' : 'STOP';
  }
  return 'OPEN';
}

/** Convert receptionSignal enum to onStopSignal boolean */
export function receptionSignalToSignalBooleans(receptionSignal?: ReceptionSignal) {
  if (isNil(receptionSignal)) {
    return { shortSlipDistance: undefined, onStopSignal: undefined };
  }
  if (receptionSignal === 'STOP') {
    return { shortSlipDistance: false, onStopSignal: true };
  }
  if (receptionSignal === 'SHORT_SLIP_STOP') {
    return { shortSlipDistance: true, onStopSignal: true };
  }
  return { shortSlipDistance: false, onStopSignal: false };
}

export const getTrackReferenceLabel = (
  trackSections: Record<string, TrackSection>,
  trackReference?: TrackReference | null
) => {
  if (!trackReference) return undefined;
  if ('track_name' in trackReference) return trackReference.track_name;
  return trackSections[trackReference.track_id]?.extensions?.sncf?.track_name ?? '?';
};

export const getOperationalPointName = (
  op: OperationalPoint | undefined,
  step: PathItemLocation,
  stepIndex: number,
  totalStepCount: number,
  t: TFunction<'operational-studies'>
) => {
  // We have a matching operational point
  if (op) return op.extensions?.identifier?.name;

  // TrackOffset
  if (!isOperationalPointReference(step)) {
    if (stepIndex === 0) {
      return t('main.requestedOrigin');
    } else if (stepIndex === totalStepCount - 1) {
      return t('main.requestedDestination');
    } else {
      return t('main.requestedPoint', { count: stepIndex });
    }
  }

  // Invalid step
  return getInvalidStepLabel(step);
};
