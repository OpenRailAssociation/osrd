import type { Position, Geometry } from 'geojson';

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

export type RectangleZone = {
  type: 'rectangle';
  points: [Position, Position];
};
export type PolygonZone = {
  type: 'polygon';
  points: Position[];
};
export type Zone = RectangleZone | PolygonZone;
export type OmitLayer<T> = Omit<T, 'id' | 'source'>;
