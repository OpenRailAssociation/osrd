import type { Point } from '../../common/types';

export function getDiff(a: Point, b: Point): Point {
  return {
    x: b.x - a.x,
    y: b.y - a.y,
  };
}
