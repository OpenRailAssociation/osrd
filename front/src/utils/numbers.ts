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

/**
 * This helper takes an array of numbers an determinate 3 distributed intervals based upon the numbers from the array
 */
export function distributedIntervalsFromArrayOfValues(values: number[]) {
  values.sort((a, b) => a - b);
  const valuesCount = values.length;
  const indices = [Math.floor(valuesCount / 3), Math.floor((2 * valuesCount) / 3)];
  const intervals = [
    values[0],
    ...indices.map((i) => (valuesCount % 2 === 0 ? (values[i] + values[i - 1]) / 2 : values[i])),
    values[valuesCount - 1],
  ];
  return intervals;
}

export function isFloat(n: number) {
  return Number(n) === n && n % 1 !== 0;
}
/**
 * If it a float number it will strip the decimal digits
 * @param value value to strip
 * @param decimalPlaces number of decimal places to keep
 * @returns stripped number
 */
export function stripDecimalDigits(value: number, decimalPlaces: number): number {
  if (!isFloat(value) || !Number.isInteger(decimalPlaces) || decimalPlaces < 0) {
    return value;
  }

  const parts = value.toString().split('.');

  if (parts.length !== 2) {
    return value;
  }

  const stripedDecimal = parts[1].substring(0, decimalPlaces);
  const result = Number(`${parts[0]}.${stripedDecimal}`);
  return result;
}
