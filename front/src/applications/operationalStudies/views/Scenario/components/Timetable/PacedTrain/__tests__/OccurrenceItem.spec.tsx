import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { describe, expect, it, vi } from 'vitest';

import type { Occurrence } from 'modules/trainSchedule/types';
import type { OccurrenceId } from 'reducers/osrdconf/types';
import { createStoreWithoutMiddleware } from 'store';

import OccurrenceItem from '../OccurrenceItem';

const occurrenceActions = {
  toggleOccurrenceSelection: vi.fn(),
  selectOccurrenceForProjection: vi.fn(),
  editOccurrence: vi.fn(),
  updateOccurrenceStatus: vi.fn(),
  resetOccurrenceExceptions: vi.fn(),
  deleteAddedException: vi.fn(),
};

const renderOccurrence = (occurrence: Occurrence) =>
  render(
    <Provider store={createStoreWithoutMiddleware({})}>
      <OccurrenceItem
        occurrence={occurrence}
        isSelected={false}
        occurrenceActions={occurrenceActions}
      />
    </Provider>
  );

const buildOccurrence = (trainName: string, overrides: Partial<Occurrence> = {}): Occurrence => ({
  id: 'indexedoccurrence_1_0' as OccurrenceId,
  disabled: false,
  trainName,
  startTime: new Date('2026-06-09T08:00:00.000Z'),
  stopsCount: 0,
  ...overrides,
});

const expectLogicalName = (trainName: string) => {
  const name = screen.getByTestId('occurrence-item-name');
  expect(name.textContent?.trim()).toBe(trainName);

  const bdi = name.querySelector('bdi');
  expect(bdi?.childNodes).toHaveLength(1);
  expect(bdi?.childNodes[0].nodeType).toBe(Node.TEXT_NODE);
  expect(bdi?.childNodes[0].textContent).toBe(trainName);

  expect(name.querySelector('span')?.getAttribute('title')).toBe(trainName);
};

describe('OccurrenceItem', () => {
  it.each(['8210 coucou 1', '8210 coucou 11', 'coucou 1'])(
    'keeps %s in logical order',
    (trainName) => {
      renderOccurrence(buildOccurrence(trainName));

      const name = screen.getByTestId('occurrence-item-name');
      expect(name.textContent?.trim()).toBe(trainName);

      const bdi = name.querySelector('bdi');
      expect(bdi?.childNodes).toHaveLength(1);
      expect(bdi?.childNodes[0].nodeType).toBe(Node.TEXT_NODE);
      expect(bdi?.childNodes[0].textContent).toBe(trainName);
      expect(name.querySelector('span')?.getAttribute('title')).toBe(trainName);
    }
  );

  it('marks an occurrence whose exception changes the start time', () => {
    renderOccurrence(
      buildOccurrence('8210 coucou 1', {
        exception: {
          id: 1,
          exceptionChangeGroups: {
            start_time: { value: new Date('2026-06-09T08:05:00.000Z').getTime() },
          },
        },
      })
    );

    expect(
      screen.getByTestId('occurrence-item-name').classList.contains('start-time-exception')
    ).toBe(true);
    expectLogicalName('8210 coucou 1');
  });

  it('shows the logical name of a disabled occurrence', () => {
    renderOccurrence(buildOccurrence('8210 coucou 1', { disabled: true }));

    expect(screen.getByTestId('occurrence-item').classList.contains('disabled')).toBe(true);
    expectLogicalName('8210 coucou 1');
  });
});
