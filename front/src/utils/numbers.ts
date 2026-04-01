/** Returns a value clamped within the inclusive range [min, max] */
export function clamp(value: number, [min, max]: [number, number]) {
  if (value >= max) return max;
  if (value <= min) return min;
  return value;
}

export function budgetFormat(amount: number | bigint) {
  const amountFormatted = new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
  }).format(amount);
  return amountFormatted;
}

// This function takes a train duration & the distributed intervals, and return the position of train inside intervals
export function valueToInterval(value?: number, intervals?: number[]) {
  if (value && intervals) {
    if (value < intervals[1]) return 0;
    if (value < intervals[2]) return 1;
    return 2;
  }
  return undefined;
}

export function isFloat(n: number) {
  return Number.isFinite(n) && !Number.isInteger(n);
}

/**
 * Checks if a floating-point number has more decimal places than specified.
 * @param value the floating-point number to check.
 * @param numberOfDecimal the maximum allowed number of decimal places.
 * @returns true if the number has more decimal places than allowed
 */
export const isInvalidFloatNumber = (value: number, numberOfDecimal: number): boolean => {
  if (!isFloat(value)) return false;
  const stringifyValue = value.toString();
  return stringifyValue.split('.')[1].length > numberOfDecimal;
};

/**
 * Linear interpolation for a value from the domain range into the scale range.
 *
 * @param scale The range you want (target range)
 * @param domain The min & max of the domain range of the data (data range)
 * @param value The value in domain range to interpolate into scale range
 */
export function linearScaleInterpolation(
  scale: { from: number; to: number },
  domain: { min: number; max: number },
  value: number
): number {
  // Checks
  if (domain.min > domain.max)
    throw new Error("Domain: 'min' is superior to 'max' which is not allowed");

  // Side effects
  if (value >= domain.max) return scale.to;
  if (value <= domain.min) return scale.from;

  // Linear interpolation
  const ratio = (scale.to - scale.from) / (domain.max - domain.min);
  const result = scale.from + ratio * (value - domain.min);
  return isNaN(result) ? scale.from : result;
}
