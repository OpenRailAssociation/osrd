import { BASE_WAYPOINT_HEIGHT, FOOTER_HEIGHT } from '../consts';

export const getHeightWithoutLastWaypoint = (height: number) =>
  height - FOOTER_HEIGHT - BASE_WAYPOINT_HEIGHT;

export const positionMmToKm = (position: number) => Math.round((position / 1000000) * 10) / 10;

export const msToS = (time: number) => time / 1000;

export const calcTotalDistance = <T extends { position: number }>(ops: T[]) =>
  ops.at(-1)!.position - ops.at(0)!.position;

type Point = {
  x: number;
  y: number;
};

export function getDistance(a: Point, b: Point): Point {
  return {
    x: b.x - a.x,
    y: b.y - a.y,
  };
}
