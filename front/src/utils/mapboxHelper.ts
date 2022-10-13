import bboxClip from '@turf/bbox-clip';
import { chunk } from 'lodash';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import booleanIntersects from '@turf/boolean-intersects';
import bbox from '@turf/bbox';
import lineIntersect from '@turf/line-intersect';
import lineSlice from '@turf/line-slice';
import { MapController, ViewportProps, WebMercatorViewport } from 'react-map-gl';
import { MjolnirEvent } from 'react-map-gl/dist/es5/utils/map-controller';
import { BBox, Coord, featureCollection } from '@turf/helpers';
import {
  Feature,
  FeatureCollection,
  LineString,
  MultiLineString,
  Point,
  MultiPoint,
  Position,
  Polygon,
} from 'geojson';
import nearestPointOnLine from '@turf/nearest-point-on-line';
import nearestPoint, { NearestPoint } from '@turf/nearest-point';

import { Zone } from '../types';
import { getAngle } from '../applications/editor/data/utils';

/**
 * This class allows binding keyboard events to react-map-gl. Since those events are not supported
 * by the lib, you can instantiate this KeyDownMapController and give it to your ReactMapGL
 * component as the `controller` prop, and keep its handler function up to date with an effect.
 */
type MjolnirHandler = (event: MjolnirEvent) => boolean;
export class KeyDownMapController extends MapController {
  handler: MjolnirHandler | undefined;

  constructor(handler: MjolnirHandler) {
    super();
    this.setHandler(handler);
  }

  setHandler(handler: MjolnirHandler): void {
    this.handler = handler;
  }

  handleEvent(event: MjolnirEvent): boolean {
    if (this.handler && event.type === 'keydown') {
      this.handler(event);
    }

    return super.handleEvent(event);
  }
}

/**
 * This helpers transforms a given Zone object to the related Feature object (mainly to use with
 * Turf).
 */
export function zoneToFeature(zone: Zone, close = false): Feature {
  switch (zone.type) {
    case 'rectangle': {
      const [[lat1, lon1], [lat2, lon2]] = zone.points;

      return {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [lat1, lon1],
              [lat2, lon1],
              [lat2, lon2],
              [lat1, lon2],
              [lat1, lon1],
            ],
          ],
        },
      };
    }
    case 'polygon': {
      return {
        type: 'Feature',
        properties: {},
        geometry: close
          ? {
              type: 'Polygon',
              coordinates: [[...zone.points, zone.points[0]]],
            }
          : {
              type: 'LineString',
              coordinates: zone.points,
            },
      };
    }
    default:
      throw new Error('Zone is neither a polygone, neither a rectangle');
  }
}

/**
 * Returns the BBox containing a given zone.
 */
export function zoneToBBox(zone: Zone): BBox {
  if (zone.type === 'rectangle') {
    const [[x1, y1], [x2, y2]] = zone.points;
    return [Math.min(x1, x2), Math.min(y1, y2), Math.max(x1, x2), Math.max(y1, y2)];
  }

  return bbox(zoneToFeature(zone, true));
}

/**
 * Helper to clip a line on a polygon.
 */
export function intersectPolygonLine(
  poly: Feature<Polygon>,
  line: Feature<LineString | MultiLineString>
): Feature<MultiLineString> | null {
  const lines: Position[][] =
    line.geometry.type === 'MultiLineString'
      ? line.geometry.coordinates
      : [line.geometry.coordinates];
  const res: Feature<MultiLineString> = {
    type: 'Feature',
    properties: line.properties,
    geometry: {
      type: 'MultiLineString',
      coordinates: [],
    },
  };

  lines.forEach((l) => {
    if (l.length < 2) return;

    const firstPoint: Point = { type: 'Point', coordinates: l[0] };
    const lastPoint: Point = { type: 'Point', coordinates: l[l.length - 1] };
    let intersections: Point[] = lineIntersect(
      { type: 'LineString', coordinates: l },
      poly
    ).features.map((f) => f.geometry);

    if (booleanPointInPolygon(firstPoint, poly)) intersections = [firstPoint].concat(intersections);
    if (booleanPointInPolygon(lastPoint, poly)) intersections.push(lastPoint);

    const splitters = chunk(intersections, 2).filter((pair) => pair.length === 2) as [
      Point,
      Point
    ][];

    splitters.forEach(([start, end]) => {
      res.geometry.coordinates.push(
        lineSlice(start.coordinates, end.coordinates, { type: 'LineString', coordinates: l })
          .geometry.coordinates
      );
    });
  });

  return res.geometry.coordinates.length ? res : null;
}

/**
 * This helper takes a Feature *or* a FeatureCollection and a bounding zone, and returns the input
 * Feature or FeatureCollection, but clipped inside the bounding zone. It filters out Points and
 * MultiPoints, and clips LineStrings and MultiLineStrings using @turf/bboxClip (when possible).
 */
export function clip<T extends Feature | FeatureCollection>(tree: T, zone: Zone): T | null {
  if (tree.type === 'FeatureCollection') {
    return {
      ...tree,
      features: (tree as FeatureCollection).features.flatMap((f) => {
        const res = clip(f, zone);
        if (!res) return [];
        return [res];
      }),
    };
  }

  if (tree.type === 'Feature') {
    const feature = tree as Feature;

    if (feature.geometry.type === 'LineString' || feature.geometry.type === 'MultiLineString') {
      if (zone.type === 'polygon') {
        const clipped = intersectPolygonLine(
          zoneToFeature(zone, true) as Feature<Polygon>,
          feature as Feature<LineString | MultiLineString>
        );
        return clipped ? (clipped as T) : null;
      }

      const clipped = bboxClip(
        feature as Feature<LineString | MultiLineString>,
        zoneToBBox(zone)
      ) as Feature<LineString | MultiLineString>;
      return clipped.geometry.coordinates.length ? (clipped as T) : null;
    }

    const polygon = zoneToFeature(zone, true).geometry as Polygon;

    if (feature.geometry.type === 'Point') {
      return booleanPointInPolygon((feature as Feature<Point>).geometry.coordinates, polygon)
        ? tree
        : null;
    }

    if (feature.geometry.type === 'MultiPoint') {
      const res: Feature<MultiPoint> = {
        ...feature,
        geometry: {
          ...feature.geometry,
          coordinates: feature.geometry.coordinates.filter((position) =>
            booleanPointInPolygon(position, polygon)
          ),
        },
      };

      return res.geometry.coordinates.length ? (res as T) : null;
    }
  }

  return tree;
}

/**
 * This helpers takes an array of GeoJSON objects (as the editor data we use) and a zone, and
 * returns a selection of all items in the given dataset intersecting with the given zone. If no
 * zone is given, selects everything instead.
 */
export function selectInZone<T extends Feature>(data: Array<T>, zone?: Zone): T[] {
  const items: T[] = [];
  const zoneFeature = zone && zoneToFeature(zone, true);

  data.forEach((geojson) => {
    if (!zoneFeature || booleanIntersects(geojson, zoneFeature)) {
      items.push(geojson);
    }
  });

  return items;
}

/**
 * This helpers takes a zone and a screen size and returns the smallest viewport that contains the
 * zone.
 */
export function getZoneViewport(
  zone: Zone,
  viewport: { width: number; height: number }
): ViewportProps {
  const [minLng, minLat, maxLng, maxLat] = zoneToBBox(zone);
  const vp = new WebMercatorViewport(viewport);
  const { longitude, latitude, zoom } = vp.fitBounds(
    [
      [minLng, minLat],
      [maxLng, maxLat],
    ],
    {
      padding: 40,
    }
  );

  return {
    latitude,
    longitude,
    zoom,
    bearing: 0,
    pitch: 0,
  };
}

/**
 * Given a list of points (as [lng, lat] point coordinates), returns the proper GeoJSON object to
 * draw a line joining them
 */
export function getLineGeoJSON(points: Position[]): Feature {
  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'LineString',
      coordinates: points,
    },
  };
}

/**
 * Give a list of lines or multilines and a specific position, returns the nearest point to that
 * position on any of those lines.
 */
export function getNearestPoint(lines: Feature<LineString>[], coord: Coord): NearestPoint {
  const nearestPoints: Feature<Point>[] = lines.map((line) => {
    const point = nearestPointOnLine(line, coord, { units: 'meters' });
    const angle = getAngle(
      line.geometry.coordinates[point.properties.index as number],
      line.geometry.coordinates[(point.properties.index as number) + 1]
    );
    return {
      ...point,
      properties: {
        ...point.properties,
        ...line.properties,
        angleAtPoint: angle,
      },
    };
  });

  return nearestPoint(coord, featureCollection(nearestPoints));
}
