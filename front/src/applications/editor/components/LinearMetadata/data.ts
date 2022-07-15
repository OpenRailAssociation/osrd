import { FeatureCollection, Feature, Point, LineString, Position } from 'geojson';
import { tail, last, differenceWith, isEqual, sortBy } from 'lodash';
import distance from '@turf/distance';
import lineSplit from '@turf/line-split';
import length from '@turf/length';

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
 * Fix a linear metadata
 * - if empty it generate one
 * - if there is a gap at begin/end or inside, it is created
 * - if there is an overlaps, remove it
 */
export function fixLinearMetadataItems<T>(
  value: Array<LinearMetadataItem<T>> | undefined,
  line: LineString
): Array<LinearMetadataItem<T>> {
  // simple scenario
  if (!value || value.length === 0) {
    return create(line, {} as T, 'none');
  }

  const lineLength = length(lineStringToFeature(line)) * 1000;
  // Order the array and fix it if there a gap in it
  return sortBy(value, ['begin']).flatMap((item, index, array) => {
    let result: Array<LinearMetadataItem<T>> = [];

    if (index === 0) {
      // check for no gap at start
      if (item.begin !== 0) {
        result.push({ begin: 0, end: item.begin } as LinearMetadataItem<T>);
      }
      result.push(item);
    }

    if (index > 0) {
      const prev = array[index - 1];
      // normal way
      if (prev.end === item.begin) {
        result.push(item);
      }
      //
      // if there is gap with the previous
      if (prev.end < item.begin) {
        result.push({ begin: prev.end, end: item.begin } as LinearMetadataItem<T>);
        result.push(item);
      }
    }

    // Check for gap at the end
    if (index === array.length - 1 && item.end !== lineLength) {
      result.push({ begin: item.end, end: lineLength } as LinearMetadataItem<T>);
    }

    return result;
  });
}

/**
 * Given a  LineString, creates the linear metadata segmentationts.
 *
 * @param line The LineString on which we need to create the linear segments
 * @param initValue The value we use to init each segment
 * @returns The linear metadata array (sorted by begin/end).
 */
export function create<T>(
  line: LineString,
  initValue: T,
  cutting: 'none' | 'segment' = 'segment'
): Array<LinearMetadataItem<T>> {
  switch (cutting) {
    case 'none':
      return [
        {
          ...initValue,
          begin: 0,
          end: length(lineStringToFeature(line)) * 1000,
        },
      ];
    default:
      return tail(line.coordinates).reduce((acc, curr, index) => {
        // because we took the tail, the index match the prev index in the original array
        const start = line.coordinates[index];
        // compute the distance between start & end in meter
        const length = distance(coordinateToFeature(start), coordinateToFeature(curr)) * 1000;
        // compute the begin distance
        const begin = index > 0 ? acc[index - 1].end : 0;
        acc.push({
          begin,
          end: begin + length,
          ...initValue,
        });
        return acc;
      }, [] as Array<LinearMetadataItem<T>>);
  }
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
  const pointDistance = length(sourceLineToPoint) * 1000;
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
    (length(lineStringToFeature(targetLine)) - length(lineStringToFeature(sourceLine))) * 1000;
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
 * When you change the size of a segment, you need to impact on the chain.
 * What we do is to substract the gap from its right neighbor.
 *
 * @param linearMetadata  The linear metadata we work on, already sorted
 * @param itemChangeIndex The index in the linearMetadata of the changed element
 * @param gap The size we need to add (or remove if negative)
 * @param opts Options of this functions (like the min size of segment)
 * @throws An error if the given index doesn't exist
 * @throws An error if gap is bigger than the sibling element
 * @throws An error if gap is negative and is bigger than the element size
 * @throws An error wrapper has NOT 2 element
 */
export function resizeSegment<T>(
  linearMetadata: Array<LinearMetadataItem<T>>,
  itemChangeIndex: number,
  gap: number,
  beginOrEnd: 'begin' | 'end' = 'end',
  opts: { segmentMinSize: number } = { segmentMinSize: 1 }
): Array<LinearMetadataItem<T>> {
  if (linearMetadata.length < 2) throw new Error('Linear metadata has less than 2 elements');
  if (itemChangeIndex >= linearMetadata.length) throw new Error("Given index doesn't exist");
  if (
    linearMetadata[itemChangeIndex].end - linearMetadata[itemChangeIndex].begin + gap <
    opts.segmentMinSize
  )
    throw new Error('There is not enought space on the element');

  // if you try to edit begin on first segment
  if (itemChangeIndex === 0 && beginOrEnd === 'begin') {
    throw new Error("Can't change begin on first segment");
  }

  return linearMetadata.map((item, index) => {
    let result = { ...item };
    if (beginOrEnd === 'begin') {
      if (index === itemChangeIndex - 1) {
        result.end = result.end + gap;
      }
      if (index === itemChangeIndex) {
        result.begin = result.begin + gap;
      }
    } else {
      if (index === itemChangeIndex) {
        result.end = result.end + gap;
      }
      if (index === itemChangeIndex + 1) {
        result.begin = result.begin + gap;
      }
    }
    return result;
  });
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
      } else {
        return [item];
      }
    })
    .flat();
}

/**
 * Merge a segment with one of its sibling, define by the policy.
 * NOTE: Property of selected item will be lost,we take the ones from the sibling.

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
  if (!(0 <= index && index < linearMetadata.length)) throw new Error('Bad merge index');
  if (policy === 'left' && index === 0)
    throw new Error('Target segment is outside the linear metadata');
  if (policy === 'right' && index === linearMetadata.length - 1)
    throw new Error('Target segment is outside the linear metadata');

  if (policy === 'left') {
    const left = linearMetadata[index - 1];
    const element = linearMetadata[index];
    return [
      ...linearMetadata.slice(0, index - 1),
      { ...left, end: element.end },
      ...linearMetadata.slice(index + 1),
    ];
  } else {
    const right = linearMetadata[index + 1];
    const element = linearMetadata[index];
    return [
      ...linearMetadata.slice(0, index),
      { ...right, begin: element.begin },
      ...linearMetadata.slice(index + 2),
    ];
  }
}

// Zoom by 25%
const ZOOM_RATIO = 0.75;
// Min size (in meter) of the viewbox
const MIN_SIZE_TO_DISPLAY = 10;

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

  const viewBox: [number, number] = currentViewBox ? currentViewBox : [min, max];
  let distanceToDisplay =
    (viewBox[1] - viewBox[0]) * (zoom === 'IN' ? ZOOM_RATIO : 1 - ZOOM_RATIO + 1);

  // if the distance to display if higher than the original one
  // we display everything, so return null
  if (distanceToDisplay >= fullDistance) return null;

  // if distance is too small we are at the max zoom level
  if (distanceToDisplay < MIN_SIZE_TO_DISPLAY) distanceToDisplay = MIN_SIZE_TO_DISPLAY;

  // Compute the point on which we do the zoom
  const point = onPoint ? onPoint : viewBox[0] + (viewBox[1] - viewBox[0]) / 2;

  // let's try to add the distance on each side
  let begin = point - distanceToDisplay / 2;
  let end = point + distanceToDisplay / 2;
  if (min <= begin && end <= max) {
    return [begin, end];
  }

  // if begin < min, it means that the begin is outside
  // so we need to add the diff at the end
  // otherwise, it means that the end is outside
  // so we need to add the diff at the begin
  if (begin < min) {
    return [min, end + (min - begin)];
  } else {
    return [begin - (end - max), max];
  }
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

  const min = data[0].begin;
  const max = last(data)?.end || 0;
  const distanceToDisplay = currentViewBox[1] - currentViewBox[0];

  // if translation on the left, we do it on the min
  if (translation < 0) {
    // new min is the min minus the transaltion or 0
    const newMin = currentViewBox[0] + translation > 0 ? currentViewBox[0] + translation : 0;
    return [newMin, newMin + distanceToDisplay];
  }
  // if translation on the right, we do it on the max
  else {
    // new max is the max plus the transaltion or max
    const newMax = currentViewBox[1] + translation < max ? currentViewBox[1] + translation : max;
    return [newMax - distanceToDisplay, newMax];
  }
}
