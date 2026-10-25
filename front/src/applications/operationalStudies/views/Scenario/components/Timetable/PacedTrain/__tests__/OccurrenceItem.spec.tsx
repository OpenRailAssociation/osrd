import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { afterEach, describe, expect, it, vi } from 'vitest';

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

const buildOccurrence = (trainName: string): Occurrence => ({
  id: 'indexedoccurrence_1_0' as OccurrenceId,
  disabled: false,
  trainName,
  startTime: new Date('2026-06-09T08:00:00.000Z'),
  stopsCount: 0,
});

const getDisplayedName = () =>
  screen.getByTestId('occurrence-item-name').querySelector('.occurrence-name-text')?.textContent;

// jsdom has no layout: give the name a width and every character a width of 10px.
const mockLayout = (nameWidth: number) => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe = vi.fn();
      disconnect = vi.fn();
    }
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    font: '',
    measureText: (value: string) => ({ width: Array.from(value).length * 10 }),
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    width: nameWidth,
  } as DOMRect);
};

describe('OccurrenceItem', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('crops the start of a long name so the occurrence index stays visible', () => {
    mockLayout(100);
    renderOccurrence(buildOccurrence('8210 coucou 12'));

    expect(getDisplayedName()).toBe('…coucou 12');
    expect(screen.getByTitle('8210 coucou 12')).toBeDefined();
  });

  it('shows a name that fits unchanged', () => {
    mockLayout(140);
    renderOccurrence(buildOccurrence('8210 coucou 1'));

    expect(getDisplayedName()).toBe('8210 coucou 1');
  });
});
