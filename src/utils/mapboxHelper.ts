import bboxClip from '@turf/bbox-clip';

/* Types */
import { MapController } from 'react-map-gl';
import { MjolnirEvent } from 'react-map-gl/dist/es5/utils/map-controller';
import { BBox } from '@turf/helpers';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import bboxPolygon from '@turf/bbox-polygon';
import {
  Feature,
  FeatureCollection,
  LineString,
  MultiLineString,
  Point,
  MultiPoint,
  Position,
} from 'geojson';
import { flatten } from 'lodash';

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

  setHandler(handler: MjolnirHandler) {
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
 * This helper takes a Feature *or* a FeatureCollection and a bounding box, and returns the input
 * Feature or FeatureCollection, but clipped inside the bounding box. It filters out Points and
 * MultiPoints, and clips LineStrings and MultiLineStrings using @turf/bboxClip.
 */
export function clip<T extends Feature | FeatureCollection>(tree: T, bbox: BBox): T | null {
  if (tree.type === 'FeatureCollection') {
    return {
      ...tree,
      features: (tree as FeatureCollection).features.flatMap((f) => {
        const res = clip(f, bbox);
        if (!res) return [];
        return [res];
      }),
    };
  }

  if (tree.type === 'Feature') {
    const feature = tree as Feature;

    if (feature.geometry.type === 'LineString' || feature.geometry.type === 'MultiLineString') {
      return bboxClip(feature as Feature<LineString | MultiLineString>, bbox) as T;
    }

    const polygon = bboxPolygon(bbox);

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
            booleanPointInPolygon((feature as Feature<Point>).geometry.coordinates, polygon)
          ),
        },
      };

      return res.geometry.coordinates.length ? (res as T) : null;
    }
  }

  return tree;
}

/**
 * This helper takes a Feature or a FeatureCollection as input, and extracts all positions from each
 * LineString and MultiLineString in it, and return them as a Point Features array.
 */
export function extractPoints<T extends Feature | FeatureCollection>(tree: T): Feature<Point>[] {
  if (tree.type === 'FeatureCollection') {
    return (tree as FeatureCollection).features.flatMap((f) => extractPoints(f));
  }

  let positions: Position[] = [];
  let parentID: string = '';
  if (tree.type === 'Feature') {
    const feature = tree as Feature;

    if (feature.geometry.type === 'LineString') {
      parentID = feature.properties?.OP_id;
      positions = feature.geometry.coordinates;
    }

    if (feature.geometry.type === 'MultiLineString') {
      parentID = feature.properties?.OP_id;
      positions = flatten(feature.geometry.coordinates);
    }
  }

  return parentID
    ? positions.map((position, i) => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: position,
        },
        properties: {
          parentID: parentID,
          index: i,
          pointID: `${parentID}/${i}`,
        },
      }))
    : [];
}
