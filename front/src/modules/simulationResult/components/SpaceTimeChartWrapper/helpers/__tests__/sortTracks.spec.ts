import { describe, it, expect } from 'vitest';

import { compareTracksByName, sortTracks } from '../sortTracks';

describe('compareTracksByName', () => {
  it('sorts numeric tracks by their first number', () => {
    const tracks = [
      { id: 'c', name: '3' },
      { id: 'a', name: '10' },
      { id: 'b', name: '1' },
    ];
    expect([...tracks].sort(compareTracksByName).map((t) => t.name)).toEqual(['1', '3', '10']);
  });

  it('sorts numeric tracks by name alphabetically when numbers are equal', () => {
    const tracks = [
      { id: 'b', name: 'B1' },
      { id: 'a', name: 'A1' },
    ];
    expect([...tracks].sort(compareTracksByName).map((t) => t.name)).toEqual(['A1', 'B1']);
  });

  it('sorts named tracks without numbers alphabetically', () => {
    const tracks = [
      { id: 'c', name: 'VC' },
      { id: 'a', name: 'VA' },
      { id: 'b', name: 'VB' },
    ];
    expect([...tracks].sort(compareTracksByName).map((t) => t.name)).toEqual(['VA', 'VB', 'VC']);
  });
});

describe('sortTracks', () => {
  it('preserves infra tracks order', () => {
    const infraTracks = [
      { id: 'b', name: 'B' },
      { id: 'a', name: 'A' },
    ];
    const result = sortTracks(infraTracks, []);
    expect(result.map((t) => t.id)).toEqual(['b', 'a']);
  });
  it('places infra tracks first, then sorted virtual tracks, then [ ]', () => {
    const infraTracks = [{ id: 'infra1', name: 'V1' }];
    const virtualTracks = [
      { id: '[ ]', name: undefined },
      { id: 'v2', name: '2' },
      { id: 'v1', name: '1' },
    ];

    const result = sortTracks(infraTracks, virtualTracks);

    expect(result.map((t) => t.id)).toEqual(['infra1', 'v1', 'v2', '[ ]']);
  });
});
