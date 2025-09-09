/**
 * Find the index of the first element of a sorted list greater than a threshold using binary search.
 * It optionally returns undefined if the threshold is smaller than the first element or greater than the last element of the list.
 */
export function fastFindFirstGreater(
  list: number[],
  threshold: number,
  enforceBounding: true
): number | undefined;
export function fastFindFirstGreater(
  list: number[],
  threshold: number,
  enforceBounding?: false
): number;
export function fastFindFirstGreater(list: number[], threshold: number, enforceBounding?: boolean) {
  if (!list.length) return undefined;
  let [low, high] = [0, list.length - 1];
  if (enforceBounding && (list[low] > threshold || list[high] < threshold)) return undefined;

  while (list[low] < threshold) {
    const middle = Math.floor((low + high) / 2);
    if (list[middle] >= threshold) high = middle;
    else low = middle + 1;
  }
  return low;
}

/**
 * Interpolate a speed or time value at a given position when the operational point's position
 * doesn't match any report train position
 */
export const interpolateValue = (
  reportTrain: { positions: number[]; speeds: number[]; times: number[] },
  opPosition: number,
  value: 'speeds' | 'times'
) => {
  // Get the index of the first report train position greater than the operational point position
  const indexGreater = fastFindFirstGreater(reportTrain.positions, opPosition, true);
  if (indexGreater === 0) return reportTrain[value][indexGreater];
  if (indexGreater === undefined)
    throw new Error(
      `Can not interpolate ${value} value with position ${opPosition} out of range for ${reportTrain.positions}`
    );

  const leftPosition = reportTrain.positions[indexGreater - 1];
  const rightPosition = reportTrain.positions[indexGreater];
  const leftValue = reportTrain[value][indexGreater - 1];
  const rightValue = reportTrain[value][indexGreater];
  const totalDistance = rightPosition - leftPosition;
  const distance = opPosition - leftPosition;
  const totalDifference = rightValue - leftValue;
  return leftValue + (totalDifference * distance) / totalDistance;
};
