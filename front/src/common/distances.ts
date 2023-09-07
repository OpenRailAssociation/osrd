/*
 * Functions for calcultating and/or displaying Distances
 */
export default function kmORm(value: number): undefined | { value: number; unit: string } {
  if (Number.isNaN(value)) return undefined;
  if (value >= 1000) {
    return {
      value: value / 1000,
      unit: 'km',
    };
  }
  return {
    value,
    unit: 'm',
  };
}
