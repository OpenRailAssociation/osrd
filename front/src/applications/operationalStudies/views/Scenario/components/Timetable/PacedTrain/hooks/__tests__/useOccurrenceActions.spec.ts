import { type ReactNode, createElement } from 'react';

import { getTestStore, renderHookWithStore } from 'store/__tests__';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TimetableContext } from 'applications/operationalStudies/hooks/useTimetableContext';
import { mockOsrdEditoastEndpoints } from 'common/api/__mocks__/osrdEditoastApi';

import { formatTrainScheduleWithDetailsToTrainSchedule } from '../../../../ManageTrainSchedule/helpers/formatTrainSchedulePayload';
import useOccurrenceActions from '../useOccurrenceActions';
import {
  addedExceptionOccurrence,
  occurrence1,
  occurrence2,
  pacedTrainSchedule,
  pacedTrainWithAddedException,
  pacedTrainWithExceptions,
  rollingStock,
} from './consts';

const {
  putTrainScheduleExceptionById,
  postTimetableByIdTrainScheduleException,
  postTrainScheduleExceptionsDelete,
} = mockOsrdEditoastEndpoints;

const mockSelectPacedTrainToEdit = vi.fn();
const mockUpsertTrainSchedules = vi.fn();

const buildOccurrenceActionsArgs = (
  pacedTrain = { ...pacedTrainSchedule },
  occurrences = [{ ...occurrence1 }]
) => ({
  pacedTrain,
  occurrences,
  selectPacedTrainToEdit: mockSelectPacedTrainToEdit,
  timetableId: 1,
});

const timetableContextWrapper = ({ children }: { children: ReactNode }) =>
  createElement(
    TimetableContext.Provider,
    {
      value: {
        trainSchedules: new Map(),
        removeTrainSchedules: () => {},
        upsertTrainSchedules: mockUpsertTrainSchedules,
        updateTrainScheduleDepartureTime: async () => {},
      },
    },
    children
  );

describe('useOccurrenceActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should correctly toggle the selection of one occurrence', () => {
    const { result, rerender } = renderHookWithStore(
      () => useOccurrenceActions(buildOccurrenceActionsArgs()),
      { wrapper: timetableContextWrapper }
    );
    const store = getTestStore();

    expect(store.getState().simulation.selectedTrain).toStrictEqual(undefined);

    result.current.toggleOccurrenceSelection(occurrence1.id);

    expect(store.getState().simulation.selectedTrain).toStrictEqual({
      id: occurrence1.id,
      by: 'timetable',
    });

    rerender();

    result.current.toggleOccurrenceSelection(occurrence1.id);

    expect(store.getState().simulation.selectedTrain).toStrictEqual(undefined);
  });

  it('should select occurrence for projection', () => {
    const { result } = renderHookWithStore(
      () => useOccurrenceActions(buildOccurrenceActionsArgs()),
      { wrapper: timetableContextWrapper }
    );
    const store = getTestStore();

    expect(store.getState().simulation.trainIdUsedForProjection).toBe(undefined);

    result.current.selectOccurrenceForProjection(occurrence1.id);

    expect(store.getState().simulation.trainIdUsedForProjection).toBe(occurrence1.id);
  });

  it('should edit paced train', () => {
    const { result } = renderHookWithStore(
      () => useOccurrenceActions(buildOccurrenceActionsArgs()),
      { wrapper: timetableContextWrapper }
    );

    result.current.editOccurrence({
      ...occurrence1,
      ...{
        trainName: 'New Cool Train',
        rollingStock: {
          ...rollingStock,
          name: 'Thomas',
        },
        startTime: new Date('27/07/2026'),
      },
    });

    expect(mockSelectPacedTrainToEdit).toHaveBeenCalledExactlyOnceWith(
      {
        ...pacedTrainSchedule,
        name: 'New Cool Train',
        rollingStock: {
          ...occurrence1.rollingStock,
          name: 'Thomas',
        },
        startTime: new Date('27/07/2026'),
      },
      pacedTrainSchedule,
      occurrence1.id
    );
  });

  it('should edit paced train with exceptions', () => {
    const { result } = renderHookWithStore(
      () => useOccurrenceActions(buildOccurrenceActionsArgs({ ...pacedTrainWithExceptions })),
      { wrapper: timetableContextWrapper }
    );

    result.current.editOccurrence({
      ...occurrence1,
      ...{
        trainName: 'New Cool Train',
        rollingStock: {
          ...rollingStock,
          name: 'Thomas',
        },
        startTime: new Date('27/07/2026'),
      },
    });

    const [exception1] = pacedTrainWithExceptions.paced.exceptions;

    expect(mockSelectPacedTrainToEdit).toHaveBeenCalledExactlyOnceWith(
      {
        ...pacedTrainWithExceptions,
        name: exception1.train_name?.value,
        rollingStock: {
          ...occurrence1.rollingStock,
          name: 'Thomas',
        },
        startTime: new Date(exception1.start_time!.value),
      },
      pacedTrainWithExceptions,
      occurrence1.id
    );
  });

  it('should not enable an occurrence which was not disabled', async () => {
    const { result } = renderHookWithStore(
      () => useOccurrenceActions(buildOccurrenceActionsArgs()),
      { wrapper: timetableContextWrapper }
    );

    await expect(result.current.updateOccurrenceStatus(occurrence1, 'enable')).rejects.toThrow();
  });

  it('should create an exception if disabling an occurrence with none', async () => {
    postTimetableByIdTrainScheduleException.mockResolvedValue({
      data: {
        change_groups: {},
        disabled: false,
        id: 1002020,
        timetable_id: 1,
        train_schedule_id: 1,
      },
    });

    const { result } = renderHookWithStore(
      () => useOccurrenceActions(buildOccurrenceActionsArgs()),
      { wrapper: timetableContextWrapper }
    );

    await result.current.updateOccurrenceStatus(occurrence1, 'disabled');

    const formattedPacedTrain = formatTrainScheduleWithDetailsToTrainSchedule(pacedTrainSchedule);

    expect(mockUpsertTrainSchedules).toHaveBeenCalledWith([
      {
        ...formattedPacedTrain,
        id: pacedTrainSchedule.id,
        train_schedule_set_id: pacedTrainSchedule.train_schedule_set_id,
        paced: {
          ...formattedPacedTrain.paced,
          exceptions: [
            {
              disabled: true,
              id: 1002020,
              occurrence_index: occurrence1.occurrenceIndex,
              key: '',
            },
          ],
        },
      },
    ]);
  });

  it('should disable an occurrence with an exception', async () => {
    putTrainScheduleExceptionById.mockResolvedValue({
      data: [],
    });

    const [exception1] = pacedTrainWithExceptions.paced.exceptions;
    const { result } = renderHookWithStore(
      () =>
        useOccurrenceActions(
          buildOccurrenceActionsArgs({
            ...pacedTrainWithExceptions,
            paced: {
              ...pacedTrainWithExceptions.paced,
              exceptions: [
                {
                  ...exception1,
                  id: 100,
                },
              ],
            },
          })
        ),
      { wrapper: timetableContextWrapper }
    );

    await result.current.updateOccurrenceStatus(occurrence1, 'disabled');
    const exception1WithId = {
      ...exception1,
      id: 100,
    };

    const formattedPacedTrain = formatTrainScheduleWithDetailsToTrainSchedule({
      ...pacedTrainWithExceptions,
      paced: {
        ...pacedTrainWithExceptions.paced,
        exceptions: [exception1WithId],
      },
    });

    expect(mockUpsertTrainSchedules).toHaveBeenCalledWith([
      {
        ...formattedPacedTrain,
        id: pacedTrainWithExceptions.id,
        train_schedule_set_id: pacedTrainWithExceptions.train_schedule_set_id,
        paced: {
          ...formattedPacedTrain.paced,
          exceptions: [
            {
              ...exception1WithId,
              disabled: true,
            },
          ],
        },
      },
    ]);

    expect(putTrainScheduleExceptionById).toHaveBeenCalledWith({
      body: {
        change_groups: {
          start_time: exception1.start_time,
          train_name: exception1.train_name,
        },
        disabled: true,
        occurrence_index: occurrence1.occurrenceIndex,
        train_schedule_id: pacedTrainWithExceptions.id,
      },
      id: 100,
    });
  });

  it('should delete exception with no change group when updating occurrence status', async () => {
    postTrainScheduleExceptionsDelete.mockResolvedValue({
      data: [],
    });

    const noChangeException = {
      id: 200,
      key: 'occurrence_1_0',
      occurrence_index: 0,
      disabled: false,
    };

    const { result } = renderHookWithStore(
      () =>
        useOccurrenceActions(
          buildOccurrenceActionsArgs({
            ...pacedTrainSchedule,
            paced: {
              ...pacedTrainSchedule.paced,
              exceptions: [noChangeException],
            },
          })
        ),
      { wrapper: timetableContextWrapper }
    );

    await result.current.updateOccurrenceStatus(occurrence1, 'disabled');

    const formattedPacedTrain = formatTrainScheduleWithDetailsToTrainSchedule(pacedTrainSchedule);

    expect(mockUpsertTrainSchedules).toHaveBeenCalledWith([
      {
        ...formattedPacedTrain,
        id: pacedTrainSchedule.id,
        train_schedule_set_id: pacedTrainSchedule.train_schedule_set_id,
        paced: {
          ...formattedPacedTrain.paced,
          exceptions: [
            {
              ...noChangeException,
              disabled: true,
            },
          ],
        },
      },
    ]);

    expect(postTrainScheduleExceptionsDelete).toHaveBeenCalledWith({
      body: {
        ids: [200],
      },
    });
  });

  it('should update selected train if we disable the selected occurrence', async () => {
    postTimetableByIdTrainScheduleException.mockResolvedValue({
      data: {
        change_groups: {},
        disabled: false,
        id: 1002020,
        timetable_id: 1,
        train_schedule_id: 1,
      },
    });

    const { result, rerender } = renderHookWithStore(
      () =>
        useOccurrenceActions({
          pacedTrain: { ...pacedTrainSchedule },
          occurrences: [{ ...occurrence1 }, { ...occurrence2 }],
          selectPacedTrainToEdit: mockSelectPacedTrainToEdit,
          timetableId: 1,
        }),
      { wrapper: timetableContextWrapper }
    );
    const store = getTestStore();

    result.current.toggleOccurrenceSelection(occurrence1.id);

    expect(store.getState().simulation.selectedTrain).toStrictEqual({
      by: 'timetable',
      id: occurrence1.id,
    });

    rerender();

    await result.current.updateOccurrenceStatus(occurrence1, 'disabled');

    expect(store.getState().simulation.selectedTrain).toStrictEqual({
      by: 'timetable',
      id: occurrence2.id,
    });
  });

  it('should remove indexed occurrence exceptions', async () => {
    postTrainScheduleExceptionsDelete.mockResolvedValue({
      data: [],
    });

    const [exception1] = pacedTrainWithExceptions.paced.exceptions;
    const { result } = renderHookWithStore(
      () =>
        useOccurrenceActions(
          buildOccurrenceActionsArgs({
            ...pacedTrainWithExceptions,
            paced: {
              ...pacedTrainWithExceptions.paced,
              exceptions: [
                {
                  ...exception1,
                  id: 100,
                },
              ],
            },
          })
        ),
      { wrapper: timetableContextWrapper }
    );

    await result.current.resetOccurrenceExceptions(occurrence1.id);

    expect(postTrainScheduleExceptionsDelete).toHaveBeenCalledWith({
      body: {
        ids: [100],
      },
    });

    const formattedPacedTrain =
      formatTrainScheduleWithDetailsToTrainSchedule(pacedTrainWithExceptions);

    expect(mockUpsertTrainSchedules).toHaveBeenCalledWith([
      {
        ...formattedPacedTrain,
        id: pacedTrainWithExceptions.id,
        train_schedule_set_id: pacedTrainWithExceptions.train_schedule_set_id,
        paced: {
          ...formattedPacedTrain.paced,
          exceptions: [],
        },
      },
    ]);
  });

  it('should remove change groups for added exceptions (except for start time)', async () => {
    putTrainScheduleExceptionById.mockResolvedValue({
      data: [],
    });

    const { result } = renderHookWithStore(
      () =>
        useOccurrenceActions(
          buildOccurrenceActionsArgs({ ...pacedTrainWithAddedException }, [
            { ...addedExceptionOccurrence },
          ])
        ),
      { wrapper: timetableContextWrapper }
    );

    const [addedException] = pacedTrainWithAddedException.paced.exceptions;
    await result.current.resetOccurrenceExceptions(addedExceptionOccurrence.id);

    expect(putTrainScheduleExceptionById).toHaveBeenCalledWith({
      body: {
        change_groups: {
          start_time: addedException.start_time,
        },
        disabled: false,
        occurrence_index: undefined,
        train_schedule_id: pacedTrainWithAddedException.id,
      },
      id: addedException.id,
    });

    const formattedPacedTrain = formatTrainScheduleWithDetailsToTrainSchedule(
      pacedTrainWithAddedException
    );

    expect(mockUpsertTrainSchedules).toHaveBeenCalledWith([
      {
        ...formattedPacedTrain,
        id: pacedTrainWithAddedException.id,
        train_schedule_set_id: pacedTrainWithAddedException.train_schedule_set_id,
        paced: {
          ...formattedPacedTrain.paced,
          exceptions: [
            {
              id: addedException.id,
              key: '',
              start_time: addedException.start_time,
            },
          ],
        },
      },
    ]);
  });

  it('should not delete inexistent exceptions', async () => {
    const { result } = renderHookWithStore(
      () => useOccurrenceActions(buildOccurrenceActionsArgs()),
      { wrapper: timetableContextWrapper }
    );

    await expect(
      result.current.deleteAddedException(addedExceptionOccurrence.id)
    ).rejects.toThrow();
  });

  it('should filter out deleted exception', async () => {
    postTrainScheduleExceptionsDelete.mockResolvedValue({
      data: [],
    });

    const { result } = renderHookWithStore(
      () =>
        useOccurrenceActions(
          buildOccurrenceActionsArgs({ ...pacedTrainWithAddedException }, [
            { ...addedExceptionOccurrence },
          ])
        ),
      { wrapper: timetableContextWrapper }
    );

    await result.current.deleteAddedException(addedExceptionOccurrence.id);

    expect(postTrainScheduleExceptionsDelete).toHaveBeenCalledWith({
      body: {
        ids: [0],
      },
    });

    const formattedPacedTrain = formatTrainScheduleWithDetailsToTrainSchedule(
      pacedTrainWithAddedException
    );

    expect(mockUpsertTrainSchedules).toHaveBeenCalledWith([
      {
        ...formattedPacedTrain,
        id: pacedTrainWithAddedException.id,
        train_schedule_set_id: pacedTrainWithAddedException.train_schedule_set_id,
        paced: {
          ...formattedPacedTrain.paced,
          exceptions: [],
        },
      },
    ]);
  });

  it('should not select deleted exception', async () => {
    postTrainScheduleExceptionsDelete.mockResolvedValue({
      data: [],
    });

    const { result, rerender } = renderHookWithStore(
      () =>
        useOccurrenceActions(
          buildOccurrenceActionsArgs({ ...pacedTrainWithAddedException }, [
            { ...addedExceptionOccurrence },
          ])
        ),
      { wrapper: timetableContextWrapper }
    );
    const store = getTestStore();

    result.current.toggleOccurrenceSelection(addedExceptionOccurrence.id);

    rerender();

    await result.current.deleteAddedException(addedExceptionOccurrence.id);

    rerender();

    expect(store.getState().simulation.selectedTrain).toStrictEqual(undefined);
  });
});
