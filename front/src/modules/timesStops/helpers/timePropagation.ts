import { Duration } from 'utils/duration';

import { TIME_PROPAGATION_DEFAULT_DELTA } from '../consts';

/**
 * Computes the delta in milliseconds between two times.
 */
export const computeTimeDeltaMs = (oldValue: Date | null, newValue: Date | null): number | null => {
  if (!oldValue || !newValue) return null;
  return Duration.subtractDate(newValue, oldValue).ms;
};

/**
 * Formats a delta between two times using +/-HH:MM:SS.
 */
export const formatPropagationDeltaLabel = (
  oldValue: Date | null,
  newValue: Date | null
): string => {
  const deltaMs = computeTimeDeltaMs(oldValue, newValue);
  if (deltaMs === null) return TIME_PROPAGATION_DEFAULT_DELTA;

  const sign = deltaMs >= 0 ? '+' : '-';
  const totalSeconds = Math.round(new Duration({ milliseconds: deltaMs }).abs().total('second'));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${sign}${hours.toString().padStart(2, '0')}:${minutes
    .toString()
    .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};
