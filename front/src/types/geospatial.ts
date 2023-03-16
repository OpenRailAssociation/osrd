import { Position, Geometry } from 'geojson';

export const NULL_GEOMETRY = {
  type: 'GeometryCollection',
  geometries: [] as Geometry[],
} as const;
export type NullGeometry = typeof NULL_GEOMETRY;

//
//  Geospatial types
//
export type Bbox = [Position, Position];
export type Path = Array<Position>;

export interface RectangleZone {
  type: 'rectangle';
  points: [Position, Position];
}
export interface PolygonZone {
  type: 'polygon';
  points: Position[];
}
export type Zone = RectangleZone | PolygonZone;
export type SourceLayer = 'sch' | 'geo';
