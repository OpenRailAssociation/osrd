export function boundedValue(value: number, [min, max]: [number, number]) {
  if (value >= max) {
    return max;
  }
  if (value <= min) {
    return min;
  }
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

// This helper takes an array of numbers an determinate 3 distributed intervals based upon the numbers from the array
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
