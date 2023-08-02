/* eslint-disable import/prefer-default-export */
import { last } from 'lodash';
import { LinearMetadataItem } from 'common/IntervalsDataViz/data';

/**
 * Create a new empty segment for the intervals editor
 *
 * @param linearMetadata The linear metadata we work on
 * @param distance The distance where we split the linear metadata and create a new empty segment
 * @param defaultValue The default value used for the new segment
 * @returns A new linear metadata with two more segments (1 filled with default value and the existing splitted one)
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
