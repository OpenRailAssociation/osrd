/* Distances
*
* Functions for calcultating and/or displaying Distances
*
*/

// Return an array [adapted value,unit] eg: [123.32,'KM']
export default function kmORm(value) {
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
