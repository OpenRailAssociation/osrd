import type { Position } from 'geojson';
import { type LayerProps } from 'react-map-gl';

export interface RectangleZone {
  type: 'rectangle';
  points: [Position, Position];
}
export interface PolygonZone {
  type: 'polygon';
  points: Position[];
}
export type Zone = RectangleZone | PolygonZone;

export type RequiredFor<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;

export interface SourceDefinition {
  id: string;
  url: string;
  layers: RequiredFor<LayerProps, 'id' | 'source-layer'>[];
}

export type BBox2D = [number, number, number, number];
