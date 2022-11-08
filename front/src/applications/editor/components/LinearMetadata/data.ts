import { Feature, Point, LineString, Position } from 'geojson';
import { last, differenceWith, cloneDeep, isEqual, sortBy, isArray, isNil, isObject } from 'lodash';
import { JSONSchema7, JSONSchema7Definition } from 'json-schema';
import { utils } from '@rjsf/core';
import lineSplit from '@turf/line-split';
import fnLength from '@turf/length';

import { EditorEntity } from '../../../../types';

export const LINEAR_METADATA_FIELDS = ['slopes', 'curves'];
// Min size of a linear metadata segment
export const SEGMENT_MIN_SIZE = 1;
// Delta error between the user length input and the length of the geometry
export const DISTANCE_ERROR_RANGE = 0.01;
// Zoom by 25%
const ZOOM_RATIO = 0.75;
// Min size (in meter) of the viewbox
const MIN_SIZE_TO_DISPLAY = 10;

/**
 *  Generic type for Linear Metadata
 */
export type LinearMetadataItem<T = { [key: string]: unknown }> = T & {
  begin: number;
  end: number;
};

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
 * When you change the size of a segment, you need to impact it on the chain.
 * What we do is to substract the gap from its neighbor (see beginOrEnd).
 *
 * @param linearMetadata  The linear metadata we work on, already sorted
 * @param itemChangeIndex The index in the linearMetadata of the changed element
 * @param gap The size we need to add (or remove if negative)
 * @param beginOrEnd do the change at begin or the end of the item ?
 * @param opts Options of this functions (like the min size of segment)
 * @throws An error if the given index doesn't exist
 * @returns An object composed of the new linearMetadata and its new position
 */
export function resizeSegment<T>(
  linearMetadata: Array<LinearMetadataItem<T>>,
  itemChangeIndex: number,
  gap: number,
  beginOrEnd: 'begin' | 'end' = 'end'
): { result: Array<LinearMetadataItem<T>>; newIndexMapping: Record<number, number | null> } {
  if (itemChangeIndex >= linearMetadata.length) throw new Error("Given index doesn't exist");

  const newIndexMapping = linearMetadata.reduce((acc, _curr, index) => {
    acc[index] = index;
    return acc;
  }, {} as Record<number, number | null>);

  if (itemChangeIndex === 0 && beginOrEnd === 'begin')
    return { result: linearMetadata, newIndexMapping };
  if (itemChangeIndex === linearMetadata.length - 1 && beginOrEnd === 'end')
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
 * Fix a linear metadata
 * - if empty it generate one
 * - if there is a gap at begin/end or inside, it is created
 * - if there is an overlaps, remove it
 * @param value The linear metadata
 * @param lineLength The full length of the linearmetadata (should be computed from the LineString or given by the user)
 * @param opts If defined, it allows the function to fill gaps with default field value
 */
export function fixLinearMetadataItems<T>(
  value: Array<LinearMetadataItem<T>> | undefined,
  lineLength: number,
  opts?: { fieldName: string; defaultValue: unknown }
): Array<LinearMetadataItem<T>> {
  // simple scenario
  if (!value || value.length === 0) {
    return [
      {
        begin: 0,
        end: lineLength,
        ...(opts ? { [opts.fieldName]: opts.defaultValue } : {}),
      } as LinearMetadataItem<T>,
    ];
  }

  // Order the array and fix it by filling gaps if there are some
  let fixedLinearMetadata = sortBy(value, ['begin']).flatMap((item, index, array) => {
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

  // if the fixed lm is bigger than the lineLeight (the opposite is not possible, we already fix gaps)
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
 * (recompute all the begin / end).
 * We change only one segment, others stay the same or are just translated.
 * This method should be call at every (unitary) change on the LineString.
 * TODO: cases on extremities
 *
 * @param sourceLine The Geo lineString, before the unitary changement
 * @param targetLine The Geo lineString, after the unitary changement
 * @param wrapper The linear metadata array (should be sorted)
 * @returns The linear metadata array.
 * @throws an error if the from params is not found in the linear metadata array.
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
  // TODO: an impovment can be to take the one in the middle if there are many
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
 *
 * @param linearMetadata The linear metadata we work on
 * @param distance The distance where we split the linear metadata
 * @returns A new linear metadata with one more segment
 * @throws An error when linear metadata is empty, or when the distance is outside
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
 * Merge a segment with one of its sibling, define by the policy.
 * NOTE: Property of selected item will override the sibling one.

 * @param linearMetadata The linear metadata we work on
 * @param index The element that will be merged
 * @returns A new linear metadata with one segment merged
 * @throws An error when the index or the sibling element is outside
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
 * Compute the new viewbox after a zoom.
 *
 * @param data The linear data
 * @param currentViewBox The actual viewbox (so before the zoom)
 * @param zoom The zoom operation (in or out)
 * @param point The point on the line on which the user zoom (in meter from the point 0)
 * @returns The zoomed viewbox, or null if the newbox is equal to the full display
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

  // if begin < min, it means that the begin is outside
  // so we need to add the diff at the end
  // otherwise, it means that the end is outside
  // so we need to add the diff at the begin
  if (begin < min) {
    return [min, end + (min - begin)];
  }
  return [begin - (end - max), max];
}

/**
 * Compute the new viewbox after a translation.
 *
 * @param data The linear data
 * @param currentViewBox The actual viewbox (so before the zoom)
 * @param translation The translation in meter
 * @returns The zoomed viewbox, or null if the newbox is equal to the full display
 */
export function transalteViewBox<T>(
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
    // new min is the min minus the transaltion or 0
    const newMin = currentViewBox[0] + translation > 0 ? currentViewBox[0] + translation : 0;
    return [newMin, newMin + distanceToDisplay];
  }

  // if translation on the right, we do it on the max
  // new max is the max plus the transaltion or max
  const newMax = currentViewBox[1] + translation < max ? currentViewBox[1] + translation : max;
  return [newMax - distanceToDisplay, newMax];
}

/**
 * Given a linearmetadata and viewbox, this function returns
 * the cropped linearmetadata (and also add the index)
 */
export function cropForDatavizViewbox(
  data: Array<LinearMetadataItem>,
  currentViewBox: [number, number] | null
): Array<LinearMetadataItem & { index: number }> {
  return (
    [...data]
      // we add the index so events are able to send the index
      // eslint-disable-next-line prefer-object-spread
      .map((segment, index) => Object.assign({}, segment, { index }))
      // we filter elements that croos or are inside the viewbox
      .filter((e) => {
        if (!currentViewBox) return true;
        // if one extrimity is in (ie. overlaps or full in)
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
          index: e.index,
          begin: e.begin < currentViewBox[0] ? currentViewBox[0] : e.begin,
          end: e.end > currentViewBox[1] ? currentViewBox[1] : e.end,
        };
      })
  );
}

/**
 * Given a JSON schema, return the props name that are a linear metadata.
 * A Linear metadata is an array type with a ref
 * The ref should contains a begin & end
 */
export function getLinearMetadataProperties(schema: JSONSchema7): Array<string> {
  return Object.keys(schema?.properties || {})
    .map((prop) => {
      const propSchema = (schema?.properties || {})[prop] as JSONSchema7;
      /* eslint-disable dot-notation */
      if (
        LINEAR_METADATA_FIELDS.includes(prop) &&
        propSchema.type === 'array' &&
        isObject(propSchema.items) &&
        (propSchema.items as JSONSchema7)['$ref']
      ) {
        const refName = ((propSchema.items as JSONSchema7)['$ref'] || '').replace(
          '#/definitions/',
          ''
        );
        const refSchema = (schema.definitions || {})[refName] as JSONSchema7;
        /* eslint-enable dot-notation */
        if (
          refSchema &&
          refSchema.properties &&
          refSchema.properties.begin &&
          refSchema.properties.end
        )
          return prop;
      }
      return null;
    })
    .filter((n) => n !== null) as Array<string>;
}

/**
 * TODO: need to be check and tested (specially the underlying update function)
 * Do the impact on the linear metadata for a modification on lineString.
 *
 * @param entity The entity that has been modified and need to be impacted
 * @param sourceLine The original LineString (before the change)
 * @returns The entity modified in adquation
 */
export function entityDoUpdate<T extends EditorEntity>(entity: T, sourceLine: LineString): T {
  if (entity.geometry.type === 'LineString' && !isNil(entity.properties)) {
    const newProps: EditorEntity['properties'] = {};
    Object.keys(entity.properties).forEach((name) => {
      const value = (entity.properties as { [key: string]: unknown })[name];
      // is a LM ?
      if (isArray(value) && value.length > 0 && !isNil(value[0].begin) && !isNil(value[0].end)) {
        newProps[name] = update(sourceLine, entity.geometry as LineString, value);
      } else {
        newProps[name] = value;
      }
    });
    // eslint-disable-next-line dot-notation
    newProps['length'] = getLineStringDistance(entity.geometry as LineString);

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
  enhancement: { [key: string]: JSONSchema7Definition } = {}
): JSONSchema7 {
  let result = { ...fieldSchema };
  if (fieldSchema.items) {
    const itemsSchema = utils.retrieveSchema(fieldSchema.items as JSONSchema7, rootSchema);
    if (itemsSchema.properties?.begin && itemsSchema.properties?.end) {
      /* eslint-disable prefer-object-spread */
      result = {
        ...result,
        items: {
          ...itemsSchema,
          properties: {
            begin: Object.assign(
              {},
              itemsSchema.properties?.begin || {},
              enhancement.begin ? enhancement.begin : {}
            ),
            end: Object.assign(
              {},
              itemsSchema.properties?.end || {},
              enhancement.end ? enhancement.end : {}
            ),
            ...Object.keys(itemsSchema.properties || {})
              .filter((k) => !['begin', 'end'].includes(k))
              .map((k) => ({
                name: k,
                schema: itemsSchema.properties ? itemsSchema.properties[k] : {},
              }))
              .reduce((acc, curr) => {
                acc[curr.name] = Object.assign(
                  {},
                  curr.schema,
                  enhancement[curr.name] ? enhancement[curr.name] : {}
                );
                return acc;
              }, {} as { [key: string]: JSONSchema7Definition }),
          },
        },
        definitions: rootSchema.definitions,
      } as JSONSchema7;
      /* eslint-enable prefer-object-spread */
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
    return transalteViewBox(data, vb, data[selected].begin - vb[0]);
  }
  // if the selected is right outside
  if (vb[1] <= data[selected].begin) {
    return transalteViewBox(data, vb, data[selected].end - vb[1]);
  }
  return vb;
}
