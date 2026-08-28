import type { TFunction } from 'i18next';
import { isNil } from 'lodash';

import { getInvalidStepLabel } from 'applications/operationalStudies/utils';
import type {
  RelatedOperationalPoint,
  PathItemLocation,
  ReceptionSignal,
} from 'common/api/osrdEditoastApi';
import { Duration, type StartTime } from 'utils/duration';

export const truncateStartTimeToSecond = (date: StartTime): StartTime => {
  if (date instanceof Date) {
    const truncated = new Date(date);
    truncated.setMilliseconds(0);
    return truncated;
  } else {
    return new Duration({ seconds: Math.floor(date.total('second')) });
  }
};

export const truncateStartTimeToDay = (date: StartTime): StartTime => {
  if (date instanceof Date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  } else {
    return new Duration({ days: Math.floor(date.total('day')) });
  }
};

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

export const getOperationalPointName = (
  op: RelatedOperationalPoint | null | undefined,
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
