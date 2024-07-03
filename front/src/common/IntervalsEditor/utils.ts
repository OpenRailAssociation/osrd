import { last } from 'lodash';

import type { LinearMetadataItem } from 'common/IntervalsDataViz/types';

/**
 * Create a new empty segment for the intervals editor
 *
 * @param linearMetadata The linear metadata we work on
 * @param distance The distance where we split the linear metadata and create a new empty segment
 * @param defaultValue The default value used for the new segment
 * @returns A new linear metadata with two more segments (1 filled with default value and the existing split one)
 * @throws An error when linear metadata is empty, or when the distance is outside
 */
export function createEmptySegmentAt<T>(
  linearMetadata: Array<LinearMetadataItem<T>>,
  distance: number,
  defaultValue: unknown,
  defaultUnit?: string
): Array<LinearMetadataItem<T>> {
  if (linearMetadata.length < 1) throw new Error('linear metadata is empty');
  if (distance >= (last(linearMetadata)?.end || 0) || distance <= 0)
    throw new Error('split point is outside the geometry');

  return linearMetadata
    .map((item) => {
      if (item.begin <= distance && distance <= item.end) {
        return [
          { ...item, begin: item.begin, end: distance },
          {
            ...item,
            begin: distance,
            end: distance + 1,
            value: defaultValue,
            ...(defaultUnit ? { unit: defaultUnit } : {}),
          },
          { ...item, begin: distance + 1, end: item.end },
        ];
      }
      return [item];
    })
    .flat();
}

/**
 * Remove item at specified index in the intervals editor and merge it
 * with empty adjacent segments (if necessary)
 *
 * @param linearMetadata The linear metadata we work on, already sorted
 * @param indexToRemove The index in the linearMetadata of the element to remove
 * @param emptyValue The value considered as empty
 * @param defaultUnit The default unit we should set to the removed segment (optional)
 * @returns An object composed of the new linearMetadata and its new position without the removed element
 */
export function removeSegment<T>(
  linearMetadata: Array<LinearMetadataItem<{ value: number | string } & T>>,
  indexToRemove: number,
  emptyValue: unknown,
  defaultUnit?: string
): Array<LinearMetadataItem<{ value: number | string } & T>> {
  // check if the adjacent segments are empty or not
  let shouldMergeIntoPreviousSegment = false;
  let shouldMergeIntoTheNextSegment = false;
  if (indexToRemove > 0 && linearMetadata[indexToRemove - 1].value === emptyValue) {
    shouldMergeIntoPreviousSegment = true;
  }
  if (
    indexToRemove < linearMetadata.length - 1 &&
    linearMetadata[indexToRemove + 1].value === emptyValue
  ) {
    shouldMergeIntoTheNextSegment = true;
  }

  return linearMetadata
    .map((item, index) => {
      if (index === indexToRemove - 1 && shouldMergeIntoPreviousSegment) {
        if (shouldMergeIntoTheNextSegment) {
          // both adjacent segments are empty
          return [{ ...item, end: linearMetadata[indexToRemove + 1].end }];
        }
        // merge the selected segment into the previous segment
        return [{ ...item, end: linearMetadata[indexToRemove].end }];
      }
      if (index === indexToRemove) {
        if (shouldMergeIntoPreviousSegment || shouldMergeIntoTheNextSegment) return [];
        // remove the selected segment without merging it into adjacent ones
        return [{ ...item, value: emptyValue, ...(defaultUnit ? { unit: defaultUnit } : {}) }];
      }
      if (index === indexToRemove + 1 && shouldMergeIntoTheNextSegment) {
        if (shouldMergeIntoPreviousSegment) return [];
        // merge the selected segment into the next segment
        return [{ ...item, begin: linearMetadata[indexToRemove].begin }];
      }
      return [item];
    })
    .flat();
}
