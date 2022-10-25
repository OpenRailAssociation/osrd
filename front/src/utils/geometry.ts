import { Feature, Point, FeatureCollection, LineString } from 'geojson';
import { point, Position, featureCollection } from '@turf/helpers';
import bearing from '@turf/bearing';

// eslint-disable-next-line import/prefer-default-export
export function getTangent(
  tangentPoint: Position,
  line: Feature<LineString>
): FeatureCollection<Point> {
  const index = line.geometry.coordinates.findIndex(
    (pos) => pos[0] === tangentPoint[0] && pos[1] === tangentPoint[1]
  );
  let index1 = index - 1;
  let index2 = index + 1;
  if (index === 0) {
    index1 = 0;
    index2 = 1;
  }
  if (index === line.geometry.coordinates.length - 1) {
    index1 = index - 1;
    index2 = index;
  }
  const point1 = point(line.geometry.coordinates[index1]);
  const point2 = point(line.geometry.coordinates[index2]);
  return featureCollection([point1, point2]);
}

export function getCurrentBearing(line: Feature<LineString>) {
  const { coordinates } = line.geometry;
  const l = line.geometry.coordinates.length;
  return bearing(coordinates[l - 2], coordinates[l - 1]);
}
