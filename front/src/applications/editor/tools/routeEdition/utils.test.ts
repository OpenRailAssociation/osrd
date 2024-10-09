import { lineString } from '@turf/helpers';
import length from '@turf/length';
import type { LineString, Point, Position } from 'geojson';
import { describe, it, expect } from 'vitest';

import { editoastToEditorEntity } from 'applications/editor/data/utils';
import type { DetectorEntity } from 'applications/editor/tools/pointEdition/types';
import type { TrackSectionEntity } from 'applications/editor/tools/trackEdition/types';

import { computeRouteGeometry, removeDuplicatePoints } from './utils';

const p1: Position = [-1.1, 49.5];
const p2: Position = [-1.2, 49.5];
const p3: Position = [-1.3, 49.5];
const p4: Position = [-1.4, 49.5];
const p5: Position = [-1.5, 49.5];
const path1 = [p1, p2, p3];
const path2 = [p3, p4, p5];
const l1 = length(lineString(path1));
const l2 = length(lineString(path2));

const ts1: TrackSectionEntity = editoastToEditorEntity(
  {
    railjson: {
      curves: [{ begin: 0.0, end: l1, radius: 0.0 }],
      extensions: { sncf: { line_code: 1, line_name: '1', track_name: '1', track_number: 1 } },
      geo: {
        coordinates: [p1, p2, p3],
        type: 'LineString',
      },
      id: 'ts1',
      length: l1,
      loading_gauge_limits: [],
      slopes: [{ begin: 0.0, end: l1, gradient: 0.0 }],
    },
    geographic: {
      coordinates: [p1, p2, p3],
      type: 'LineString',
    },
  },
  'TrackSection'
);
const ts2: TrackSectionEntity = editoastToEditorEntity(
  {
    railjson: {
      curves: [{ begin: 0.0, end: l2, radius: 0.0 }],
      extensions: { sncf: { line_code: 2, line_name: '2', track_name: '2', track_number: 2 } },
      geo: {
        coordinates: [p3, p4, p5],
        type: 'LineString',
      },
      id: 'ts2',
      length: l2,
      loading_gauge_limits: [],
      slopes: [{ begin: 0.0, end: l2, gradient: 0.0 }],
    },
    geographic: {
      coordinates: [p3, p4, p5],
      type: 'LineString',
    },
  },
  'TrackSection'
);
const d1: DetectorEntity<Point> = editoastToEditorEntity(
  {
    railjson: {
      applicable_directions: 'BOTH',
      id: 'd1',
      position: 0.0,
      track: 'ts1',
    },
    geographic: { coordinates: p1, type: 'Point' },
  },
  'Detector'
);
const d2: DetectorEntity<Point> = editoastToEditorEntity(
  {
    railjson: {
      applicable_directions: 'BOTH',
      id: 'd2',
      position: l1,
      track: 'ts1',
    },
    geographic: { coordinates: p3, type: 'Point' },
  },
  'Detector'
);
const d3: DetectorEntity<Point> = editoastToEditorEntity(
  {
    railjson: {
      applicable_directions: 'BOTH',
      id: 'd3',
      position: l2,
      track: 'ts2',
    },
    geographic: { coordinates: p5, type: 'Point' },
  },
  'Detector'
);

describe('getRouteGeometry(...) utils', () => {
  it('should work with a single track section', () => {
    expect(
      computeRouteGeometry({ ts1, ts2 }, d1, d2, [{ track: 'ts1', direction: 'START_TO_STOP' }])
        .geometry
    ).toEqual<LineString>(ts1.geometry);
  });
  it('should work with a single track section (backwards)', () => {
    expect(
      computeRouteGeometry({ ts1, ts2 }, d2, d1, [{ track: 'ts1', direction: 'STOP_TO_START' }])
        .geometry
    ).toEqual<LineString>({
      ...ts1.geometry,
      coordinates: ts1.geometry.coordinates.slice(0).reverse(),
    });
  });

  it('should work with two track sections', () => {
    expect(
      computeRouteGeometry({ ts1, ts2 }, d1, d3, [
        { track: 'ts1', direction: 'START_TO_STOP' },
        { track: 'ts2', direction: 'START_TO_STOP' },
      ]).geometry
    ).toEqual<LineString>({
      ...ts1.geometry,
      coordinates: removeDuplicatePoints(ts1.geometry.coordinates.concat(ts2.geometry.coordinates)),
    });
  });
  it('should work with two track sections (backwards)', () => {
    expect(
      computeRouteGeometry({ ts1, ts2 }, d3, d1, [
        { track: 'ts2', direction: 'STOP_TO_START' },
        { track: 'ts1', direction: 'STOP_TO_START' },
      ]).geometry
    ).toEqual<LineString>({
      ...ts1.geometry,
      coordinates: removeDuplicatePoints(ts1.geometry.coordinates.concat(ts2.geometry.coordinates))
        .slice(0)
        .reverse(),
    });
  });
});
