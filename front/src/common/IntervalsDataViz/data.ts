import type { MutableRefObject } from 'react';

import { retrieveSchema } from '@rjsf/utils';
import validator from '@rjsf/validator-ajv8';
import fnLength from '@turf/length';
import lineSplit from '@turf/line-split';
import type { Feature, Point, LineString, Position } from 'geojson';
import type { JSONSchema7, JSONSchema7Definition } from 'json-schema';
import { last, differenceWith, cloneDeep, isEqual, isArray, isNil, isEmpty, sortBy } from 'lodash';

import { removeInvalidRanges } from 'applications/editor/tools/trackEdition/utils';
import type { EditorEntity } from 'applications/editor/typesEditorEntity';

import type { LinearMetadataItem, OperationalPoint } from './types';

export const LINEAR_METADATA_FIELDS = ['slopes', 'curves'];
// Min size of a linear metadata segment
export const SEGMENT_MIN_SIZE = 1;
// Delta error between the user length input and the length of the geometry
// Zoom by 25%
const ZOOM_RATIO = 0.75;
// Min size (in meter) of the viewbox
const MIN_SIZE_TO_DISPLAY = 10;

/**
 * Cast a coordinate to its Feature representation.
 */
function coordinateToFeature(coordinates: Position): Feature<Point> {
  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Point',
      coordinates,
    },
  };
}

/**
 * Cast a coordinate to its Feature representation.
 */
function lineStringToFeature(line: LineString): Feature<LineString> {
  return {
    type: 'Feature',
    properties: {},
    geometry: line,
  };
}

/**
 * Returns the length of a lineString in meters.
 */
export function getLineStringDistance(line: LineString): number {
  return Math.round(fnLength(lineStringToFeature(line)) * 1000);
}

/**
 * Given an array of linearMetadata and a position, returns the first item
 * containing the position
 */
export function getHoveredItem<T>(
  linearMetadata: Array<LinearMetadataItem<T>>,
  hoveredPosition: number
): { hoveredItem: LinearMetadataItem<T>; hoveredItemIndex: number } | null {
  const hoveredItemIndex = linearMetadata.findIndex(
    (item) => item.begin <= hoveredPosition && hoveredPosition <= item.end
  );
  return hoveredItemIndex !== -1
    ? { hoveredItem: linearMetadata[hoveredItemIndex], hoveredItemIndex }
    : null;
}

/**
 * When you change the size of a segment, you need to impact it on the chain.
 * What we do is to subtract the gap from its neighbor (see beginOrEnd).
 */
export function resizeSegment<T>(
  linearMetadata: Array<LinearMetadataItem<T>>,
  itemChangeIndex: number,
  gap: number,
  beginOrEnd: 'begin' | 'end' = 'end',
  preventBoundsChanges = true
): { result: Array<LinearMetadataItem<T>>; newIndexMapping: Record<number, number | null> } {
  if (itemChangeIndex >= linearMetadata.length) throw new Error("Given index doesn't exist");

  const newIndexMapping = linearMetadata.reduce(
    (acc, _curr, index) => {
      acc[index] = index;
      return acc;
    },
    {} as Record<number, number | null>
  );

  if (preventBoundsChanges && itemChangeIndex === 0 && beginOrEnd === 'begin')
    return { result: linearMetadata, newIndexMapping };

  if (preventBoundsChanges && itemChangeIndex === linearMetadata.length - 1 && beginOrEnd === 'end')
    return { result: linearMetadata, newIndexMapping };

  const min = linearMetadata[0].begin;
  const max = last(linearMetadata)?.end || 0;

  // apply the modification on the segment
  let result = cloneDeep(linearMetadata);
  if (beginOrEnd === 'begin') result[itemChangeIndex].begin += gap;
  else result[itemChangeIndex].end += gap;
  // can't move before min.
  if (result[itemChangeIndex].begin < min) result[itemChangeIndex].begin = 0;
  // can't move after max.
  if (result[itemChangeIndex].end > max) result[itemChangeIndex].end = max;

  // compute new width
  const newWidth = result[itemChangeIndex].end - result[itemChangeIndex].begin;
  const oldWidth = linearMetadata[itemChangeIndex].end - linearMetadata[itemChangeIndex].begin;

  if (newWidth > 0) {
    // if element width has reduced, the impact is easy (only sibling)
    if (newWidth < oldWidth) {
      if (itemChangeIndex > 0) {
        result[itemChangeIndex - 1].end = result[itemChangeIndex].begin;
      }
      if (itemChangeIndex < result.length - 1) {
        result[itemChangeIndex + 1].begin = result[itemChangeIndex].end;
      }
      return { result, newIndexMapping };
    }

    // if element width has increase, the impact is easy (only sibling)
    // fix the LM for the overlap
    const itemChanged = result[itemChangeIndex];
    const newIndex = [] as Array<number>;
    result = result.flatMap((item, index) => {
      if (index === itemChangeIndex) {
        if (newWidth > 0) {
          newIndex.push(index);
          return [item];
        }
        // else
        newIndexMapping[index] = null;
        return [];
      }

      // case full overlap => remove
      if (item.begin >= itemChanged.begin && item.end <= itemChanged.end) {
        newIndexMapping[index] = null;
        return [];
      }
      // case partial overlap at the end
      if (item.begin <= itemChanged.begin && item.end >= itemChanged.begin) {
        newIndex.push(index);
        return [{ ...item, end: itemChanged.begin }];
      }

      // case partial overlap at the start
      if (item.begin <= itemChanged.end && item.end >= itemChanged.end) {
        newIndex.push(index);
        return [{ ...item, begin: itemChanged.end }];
      }

      newIndex.push(index);
      return [item];
    });

    // update newIndexMapping with the newIndex
    newIndex.forEach((o, n) => {
      newIndexMapping[o] = n;
    });

    return { result, newIndexMapping };
  }
  // else
  return resizeSegment(result, itemChangeIndex + 1, newWidth - oldWidth, 'begin');
}

/**
 * Merge a segment with one of its sibling, define by the policy.
 * NOTE: Property of selected item will override the sibling one.
 */
export function mergeIn<T>(
  linearMetadata: Array<LinearMetadataItem<T>>,
  index: number,
  policy: 'left' | 'right'
): Array<LinearMetadataItem<T>> {
  if (!(index >= 0 && index < linearMetadata.length)) throw new Error('Bad merge index');
  if (policy === 'left' && index === 0)
    throw new Error('Target segment is outside the linear metadata');
  if (policy === 'right' && index === linearMetadata.length - 1)
    throw new Error('Target segment is outside the linear metadata');

  if (policy === 'left') {
    const left = linearMetadata[index - 1];
    const element = linearMetadata[index];
    return [
      ...linearMetadata.slice(0, index - 1),
      { ...element, begin: left.begin },
      ...linearMetadata.slice(index + 1),
    ];
  }

  const right = linearMetadata[index + 1];
  const element = linearMetadata[index];
  return [
    ...linearMetadata.slice(0, index),
    { ...element, end: right.end },
    ...linearMetadata.slice(index + 2),
  ];
}

/**
 * Fix a linear metadata
 * - if empty it generate one
 * - if there is a gap at begin/end or inside, it is created
 * - if there is an overlaps, remove it
 */
export function fixLinearMetadataItems<T>(
  items: Array<LinearMetadataItem<T>> | undefined,
  lineLength: number,
  opts?: { fieldName: string; defaultValue: unknown }
): Array<LinearMetadataItem<T>> {
  // simple scenario
  if (!items || items.length === 0) {
    return [
      {
        begin: 0,
        end: lineLength,
        ...(opts ? { [opts.fieldName]: opts.defaultValue } : {}),
      } as LinearMetadataItem<T>,
    ];
  }
  const filteredItems = removeInvalidRanges(items, lineLength);

  function haveAdditionalKeys(item: LinearMetadataItem, itemToCompare: LinearMetadataItem) {
    const keys = Object.keys(item);
    const keysToCompare = Object.keys(itemToCompare);
    return (
      keys.some((key) => key !== 'begin' && key !== 'end') ||
      keysToCompare.some((key) => key !== 'begin' && key !== 'end')
    );
  }

  // merge empty adjacent items
  let fixedLinearMetadata: Array<LinearMetadataItem<T>> = sortBy(filteredItems, ['begin']);

  // Order the array and fix it by filling gaps if there are some
  fixedLinearMetadata = fixedLinearMetadata.flatMap((item, index, array) => {
    const result: Array<LinearMetadataItem<T>> = [];

    // we remove the item if it begins after the end of the line
    if (item.begin >= lineLength) return [];

    // check for no gap at start
    if (index === 0) {
      if (item.begin !== 0) {
        result.push({
          ...(opts ? { [opts.fieldName]: opts.defaultValue } : {}),
          begin: 0,
          end: item.begin,
        } as LinearMetadataItem<T>);
      }
      result.push(item);
    }

    if (index > 0) {
      const prev = array[index - 1];

      // normal way
      if (prev.end === item.begin) {
        result.push({
          ...(opts ? { [opts.fieldName]: opts.defaultValue } : {}),
          ...item,
        });
      }

      // if there is gap with the previous
      if (prev.end < item.begin) {
        result.push({
          ...(opts ? { [opts.fieldName]: opts.defaultValue } : {}),
          begin: prev.end,
          end: item.begin,
        } as LinearMetadataItem<T>);
        result.push({
          ...(opts ? { [opts.fieldName]: opts.defaultValue } : {}),
          ...item,
        });
      }
    }

    // Check for gap at the end
    if (index === array.length - 1 && item.end < lineLength) {
      result.push({
        ...(opts ? { [opts.fieldName]: opts.defaultValue } : {}),
        begin: item.end,
        end: lineLength,
      } as LinearMetadataItem<T>);
    }

    return result;
  });

  let noEmptyAdjacentItems = false;
  while (!noEmptyAdjacentItems) {
    noEmptyAdjacentItems = true;
    for (let i = 0; i < fixedLinearMetadata.length; i += 1) {
      if (i >= 1) {
        const item = fixedLinearMetadata[i];
        const prev = fixedLinearMetadata[i - 1];
        if (item.begin === prev.end && !haveAdditionalKeys(item, prev)) {
          fixedLinearMetadata = mergeIn(fixedLinearMetadata, i, 'left');
          noEmptyAdjacentItems = false;
          break;
        }
      }
    }
  }

  // if the fixed lm is bigger than the lineLength (the opposite is not possible, we already fix gaps)
  const tail = last(fixedLinearMetadata);
  if (tail && tail.end > lineLength) {
    let reduceLeft = tail.end - lineLength;
    let index = fixedLinearMetadata.length - 1;
    while (reduceLeft > 0 && index >= 0) {
      const itemLength = fixedLinearMetadata[index].end - fixedLinearMetadata[index].begin;
      if (itemLength > SEGMENT_MIN_SIZE) {
        const gap =
          itemLength - SEGMENT_MIN_SIZE < reduceLeft ? itemLength - SEGMENT_MIN_SIZE : reduceLeft;
        fixedLinearMetadata = resizeSegment(fixedLinearMetadata, index, -1 * gap).result;
        reduceLeft -= gap;
      }
      index -= 1;
    }
  }

  return fixedLinearMetadata;
}

/**
 * Do the impact on the linear metadata when the LineString changed.
 * (recompute all the beginning / end).
 * We change only one segment, others stay the same or are just translated.
 * This method should be call at every (unitary) change on the LineString.
 */
export function update<T>(
  sourceLine: LineString,
  targetLine: LineString,
  linearMetadata: Array<LinearMetadataItem<T>>
): Array<LinearMetadataItem<T>> {
  if (linearMetadata.length === 0) return [];
  // Compute the source coordinates of the changed point
  // by doing
  // - a diff between source & target for change
  // - a diff between source & target for deletion
  // - a diff between target & source for addition
  let diff = differenceWith(sourceLine.coordinates, targetLine.coordinates, isEqual);
  if (diff.length === 0)
    diff = differenceWith(targetLine.coordinates, sourceLine.coordinates, isEqual);
  // if no diff, we return the original linear metadata
  if (diff.length === 0) return linearMetadata;

  // We take the first one
  const sourcePoint = diff[0];

  // Searching the closest segment (in distance) from the source point
  // To do it we compute the distance from the origin to the point,
  // and we search the closest in the linear array
  const sourceLineToPoint = lineSplit(
    lineStringToFeature(sourceLine),
    coordinateToFeature(sourcePoint)
  ).features[0];
  const pointDistance = fnLength(sourceLineToPoint) * 1000;
  const closestLinearItem = linearMetadata.reduce(
    (acc, curr, index) => {
      const distanceToPoint = Math.min(
        Math.abs(pointDistance - curr.begin),
        Math.abs(pointDistance - curr.end)
      );
      if (distanceToPoint < acc.min) {
        acc = { min: distanceToPoint, index };
      }
      return acc;
    },
    { min: Infinity, index: 0 }
  );

  // Now we know where we need to start the recomputation
  //  - We keep the left part
  //  - for each item on the right part we do a delta translate
  //  - and for the impacted item, we add the delta
  // NOTE: the delta can be negative (ex: deletion)
  const delta =
    (fnLength(lineStringToFeature(targetLine)) - fnLength(lineStringToFeature(sourceLine))) * 1000;
  return [
    ...linearMetadata.slice(0, closestLinearItem.index),
    {
      ...linearMetadata[closestLinearItem.index],
      end: linearMetadata[closestLinearItem.index].end + delta,
    },
    ...linearMetadata.slice(closestLinearItem.index + 1).map((item) => ({
      ...item,
      begin: item.begin + delta,
      end: item.end + delta,
    })),
  ];
}

/**
 * Split the linear metadata at the given distance.
 */
export function splitAt<T>(
  linearMetadata: Array<LinearMetadataItem<T>>,
  distance: number
): Array<LinearMetadataItem<T>> {
  if (linearMetadata.length < 1) throw new Error('linear metadata is empty');
  if (distance >= (last(linearMetadata)?.end || 0) || distance <= 0)
    throw new Error('split point is outside the geometry');

  return linearMetadata
    .map((item) => {
      if (item.begin <= distance && distance <= item.end) {
        return [
          { ...item, begin: item.begin, end: distance },
          { ...item, begin: distance, end: item.end },
        ];
      }
      return [item];
    })
    .flat();
}

/**
 * Compute the new view-box after a zoom.
 */
export function getZoomedViewBox<T>(
  data: Array<LinearMetadataItem<T>>,
  currentViewBox: [number, number] | null,
  zoom: 'IN' | 'OUT',
  onPoint?: number
): [number, number] | null {
  if (data.length === 0) return null;

  const min = data[0].begin;
  const max = last(data)?.end || 0;
  const fullDistance = max - min;

  const viewBox: [number, number] = currentViewBox || [min, max];
  let distanceToDisplay =
    (viewBox[1] - viewBox[0]) * (zoom === 'IN' ? ZOOM_RATIO : 1 - ZOOM_RATIO + 1);

  // if the distance to display if higher than the original one
  // we display everything, so return null
  if (distanceToDisplay >= fullDistance) return null;

  // if distance is too small we are at the max zoom level
  if (distanceToDisplay < MIN_SIZE_TO_DISPLAY) distanceToDisplay = MIN_SIZE_TO_DISPLAY;

  // Compute the point on which we do the zoom
  const point = onPoint || viewBox[0] + (viewBox[1] - viewBox[0]) / 2;

  // let's try to add the distance on each side
  const begin = point - distanceToDisplay / 2;
  const end = point + distanceToDisplay / 2;
  if (min <= begin && end <= max) {
    return [begin, end];
  }

  // if begin < min, it means that the beginning is outside
  // so we need to add the diff at the end
  // otherwise, it means that the end is outside
  // so we need to add the diff at the beginning
  if (begin < min) {
    return [min, end + (min - begin)];
  }
  return [begin - (end - max), max];
}

/**
 * Compute the new view-box after a translation.
 */
export function translateViewBox<T>(
  data: Array<LinearMetadataItem<T>>,
  currentViewBox: [number, number] | null,
  translation: number
): [number, number] | null {
  // can't perform a translation on no data
  if (data.length === 0) return null;
  // can't perform a translation if not zoomed
  if (!currentViewBox) return null;

  const max = last(data)?.end || 0;
  const distanceToDisplay = currentViewBox[1] - currentViewBox[0];

  // if translation on the left, we do it on the min
  if (translation < 0) {
    // new min is the min minus the translation or 0
    const newMin = currentViewBox[0] + translation > 0 ? currentViewBox[0] + translation : 0;
    return [newMin, newMin + distanceToDisplay];
  }

  // if translation on the right, we do it on the max
  // new max is the max plus the translation or max
  const newMax = currentViewBox[1] + translation < max ? currentViewBox[1] + translation : max;
  return [newMax - distanceToDisplay, newMax];
}

/**
 * Given a LinearMetadataItem and view-box, this function returns
 * the cropped LinearMetadataItem (and also add the index)
 */
export function cropForDatavizViewbox(
  data: Array<LinearMetadataItem>,
  currentViewBox: [number, number] | null
): Array<LinearMetadataItem & { index: number }> {
  return (
    [...data]
      // we add the index so events are able to send the index
      .map((segment, index) => ({ ...segment, index }))
      // we filter elements that cross or are inside the viewbox
      .filter((e) => {
        if (!currentViewBox) return true;
        // if one extremity is in (i.e. overlaps or full in)
        if (currentViewBox[0] <= e.begin && e.begin <= currentViewBox[1]) return true;
        if (currentViewBox[0] <= e.end && e.end <= currentViewBox[1]) return true;
        // if include the viewbox
        if (e.begin <= currentViewBox[0] && currentViewBox[1] <= e.end) return true;
        // else
        return false;
      })
      // we crop the extremities if needed
      .map((e) => {
        if (!currentViewBox) return e;
        return {
          ...e,
          begin: e.begin < currentViewBox[0] ? currentViewBox[0] : e.begin,
          end: e.end > currentViewBox[1] ? currentViewBox[1] : e.end,
        };
      })
  );
}

/**
 * Given operationalPoints and viewbox, this function returns
 * the cropped operationalPoints (and the computed position of the line in px)
 */
export function cropOperationPointsForDatavizViewbox(
  operationalPoints: Array<OperationalPoint>,
  currentViewBox: [number, number] | null,
  wrapper: MutableRefObject<HTMLDivElement | null>,
  fullLength: number
): Array<OperationalPoint & { positionInPx: number }> {
  if (wrapper.current !== null && fullLength > 0) {
    const wrapperWidth = wrapper.current.offsetWidth;
    return (
      [...operationalPoints]
        // we filter operational points that are inside the viewbox
        .filter(({ position }) => {
          if (!currentViewBox) return true;
          return !(position < currentViewBox[0] || currentViewBox[1] < position);
        })
        // we compute the vertical line position in px
        .map((operationalPoint) => {
          const lengthToDisplay = currentViewBox
            ? operationalPoint.position - currentViewBox[0]
            : operationalPoint.position;
          // subtract 2px for the display
          const positionInPx = (lengthToDisplay * wrapperWidth) / fullLength - 2;
          return {
            ...operationalPoint,
            positionInPx,
          };
        })
    );
  }
  return [];
}

/**
 * Given operationalPoints and a point, this function returns
 * the closest operationalPoint if it is closer than 10px to the point, else return null
 */
export function getClosestOperationalPoint(
  position: number,
  operationalPoints: Array<OperationalPoint & { positionInPx: number }>
): (OperationalPoint & { positionInPx: number }) | null {
  if (isEmpty(operationalPoints)) return null;
  const sortedOperationalPoints = sortBy(operationalPoints, (op) =>
    Math.abs(position - op.positionInPx)
  );
  const closestPoint = sortedOperationalPoints[0];
  return Math.abs(position - closestPoint.positionInPx) <= 10 ? closestPoint : null;
}

/**
 * Do the impact on the linear metadata for a modification on lineString.
 */
export function entityDoUpdate<T extends EditorEntity>(entity: T, sourceLine: LineString): T {
  const newProps: EditorEntity['properties'] = { id: entity.properties.id };

  // The modification of the linestring modifies the entity real properties only during initialization.
  const isInitialization = sourceLine.coordinates.length === 0;
  if (entity.geometry.type === 'LineString' && !isNil(entity.properties) && isInitialization) {
    Object.keys(entity.properties).forEach((name) => {
      const value = (entity.properties as { [key: string]: unknown })[name];
      // is a LM ?
      if (isArray(value) && value.length > 0 && !isNil(value[0].begin) && !isNil(value[0].end)) {
        newProps[name] = update(sourceLine, entity.geometry as LineString, value);
      } else {
        newProps[name] = value;
      }
    });
    newProps.length = getLineStringDistance(entity.geometry);
    return { ...entity, properties: newProps };
  }
  return entity;
}

/**
 * In a form for a field, compute/enhance its JSON schema,
 * By adding min & max on 'begin' & 'end' sub-fields if needed.
 * For a linear Metadata
 */
export function getFieldJsonSchema(
  fieldSchema: JSONSchema7,
  rootSchema: JSONSchema7,
  requiredFilter?: (required: string[]) => string[],
  enhancement: { [key: string]: JSONSchema7Definition } = {}
): JSONSchema7 {
  let result = { ...fieldSchema };
  if (fieldSchema.items) {
    const itemsSchema = retrieveSchema(validator, fieldSchema.items as JSONSchema7, rootSchema);
    if (itemsSchema.properties?.begin && itemsSchema.properties?.end) {
      result = {
        ...result,
        items: {
          ...itemsSchema,
          required:
            requiredFilter && itemsSchema.required && isArray(itemsSchema.required)
              ? requiredFilter(itemsSchema.required)
              : itemsSchema.required,
          properties: {
            begin: {
              ...(itemsSchema.properties?.begin as JSONSchema7),
              ...(enhancement.begin as JSONSchema7),
            },
            end: {
              ...(itemsSchema.properties?.end as JSONSchema7),
              ...(enhancement.end as JSONSchema7),
            },
            ...Object.keys(itemsSchema.properties || {})
              .filter((k) => !['begin', 'end'].includes(k))
              .map((k) => ({
                name: k,
                schema: itemsSchema.properties ? itemsSchema.properties[k] : {},
              }))
              .reduce(
                (acc, curr) => {
                  acc[curr.name] = {
                    ...(curr.schema as JSONSchema7),
                    ...(enhancement[curr.name] as JSONSchema7),
                  };
                  return acc;
                },
                {} as { [key: string]: JSONSchema7Definition }
              ),
          },
        },
        definitions: rootSchema.definitions,
      } as JSONSchema7;
    }
  }
  return result;
}

/**
 * Helper function that move the viewbox so the selected element is visible.
 */
export function viewboxForSelection(
  data: Array<LinearMetadataItem>,
  vb: [number, number] | null,
  selected: number
): [number, number] | null {
  // case of no zoom
  if (vb === null) return null;

  // if the selected is left outside
  if (data[selected].end <= vb[0]) {
    return translateViewBox(data, vb, data[selected].begin - vb[0]);
  }
  // if the selected is right outside
  if (vb[1] <= data[selected].begin) {
    return translateViewBox(data, vb, data[selected].end - vb[1]);
  }
  return vb;
}
