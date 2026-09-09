import { describe, it, expect } from 'vitest';

import type { TrainScheduleResponse } from 'common/api/osrdEditoastApi';
import { mapBy } from 'utils/types';

import type { ConflictWithTrainNames } from '../types';
import addTrainNamesToConflicts, {
  filterAndReorderConflict,
  reorderConflictTrainsByScheduleId,
} from '../utils';
import { trainScheduleId, occurrenceId, conflictBase } from './sampleData';

describe('addTrainNamesToConflicts', () => {
  it('combines schedule and occurrence names', () => {
    const trains: TrainScheduleResponse[] = [
      {
        id: 10,
        train_name: 'TS 1234',
        category: null,
      } as TrainScheduleResponse,
      {
        id: 20,
        train_name: 'PT 4567',
        category: null,
        paced: { exceptions: [{ key: '1', id: 1, train_name: { value: 'ABC' } }] },
      } as TrainScheduleResponse,
    ];

    const conflict = conflictBase({
      train_ids: [
        { train_schedule_id: 10, type: 'base', index: 0 },
        { train_schedule_id: 20, type: 'base', index: 8 },
        { train_schedule_id: 20, type: 'created', exception_id: 1 },
      ],
    });

    const [enriched] = addTrainNamesToConflicts([conflict], mapBy(trains, 'id'));
    expect(enriched.trainsData.map((train) => train.name)).toEqual(['TS 1234', 'PT 4583', 'ABC']);
  });
});

describe('filterAndReorderConflict - filtering', () => {
  it('keeps conflict when name matches', () => {
    const conflict: ConflictWithTrainNames = {
      ...conflictBase({
        train_ids: [{ train_schedule_id: 2, type: 'base', index: 0 }],
      }),
      trainsData: [
        { name: '1234', category: null },
        { name: '1236', category: null },
      ],
    };

    const kept = filterAndReorderConflict(conflict, trainScheduleId(1), '1234');
    expect(kept).not.toBeNull();
    expect(kept?.trainsData[0].name).toBe('1234');
  });

  it('drops conflict when name does not match', () => {
    const conflict: ConflictWithTrainNames = {
      ...conflictBase({ train_ids: [{ train_schedule_id: 1, type: 'base', index: 0 }] }),
      trainsData: [
        { name: '1234', category: null },
        { name: '1236', category: null },
      ],
    };

    const dropped = filterAndReorderConflict(conflict, trainScheduleId(1), '5555');
    expect(dropped).toBeNull();
  });

  it('keeps conflict for occurrences by name only', () => {
    const conflict: ConflictWithTrainNames = {
      ...conflictBase({}),
      trainsData: [
        { name: 'PT 4567/0', category: null },
        { name: 'ABCD', category: null },
      ],
    };
    const kept = filterAndReorderConflict(conflict, occurrenceId(20, 0), 'PT 4567/0');
    expect(kept).not.toBeNull();
  });
});

describe('filterAndReorderConflict - reordering', () => {
  it('keeps train at front when already first', () => {
    const conflict: ConflictWithTrainNames = {
      ...conflictBase({}),
      trainsData: [
        { name: '1234', category: null },
        { name: '1236', category: null },
        { name: 'ABCD', category: null },
      ],
    };

    const reordered = filterAndReorderConflict(conflict, occurrenceId(1, 0), '1234');
    expect(reordered!.trainsData[0].name).toBe('1234');
    expect(reordered!.trainsData).toEqual(conflict.trainsData);
  });

  it('moves the selected train name to front when not first', () => {
    const conflict: ConflictWithTrainNames = {
      ...conflictBase({}),
      trainsData: [
        { name: '1236', category: null },
        { name: 'ABCD', category: null },
        { name: '1234', category: null },
      ],
    };

    const reordered = filterAndReorderConflict(conflict, occurrenceId(1, 0), '1234');
    expect(reordered!.trainsData[0].name).toBe('1234');
    expect(reordered!.trainsData[1].name).toBe('1236');
    expect(reordered!.trainsData[2].name).toBe('ABCD');
  });
});

describe('reorderConflictTrainsByScheduleId', () => {
  it('moves all occurrences of the paced train to the front', () => {
    const conflict: ConflictWithTrainNames = {
      ...conflictBase({
        train_ids: [
          { train_schedule_id: 10, type: 'base', index: 0 },
          { train_schedule_id: 20, type: 'base', index: 1 },
          { train_schedule_id: 20, type: 'base', index: 3 },
          { train_schedule_id: 30, type: 'base', index: 0 },
        ],
      }),
      trainsData: [
        { name: 'Other', category: null },
        { name: 'PT 1', category: null },
        { name: 'PT 3', category: null },
        { name: 'AnotherLongName', category: null },
      ],
    };

    const reordered = reorderConflictTrainsByScheduleId(conflict, 20);
    expect(reordered.map((train) => train.name)).toEqual([
      'PT 1',
      'PT 3',
      'Other',
      'AnotherLongName',
    ]);
  });

  it('falls back to sorting by name length when no train matches', () => {
    const conflict: ConflictWithTrainNames = {
      ...conflictBase({
        train_ids: [
          { train_schedule_id: 10, type: 'base', index: 0 },
          { train_schedule_id: 30, type: 'base', index: 0 },
        ],
      }),
      trainsData: [
        { name: 'LongerName', category: null },
        { name: 'Short', category: null },
      ],
    };

    const reordered = reorderConflictTrainsByScheduleId(conflict, 99);
    expect(reordered.map((train) => train.name)).toEqual(['Short', 'LongerName']);
  });
});
