import type { TFunction } from 'i18next';
import { isNil } from 'lodash';

import { getInvalidStepLabel } from 'applications/operationalStudies/utils';
import type {
  RelatedOperationalPoint,
  PathItemLocation,
  ReceptionSignal,
  TimetableType,
} from 'common/api/osrdEditoastApi';
import type { PathWaypoint } from 'modules/simulationResult/types';
import type { Train } from 'reducers/osrdconf/types';
import { Duration, type StartTime } from 'utils/duration';

/** Truncated to the second, the only granularity the table reads and writes. */
export const getTruncatedToSecondStartTime = (
  train: Train,
  timetableType: TimetableType
): StartTime => {
  const seconds = Math.floor(train.start_time / 1000);
  return timetableType === 'CALENDAR' ? new Date(seconds * 1000) : new Duration({ seconds });
};

/** Truncated to the second, the only granularity the table reads and writes. */
export const getTruncatedToSecondSchedule = (offset: string | number): Duration => {
  let ms: number;
  if (typeof offset === 'string') ms = Duration.parse(offset).ms;
  else ms = offset;
  return new Duration({ seconds: Math.floor(ms / 1000) });
};

export const truncateStartTimeToDay = (date: StartTime): StartTime => {
  if (date instanceof Date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  } else {
    return new Duration({ days: Math.floor(date.total('day')) });
  }
};

export const formatSignedDelta = (delta: Duration) => {
  const sign = delta.ms >= 0 ? '+' : '-';
  const label = delta.abs().toLocaleString(undefined, { style: 'digital', hours: '2-digit' });
  return `${sign}${label}`;
};

/** Convert receptionSignal enum to closedSignal boolean */
export function receptionSignalToSignalBooleans(receptionSignal?: ReceptionSignal) {
  if (isNil(receptionSignal)) {
    return { shortSlipDistance: undefined, closedSignal: undefined };
  }
  if (receptionSignal === 'STOP') {
    return { shortSlipDistance: false, closedSignal: true };
  }
  if (receptionSignal === 'SHORT_SLIP_STOP') {
    return { shortSlipDistance: true, closedSignal: true };
  }
  return { shortSlipDistance: false, closedSignal: false };
}

/** Convert closedSignal boolean to receptionSignal enum */
export function closedSignalToReceptionSignal(
  closedSignal?: boolean,
  shortSlipDistance?: boolean
): ReceptionSignal | undefined {
  if (isNil(closedSignal)) {
    return undefined;
  }
  if (closedSignal) {
    return shortSlipDistance ? 'SHORT_SLIP_STOP' : 'STOP';
  }
  return 'OPEN';
}

export const getOperationalPointName = (
  op: RelatedOperationalPoint | PathWaypoint | undefined,
  step: PathItemLocation,
  stepIndex: number,
  totalStepCount: number,
  t: TFunction<'operational-studies'>
) => {
  // We have a matching operational point
  if (op) return op.name;

  // TrackOffset
  if (step.type === 'track_offset') {
    if (stepIndex === 0) {
      return t('main.requestedOrigin');
    } else if (stepIndex === totalStepCount - 1) {
      return t('main.requestedDestination');
    } else {
      return t('main.requestedPoint', { count: stepIndex });
    }
  }

  // Invalid step
  return getInvalidStepLabel(step.operational_point);
};

export const getOperationalPointSecondaryCode = (
  op: RelatedOperationalPoint | PathWaypoint | undefined,
  step: PathItemLocation
) => {
  // Valid op
  if (op) return op.secondary_code;
  // Invalid op
  if (step.type === 'operational_point_part_reference' && step.operational_point.type !== 'id')
    return step.operational_point.secondary_code;
  // TrackOffset or invalid op of type id
  return undefined;
};
