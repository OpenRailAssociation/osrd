import { describe, it, expect } from 'vitest';

import type { SuggestedOP } from 'modules/trainSchedule/types';
import type { PathStepV2 } from 'reducers/osrdconf/types';

import { groupOperationalPoints } from '../utils';

const makeStep = (id: string, uic: number, ch = 'BV'): PathStepV2 => ({
  id,
  location: {
    type: 'operational_point_part_reference',
    operational_point: { type: 'uic', uic, secondary_code: ch },
  },
  arrival: null,
  stopFor: null,
  theoreticalMargin: null,
  receptionSignal: null,
});

const makeOp = (id: string, uic: number, ch = 'BV', positionOnPath = 0): SuggestedOP => ({
  opId: id,
  pathStepId: undefined,
  name: `op-${id}`,
  uic,
  ch,
  offsetOnTrack: 0,
  track: 'track-1',
  positionOnPath,
});

describe('groupOperationalPoints', () => {
  it('puts intermediate OPs between two requested steps in the first group', () => {
    const steps = [makeStep('s1', 1), makeStep('s2', 2)];
    const ops = [
      makeOp('o1', 1, 'BV', 0),
      makeOp('o2', 99, 'BV', 100),
      makeOp('o3', 98, 'BV', 200),
      makeOp('o4', 2, 'BV', 300),
    ];

    const groups = groupOperationalPoints(ops, steps);

    expect(groups).toHaveLength(2);
    expect(groups[0].requestedStep.id).toBe('s1');
    expect(groups[0].requestedOp?.opId).toBe('o1');
    expect(groups[0].intermediates.map((o) => o.opId)).toEqual(['o2', 'o3']);
    expect(groups[1].requestedStep.id).toBe('s2');
    expect(groups[1].requestedOp?.opId).toBe('o4');
    expect(groups[1].intermediates).toEqual([]);
  });

  it('handles two adjacent requested steps with no intermediates between them', () => {
    const steps = [makeStep('s1', 1), makeStep('s2', 2), makeStep('s3', 3)];
    const ops = [
      makeOp('o1', 1, 'BV', 0),
      makeOp('o2', 2, 'BV', 100),
      makeOp('oMid', 99, 'BV', 150),
      makeOp('o3', 3, 'BV', 200),
    ];

    const groups = groupOperationalPoints(ops, steps);

    expect(groups[0].intermediates).toEqual([]);
    expect(groups[1].intermediates.map((o) => o.opId)).toEqual(['oMid']);
    expect(groups[2].intermediates).toEqual([]);
  });

  it('returns an empty array when there are no valid/located steps', () => {
    const emptyStep: PathStepV2 = {
      id: 's1',
      location: null,
      arrival: null,
      stopFor: null,
      theoreticalMargin: null,
      receptionSignal: null,
    };
    expect(groupOperationalPoints([makeOp('o1', 1)], [emptyStep])).toEqual([]);
  });

  it('does not stall when a middle requested step matches no OP', () => {
    // Simulate a map-click waypoint that no returned OP matches:
    const trackOffsetStep: PathStepV2 = {
      id: 's2',
      location: { type: 'track_offset', track: 'xxx', offset: 50 },
      arrival: null,
      stopFor: null,
      theoreticalMargin: null,
      receptionSignal: null,
    };
    const steps = [makeStep('s1', 1), trackOffsetStep, makeStep('s3', 3)];
    const ops = [
      makeOp('o1', 1, 'BV', 0),
      makeOp('oMid', 99, 'BV', 100),
      makeOp('o3', 3, 'BV', 200),
    ];

    const groups = groupOperationalPoints(ops, steps);

    expect(groups).toHaveLength(3);
    expect(groups[0].requestedOp?.opId).toBe('o1');
    expect(groups[0].intermediates.map((o) => o.opId)).toEqual(['oMid']);
    expect(groups[1].requestedStep.id).toBe('s2');
    expect(groups[1].requestedOp).toBeUndefined();
    expect(groups[1].intermediates).toEqual([]);
    expect(groups[2].requestedStep.id).toBe('s3');
    expect(groups[2].requestedOp?.opId).toBe('o3');
  });
});
