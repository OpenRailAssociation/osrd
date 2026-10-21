import { describe, it, expect } from 'vitest';

import type { EditorEntity } from 'applications/editor/typesEditorEntity';
import type { AppDispatch } from 'store';
import { NULL_GEOMETRY } from 'types';

import { getEntitiesBbox } from '../utils';

const mockDispatch = (() => {}) as unknown as AppDispatch;

const getPointEntity = (id: string, coordinates: [number, number]) =>
  ({
    type: 'Feature',
    objType: 'Signal',
    geometry: { type: 'Point', coordinates },
    properties: { id },
  }) as EditorEntity;

const emptyOp = {
  type: 'Feature',
  objType: 'OperationalPoint',
  geometry: NULL_GEOMETRY,
  properties: { id: 'op' },
} as EditorEntity;

describe('getEntitiesBbox', () => {
  it('should fit all given entities', async () => {
    const bbox = await getEntitiesBbox(
      1,
      [getPointEntity('a', [1, 2]), getPointEntity('b', [3, -1])],
      mockDispatch
    );
    expect(bbox).toEqual([
      [1, -1],
      [3, 2],
    ]);
  });

  it('should ignore entities without geometry', async () => {
    const bbox = await getEntitiesBbox(1, [emptyOp, getPointEntity('a', [1, 2])], mockDispatch);
    expect(bbox).toEqual([
      [1, 2],
      [1, 2],
    ]);
  });

  it('should return null when no entity has a geometry', async () => {
    expect(await getEntitiesBbox(1, [emptyOp], mockDispatch)).toBeNull();
  });
});
