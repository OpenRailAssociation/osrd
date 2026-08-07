import { describe, it, expect } from 'vitest';

import type { CoreOperationalPointOnPath } from 'common/api/osrdEditoastApi';
import type { PathStepV2 } from 'reducers/osrdconf/types';

import { groupOperationalPoints } from '../utils';

const makeStep = (key: string, uic: number, ch = 'BV'): PathStepV2 => ({
  key,
  location: {
    type: 'operational_point_part_reference',
    operational_point: { type: 'uic', uic, secondary_code: ch },
  },
  arrival: null,
  stopFor: null,
  theoreticalMargin: null,
  receptionSignal: null,
});

// A step matching no OP, as produced by a map-click waypoint
const makeTrackOffsetStep = (key: string): PathStepV2 => ({
  key,
  location: { type: 'track_offset', track: 'xxx', offset: 50 },
  arrival: null,
  stopFor: null,
  theoreticalMargin: null,
  receptionSignal: null,
});

const makeOp = (
  id: string,
  uic: number,
  secondaryCode = 'BV',
  position = 0
): CoreOperationalPointOnPath => ({
  id,
  name: `op-${id}`,
  uic,
  secondary_code: secondaryCode,
  main_code: '',
  country_code: 'FR',
  is_passenger_station: false,
  position,
  weight: null,
  part: { track: 'track-1', position: 0, local_track_name: 'V1' },
});

// Flatten a grouping result into ids, so a whole result reads as one shape
const summarize = (groups: ReturnType<typeof groupOperationalPoints>) =>
  groups.map((group) => ({
    step: group.requestedStep.key,
    requestedOp: group.requestedOp?.id,
    intermediates: group.intermediates.map((op) => op.id),
  }));

describe('groupOperationalPoints', () => {
  it('puts intermediate OPs between two requested steps in the first group', () => {
    const steps = [makeStep('s1', 1), makeStep('s2', 2)];
    const ops = [
      makeOp('o1', 1, 'BV', 0),
      makeOp('o2', 99, 'BV', 100),
      makeOp('o3', 98, 'BV', 200),
      makeOp('o4', 2, 'BV', 300),
    ];

    expect(summarize(groupOperationalPoints(ops, steps))).toEqual([
      { step: 's1', requestedOp: 'o1', intermediates: ['o2', 'o3'] },
      { step: 's2', requestedOp: 'o4', intermediates: [] },
    ]);
  });

  it('handles two adjacent requested steps with no intermediates between them', () => {
    const steps = [makeStep('s1', 1), makeStep('s2', 2), makeStep('s3', 3)];
    const ops = [
      makeOp('o1', 1, 'BV', 0),
      makeOp('o2', 2, 'BV', 100),
      makeOp('oMid', 99, 'BV', 150),
      makeOp('o3', 3, 'BV', 200),
    ];

    expect(summarize(groupOperationalPoints(ops, steps))).toEqual([
      { step: 's1', requestedOp: 'o1', intermediates: [] },
      { step: 's2', requestedOp: 'o2', intermediates: ['oMid'] },
      { step: 's3', requestedOp: 'o3', intermediates: [] },
    ]);
  });

  it('returns an empty array when there are no valid/located steps', () => {
    const emptyStep = { ...makeStep('s1', 1), location: null };
    expect(groupOperationalPoints([makeOp('o1', 1)], [emptyStep])).toEqual([]);
  });

  describe('with a middle step that matches no OP', () => {
    const steps = [makeStep('s1', 1), makeTrackOffsetStep('s2'), makeStep('s3', 3)];
    const ops = [
      makeOp('o1', 1, 'BV', 0),
      makeOp('oMid', 99, 'BV', 100),
      makeOp('o3', 3, 'BV', 200),
    ];

    it('without positions, falls oMid back under the previous matched step (s1)', () => {
      expect(summarize(groupOperationalPoints(ops, steps))).toEqual([
        { step: 's1', requestedOp: 'o1', intermediates: ['oMid'] },
        { step: 's2', requestedOp: undefined, intermediates: [] },
        { step: 's3', requestedOp: 'o3', intermediates: [] },
      ]);
    });

    it('with positions, files oMid under the step it actually follows (s2)', () => {
      const positions = new Map([
        ['s1', 0],
        ['s2', 50],
        ['s3', 200],
      ]);
      expect(summarize(groupOperationalPoints(ops, steps, positions))).toEqual([
        { step: 's1', requestedOp: 'o1', intermediates: [] },
        { step: 's2', requestedOp: undefined, intermediates: ['oMid'] },
        { step: 's3', requestedOp: 'o3', intermediates: [] },
      ]);
    });
  });

  describe('with an OP crossed twice along the path', () => {
    // The step targets the OP's second crossing (dupSecond, position 300)
    const steps = [makeStep('s1', 1), makeStep('sDup', 2), makeStep('s3', 3)];
    const ops = [
      makeOp('o1', 1, 'BV', 0),
      makeOp('dupFirst', 2, 'BV', 100),
      makeOp('dupSecond', 2, 'BV', 300),
      makeOp('o3', 3, 'BV', 400),
    ];

    it('without positions, falls back to the first crossing claiming the step', () => {
      expect(summarize(groupOperationalPoints(ops, steps))).toEqual([
        { step: 's1', requestedOp: 'o1', intermediates: [] },
        { step: 'sDup', requestedOp: 'dupFirst', intermediates: ['dupSecond'] },
        { step: 's3', requestedOp: 'o3', intermediates: [] },
      ]);
    });

    it('with positions, only the crossing at the step position claims it', () => {
      const positions = new Map([
        ['s1', 0],
        ['sDup', 300],
        ['s3', 400],
      ]);
      expect(summarize(groupOperationalPoints(ops, steps, positions))).toEqual([
        { step: 's1', requestedOp: 'o1', intermediates: ['dupFirst'] },
        { step: 'sDup', requestedOp: 'dupSecond', intermediates: [] },
        { step: 's3', requestedOp: 'o3', intermediates: [] },
      ]);
    });

    it('with a pinned track, only the crossing on that track claims it', () => {
      const pinnedStep: PathStepV2 = {
        ...makeStep('sDup', 2),
        location: {
          type: 'operational_point_part_reference',
          operational_point: { type: 'uic', uic: 2, secondary_code: 'BV' },
          local_track_name: 'V2',
        },
      };
      const onTrack = (op: CoreOperationalPointOnPath, localTrackName: string) => ({
        ...op,
        part: { ...op.part, local_track_name: localTrackName },
      });
      const trackedOps = [
        makeOp('o1', 1, 'BV', 0),
        onTrack(makeOp('dupFirst', 2, 'BV', 100), 'V1'),
        onTrack(makeOp('dupSecond', 2, 'BV', 300), 'V2'),
        makeOp('o3', 3, 'BV', 400),
      ];

      expect(
        summarize(groupOperationalPoints(trackedOps, [steps[0], pinnedStep, steps[2]]))
      ).toEqual([
        { step: 's1', requestedOp: 'o1', intermediates: ['dupFirst'] },
        { step: 'sDup', requestedOp: 'dupSecond', intermediates: [] },
        { step: 's3', requestedOp: 'o3', intermediates: [] },
      ]);
    });
  });

  describe('with one OP selected twice as two consecutive steps', () => {
    // sDupA and sDupB target the same OP (uic 2)
    const steps = [
      makeStep('s1', 1),
      makeStep('sDupA', 2),
      makeStep('sDupB', 2),
      makeStep('s3', 3),
    ];
    const ops = [makeOp('o1', 1, 'BV', 0), makeOp('o2', 2, 'BV', 100), makeOp('o3', 3, 'BV', 200)];

    it('collapses them into one group carrying a count', () => {
      const groups = groupOperationalPoints(ops, steps);
      expect(
        groups.map((group) => ({
          step: group.requestedStep.key,
          requestedOp: group.requestedOp?.id,
          count: group.duplicatesCount,
        }))
      ).toEqual([
        { step: 's1', requestedOp: 'o1', count: 1 },
        { step: 'sDupB', requestedOp: 'o2', count: 2 },
        { step: 's3', requestedOp: 'o3', count: 1 },
      ]);
    });
  });
});
