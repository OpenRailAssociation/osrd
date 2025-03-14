import { isPointPickingElement, isSegmentPickingElement } from '../components/PathLayer';
import { type HoveredItem, type Point } from '../lib/types';

/**
 * This function takes a point and a segment, and returns the point of the segment that is the
 * closest to the input point.
 */
export function getClosestPointOnSegment(
  point: Point,
  segmentFrom: Point,
  segmentTo: Point
): Point {
  const { x: px, y: py } = point;
  const { x: ax, y: ay } = segmentFrom;
  const { x: bx, y: by } = segmentTo;

  // Vector AB
  const abx = bx - ax;
  const aby = by - ay;
  // Vector AP
  const apx = px - ax;
  const apy = py - ay;

  // Dot product of AP and AB
  const dotProduct = apx * abx + apy * aby;
  // Length squared of AB
  const lengthSqAB = abx * abx + aby * aby;

  // Avoid division by zero if from and to are the same point
  if (lengthSqAB === 0) return { x: ax, y: ay };

  // Parameter t of the projection of point P onto the line AB
  let t = dotProduct / lengthSqAB;

  // Clamp t to the range [0, 1]
  if (t < 0) t = 0;
  else if (t > 1) t = 1;

  // Calculate the closest point using parameter t
  return {
    x: ax + t * abx,
    y: ay + t * aby,
  };
}

/**
 * This function helps to handle snapping with a SpaceTimeChat instance.
 */
export function snapPosition(mousePosition: Point, hoveredItem: HoveredItem | null) {
  if (!mousePosition || !hoveredItem) return mousePosition;

  if (isPointPickingElement(hoveredItem.element)) {
    return hoveredItem.element.point;
  } else if (isSegmentPickingElement(hoveredItem.element)) {
    return getClosestPointOnSegment(
      mousePosition,
      hoveredItem.element.from,
      hoveredItem.element.to
    );
  } else {
    return mousePosition;
  }
}
