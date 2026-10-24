import { describe, it, expect } from 'vitest';

import type { TrackState } from 'applications/editor/tools/rangeEdition/types';
import type { TrackSectionEntity } from 'applications/editor/tools/trackEdition/types';

import type { OpEntity } from '../types';
import { canSaveOp, getEmptyOp, getPartFeatures } from '../utils';

const track = {
  type: 'Feature',
  objType: 'TrackSection',
  geometry: {
    type: 'LineString',
    coordinates: [
      [0, 0],
      [0.01, 0],
    ],
  },
  properties: { id: 'track', length: 1000 },
} as TrackSectionEntity;

const getOp = (properties: Partial<OpEntity['properties']> = {}): OpEntity => {
  const op = getEmptyOp();
  return {
    ...op,
    properties: {
      ...op.properties,
      id: 'op',
      name: 'Name',
      country_code: 'FR',
      main_code: 'ABC',
      parts: [{ track: 'track', position: 500, local_track_name: 'V1' }],
      ...properties,
    },
  };
};

describe('canSaveOp', () => {
  it('should accept a complete OP', () => {
    expect(canSaveOp(getOp())).toBe(true);
  });

  it('should reject an empty new OP', () => {
    expect(canSaveOp(getEmptyOp())).toBe(false);
  });

  it.each(['name', 'country_code', 'main_code'] as const)('should reject an empty %s', (key) => {
    expect(canSaveOp(getOp({ [key]: '' }))).toBe(false);
  });

  it('should reject an OP without parts', () => {
    expect(canSaveOp(getOp({ parts: [] }))).toBe(false);
  });

  it('should reject a part with an empty local track name', () => {
    const parts = [
      { track: 'track', position: 0, local_track_name: 'V1' },
      { track: 'track', position: 10, local_track_name: '' },
    ];
    expect(canSaveOp(getOp({ parts }))).toBe(false);
  });

  it('should reject a part with a blank local track name', () => {
    const parts = [{ track: 'track', position: 0, local_track_name: '  ' }];
    expect(canSaveOp(getOp({ parts }))).toBe(false);
  });
});

describe('getPartFeatures', () => {
  it('should place each part on its loaded track', () => {
    const cache: Record<string, TrackState> = { track: { type: 'success', track } };
    const features = getPartFeatures(getOp(), cache);

    expect(features).toHaveLength(1);
    expect(features[0].properties).toEqual({ partIndex: 0, track: 'track' });

    const [lng, lat] = features[0].geometry.coordinates;
    expect(lng).toBeCloseTo(0.005);
    expect(lat).toBeCloseTo(0);
  });

  it('should skip parts whose track is not loaded', () => {
    const cache: Record<string, TrackState> = { track: { type: 'loading' } };
    expect(getPartFeatures(getOp(), cache)).toEqual([]);
  });

  it('should keep part indexes when some parts are skipped', () => {
    const parts = [
      { track: 'other', position: 0, local_track_name: 'V1' },
      { track: 'track', position: 0, local_track_name: 'V2' },
    ];
    const cache: Record<string, TrackState> = { track: { type: 'success', track } };
    const features = getPartFeatures(getOp({ parts }), cache);

    expect(features).toHaveLength(1);
    expect(features[0].properties.partIndex).toBe(1);
  });
});
