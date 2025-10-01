import { describe, it, expect } from 'vitest';

import type { TimetableItem } from 'reducers/osrdconf/types';

import type { ConflictWithTrainNames } from '../types';
import addTrainNamesToConflicts, { filterAndReorderConflict } from '../utils';
import { trainScheduleId, pacedId, occurrenceId, conflictBase } from './sampleData';

describe('addTrainNamesToConflicts', () => {
  it('combines schedule and occurrence names', () => {
    const trains: TimetableItem[] = [
      {
        id: trainScheduleId(10),
        train_name: 'TS 1234',
        category: null,
      } as TimetableItem,
      {
        id: pacedId(20),
        train_name: 'PT 4567',
        category: null,
        exceptions: [{ key: 'abc', train_name: { value: 'PT 5678/9' } }],
      } as TimetableItem,
    ];

    const conflict = conflictBase({
      train_schedule_ids: [10],
      paced_train_occurrence_ids: [
        { paced_train_id: 20, index: 8 },
        { paced_train_id: 20, exception_key: 'abc' },
      ],
    });

    const [enriched] = addTrainNamesToConflicts([conflict], trains);
    expect(enriched.trainsData.map((train) => train.name)).toEqual([
      'TS 1234',
      'PT 4583',
      'PT 5678/9',
    ]);
  });
});

describe('filterAndReorderConflict - filtering', () => {
  it('keeps conflict when name matches', () => {
    const conflict: ConflictWithTrainNames = {
      ...conflictBase({ train_schedule_ids: [2] }),
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
      ...conflictBase({ train_schedule_ids: [1] }),
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
