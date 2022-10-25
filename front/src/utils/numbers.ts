// eslint-disable-next-line import/prefer-default-export
export function boundedValue(value: number, [min, max]: [number, number]) {
  if (value >= max) {
    return max;
  }
  if (value <= min) {
    return min;
  }
  return value;
}
